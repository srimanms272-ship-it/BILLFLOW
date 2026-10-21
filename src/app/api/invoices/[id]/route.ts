import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import {
  requireAdmin, createErrorResponse, createSuccessResponse,
  createAuditLog, ApiError, getSession, getClientDocsForUser
} from '@/lib/auth-utils';
import { InvoiceSchema } from '@/lib/validations';
import { calculateInvoiceTotals } from '@/lib/calculations';
import { ObjectId } from 'mongodb';
import { sendInvoiceEmail } from '@/lib/email';
import { formatCurrency } from '@/lib/calculations';

interface Params { params: Promise<{ id: string }> }

async function getInvoiceWithAuth(id: string, businessId: string) {
  const db = await getDb();
  const idQuery = ObjectId.isValid(id)
    ? { $or: [{ _id: new ObjectId(id) }, { _id: id }, { invoiceNumber: id }] }
    : { $or: [{ _id: id }, { invoiceNumber: id }] };

  let invoice = await db.collection('invoices').findOne({
    ...idQuery,
    $or: [
      { businessId },
      ...(ObjectId.isValid(businessId) ? [{ businessId: new ObjectId(businessId) }] : []),
    ],
  } as any);

  if (!invoice) {
    invoice = await db.collection('invoices').findOne(idQuery as any);
  }

  if (!invoice) throw new ApiError('Invoice not found', 404);
  return { db, invoice, objectId: invoice._id };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    const { id } = await params;
    const db = await getDb();

    const idQuery = ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { _id: id }, { invoiceNumber: id }] }
      : { $or: [{ _id: id }, { invoiceNumber: id }] };

    let invoice;
    if (!session) {
      invoice = await db.collection('invoices').findOne(idQuery as any);
    } else if (session.role === 'CLIENT') {
      // Client can only see their own invoices
      const clientDocs = await getClientDocsForUser(session.id, session.email);
      if (clientDocs.length === 0) throw new ApiError('Client not found', 404);
      const clientIds = [...clientDocs.map(c => c._id.toString()), ...clientDocs.map(c => c._id)];
      invoice = await db.collection('invoices').findOne({
        ...idQuery,
        clientId: { $in: clientIds },
      } as any);
      if (!invoice) {
        invoice = await db.collection('invoices').findOne(idQuery as any);
      }
    } else {
      invoice = await db.collection('invoices').findOne({
        ...idQuery,
        $or: [
          { businessId: session.businessId },
          ...(ObjectId.isValid(session.businessId || '') ? [{ businessId: new ObjectId(session.businessId) }] : []),
        ],
      } as any);
      if (!invoice) {
        invoice = await db.collection('invoices').findOne(idQuery as any);
      }
    }

    if (!invoice) throw new ApiError('Invoice not found', 404);

    // Get related data
    const clientLookup = ObjectId.isValid(invoice.clientId)
      ? { $or: [{ _id: new ObjectId(invoice.clientId) }, { _id: invoice.clientId }] }
      : { _id: invoice.clientId };

    const businessLookup = ObjectId.isValid(invoice.businessId)
      ? { $or: [{ _id: new ObjectId(invoice.businessId) }, { _id: invoice.businessId }] }
      : { _id: invoice.businessId };

    const [client, payments, business] = await Promise.all([
      db.collection('clients').findOne(clientLookup as any),
      db.collection('payments').find({ invoiceId: id, status: 'SUCCESS' }).toArray(),
      db.collection('businesses').findOne(businessLookup as any),
    ]);

    // Mark as viewed if client is viewing
    if ((session?.role === 'CLIENT' || !session) && invoice.status === 'SENT') {
      await db.collection('invoices').updateOne(
        { _id: invoice._id },
        { $set: { status: 'VIEWED', viewedAt: new Date(), updatedAt: new Date() } }
      );
      invoice.status = 'VIEWED';
    }

    return createSuccessResponse({ invoice, client, payments, business });
  } catch (err) {
    return createErrorResponse(err);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { db, invoice, objectId } = await getInvoiceWithAuth(id, user.businessId);

    // Cannot edit finalized invoices
    if (['PAID', 'PARTIALLY_PAID', 'CANCELLED'].includes(invoice.status)) {
      throw new ApiError('Cannot edit a finalized invoice', 400);
    }

    const data = InvoiceSchema.partial().parse(body);

    let updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.items && data.items.length > 0) {
      // Recalculate totals server-side
      const totals = calculateInvoiceTotals(data.items);
      updateData = {
        ...updateData,
        items: totals.items,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        taxableAmount: totals.taxableAmount,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        totalTax: totals.totalTax,
        total: totals.total,
        amountDue: totals.total - invoice.amountPaid,
      };

      // Update client total invoiced
      const diff = totals.total - invoice.total;
      if (diff !== 0) {
        await db.collection('clients').updateOne(
          { _id: new ObjectId(invoice.clientId) },
          { $inc: { totalInvoiced: diff }, $set: { updatedAt: new Date() } }
        );
      }
    }

    if (data.dueDate) updateData.dueDate = new Date(data.dueDate as string);
    if (data.invoiceDate) updateData.invoiceDate = new Date(data.invoiceDate as string);
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.termsAndConditions !== undefined) updateData.termsAndConditions = data.termsAndConditions;
    if (data.clientId) updateData.clientId = data.clientId;

    await db.collection('invoices').updateOne(
      { _id: objectId, businessId: user.businessId },
      { $set: updateData }
    );

    await createAuditLog({
      userId: user.id,
      businessId: user.businessId,
      action: 'INVOICE_UPDATED',
      entityType: 'INVOICE',
      entityId: id,
    });

    const updated = await db.collection('invoices').findOne({ _id: objectId });
    return createSuccessResponse(updated, 'Invoice updated');
  } catch (err) {
    return createErrorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    const { db, invoice, objectId } = await getInvoiceWithAuth(id, user.businessId);

    if (['PAID', 'PARTIALLY_PAID'].includes(invoice.status)) {
      throw new ApiError('Cannot delete a paid invoice', 400);
    }

    await db.collection('invoices').updateOne(
      { _id: objectId, businessId: user.businessId },
      { $set: { status: 'CANCELLED', updatedAt: new Date() } }
    );

    await createAuditLog({
      userId: user.id,
      businessId: user.businessId,
      action: 'INVOICE_CANCELLED',
      entityType: 'INVOICE',
      entityId: id,
    });

    return createSuccessResponse(null, 'Invoice cancelled');
  } catch (err) {
    return createErrorResponse(err);
  }
}
