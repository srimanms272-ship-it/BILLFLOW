import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession, createErrorResponse, ApiError, getClientDocsForUser } from '@/lib/auth-utils';
import { ObjectId } from 'mongodb';
import { generateInvoicePDFBuffer } from '@/lib/invoice-pdf';

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    let session: any = null;
    try {
      session = await getSession();
    } catch {}

    const db = await getDb();

    const idQuery = ObjectId.isValid(id)
      ? { $or: [{ _id: new ObjectId(id) }, { _id: id }, { invoiceNumber: id }] }
      : { $or: [{ _id: id }, { invoiceNumber: id }] };

    let invoice: any = null;

    if (!session) {
      invoice = await db.collection('invoices').findOne(idQuery as any);
    } else if (session.role === 'CLIENT') {
      const clientDocs = await getClientDocsForUser(session.id, session.email);
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

    if (!invoice) {
      throw new ApiError('Invoice not found in MongoDB Atlas', 404);
    }

    // Retrieve client and business records from MongoDB Atlas
    const clientLookup = ObjectId.isValid(invoice.clientId)
      ? { $or: [{ _id: new ObjectId(invoice.clientId) }, { _id: invoice.clientId }] }
      : { _id: invoice.clientId };

    const businessLookup = ObjectId.isValid(invoice.businessId)
      ? { $or: [{ _id: new ObjectId(invoice.businessId) }, { _id: invoice.businessId }] }
      : { _id: invoice.businessId };

    const [client, business] = await Promise.all([
      db.collection('clients').findOne(clientLookup as any).catch(() => invoice.client || null),
      db.collection('businesses').findOne(businessLookup as any).catch(() => null),
    ]);

    // Generate real PDF buffer
    const resolvedClient = client || invoice.client || {
      name: 'Client',
      email: '',
      company: '',
      phone: '',
      billingAddress: {}
    };

    const resolvedBusiness = business || {
      name: 'Apex Infotech Solutions Pvt Ltd',
      email: 'billing@billflow.io',
      phone: '+91 98765 43210',
      address: {
        line1: 'Innovation Hub',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        pincode: '560001'
      }
    };

    // Enforce that an invoice is ONLY 'PAID' if full amount is verified paid
    const isPaid = (invoice.amountPaid >= invoice.total && invoice.total > 0) || (invoice.amountDue <= 0 && invoice.amountPaid > 0);
    const normalizedInvoice = {
      ...invoice,
      status: isPaid ? 'PAID' : (invoice.status === 'PAID' ? 'PENDING' : (invoice.status || 'PENDING')),
    };

    const pdfBuffer = await generateInvoicePDFBuffer(normalizedInvoice, resolvedClient, resolvedBusiness);

    return new Response(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${invoice.invoiceNumber || 'INV'}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (err) {
    console.error('Error generating PDF:', err);
    return createErrorResponse(err);
  }
}
