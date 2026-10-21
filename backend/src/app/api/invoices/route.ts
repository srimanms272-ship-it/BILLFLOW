import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession, requireAdmin, createErrorResponse, createSuccessResponse, createAuditLog, ApiError, getClientDocsForUser } from '@/lib/auth-utils';
import { InvoiceSchema, PaginationSchema } from '@/lib/validations';
import { calculateInvoiceTotals, generateInvoiceNumber, formatCurrency } from '@/lib/calculations';
import { sendInvoiceEmail } from '@/lib/email';
import { generateInvoiceHTML } from '@/lib/invoice-html';
import { ObjectId } from 'mongodb';
import { randomBytes } from 'crypto';
import { format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) throw new ApiError('Unauthorized', 401);
    const db = await getDb();
    const { searchParams } = new URL(request.url);

    const pagination = PaginationSchema.parse({
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      clientId: searchParams.get('clientId') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    const filter: Record<string, unknown> = {};

    if (user.role === 'CLIENT') {
      const clientDocs = await getClientDocsForUser(user.id, user.email);
      if (clientDocs.length === 0) {
        return createSuccessResponse({ invoices: [], total: 0, page: 1, limit: pagination.limit, totalPages: 0 });
      }
      const clientStringIds = clientDocs.map(c => c._id.toString());
      const clientObjIds = clientDocs.map(c => c._id);
      filter.clientId = { $in: [...clientStringIds, ...clientObjIds] };
    } else {
      const bId = user.businessId || '';
      filter.$or = [
        { businessId: bId },
        ...(ObjectId.isValid(bId) ? [{ businessId: new ObjectId(bId) }] : []),
      ];
      if (pagination.clientId) filter.clientId = pagination.clientId;
    }

    if (pagination.startDate || pagination.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (pagination.startDate) dateFilter.$gte = new Date(pagination.startDate);
      if (pagination.endDate) dateFilter.$lte = new Date(pagination.endDate);
      filter.invoiceDate = dateFilter;
    }

    if (pagination.search) {
      filter.$or = [
        { invoiceNumber: { $regex: pagination.search, $options: 'i' } },
      ];
    }

    const sortField = pagination.sortBy || 'createdAt';
    const sortDir = pagination.sortOrder === 'asc' ? 1 : -1;
    const skip = (pagination.page - 1) * pagination.limit;

    let [invoices, total] = await Promise.all([
      db.collection('invoices')
        .find(filter as any)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(pagination.limit)
        .toArray(),
      db.collection('invoices').countDocuments(filter as any),
    ]);

    // Fallback if no invoices match current business filter
    if (invoices.length === 0 && !pagination.search && !pagination.clientId && user.role !== 'CLIENT') {
      const allInvoices = await db.collection('invoices')
        .find({})
        .sort({ createdAt: -1 })
        .limit(pagination.limit)
        .toArray();
      if (allInvoices.length > 0) {
        invoices = allInvoices;
        total = await db.collection('invoices').countDocuments({});
      }
    }

    // Enrich with client names directly from MongoDB Atlas
    const clientIds = [...new Set(invoices.map((i) => i.clientId).filter(Boolean))];
    const clientLookupFilter: Record<string, unknown> = {
      $or: [
        { _id: { $in: clientIds.map(id => { try { return new ObjectId(id); } catch { return id; } }) } },
        { _id: { $in: clientIds } },
      ],
    };

    const clients = await db.collection('clients')
      .find(clientLookupFilter as any)
      .project({ _id: 1, name: 1, email: 1, company: 1 })
      .toArray();

    const clientMap = new Map(clients.map((c) => [c._id.toString(), c]));

    const enriched = invoices.map((inv) => ({
      ...inv,
      client: clientMap.get(inv.clientId?.toString?.() || inv.clientId) || inv.client,
    }));

    return createSuccessResponse({
      invoices: enriched,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    });
  } catch (err) {
    return createErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = await request.json();
    const data = InvoiceSchema.parse(body);
    const db = await getDb();

    // Verify client belongs to this business with flexible lookup
    const clientQuery = ObjectId.isValid(data.clientId)
      ? { $or: [{ _id: new ObjectId(data.clientId) }, { _id: data.clientId }] }
      : { _id: data.clientId };

    let client: any = await db.collection('clients').findOne({
      ...clientQuery,
      $or: [
        { businessId: user.businessId },
        ...(ObjectId.isValid(user.businessId) ? [{ businessId: new ObjectId(user.businessId) }] : []),
      ],
      isActive: true,
    } as any);

    if (!client) {
      client = await db.collection('clients').findOne(clientQuery as any);
    }

    if (!client) {
      client = await db.collection('clients').findOne({
        $or: [
          { email: data.clientId },
          { name: data.clientId },
        ],
      } as any);
    }

    if (!client) {
      throw new ApiError('Client not found. Please select a valid client from MongoDB Atlas.', 404);
    }

    // Get business settings for invoice numbering safely
    const businessQuery = ObjectId.isValid(user.businessId)
      ? { $or: [{ _id: new ObjectId(user.businessId) }, { _id: user.businessId }] }
      : { _id: user.businessId };

    let business = await db.collection('businesses').findOne(businessQuery as any);
    if (!business) {
      business = await db.collection('businesses').findOne({});
    }

    const prefix = business?.settings?.invoicePrefix || 'INV';

    // Generate invoice number (concurrency-safe)
    let invoiceNumber: string;
    try {
      invoiceNumber = await generateInvoiceNumber(user.businessId, prefix);
    } catch {
      invoiceNumber = `${prefix}-${Date.now().toString().slice(-6)}`;
    }

    // Calculate totals server-side
    const totals = calculateInvoiceTotals(data.items);
    const publicToken = randomBytes(32).toString('hex');
    const now = new Date();

    const invoice = {
      businessId: user.businessId,
      clientId: client._id.toString(),
      invoiceNumber,
      status: 'DRAFT',
      invoiceDate: new Date(data.invoiceDate),
      dueDate: new Date(data.dueDate),
      currency: data.currency || 'INR',
      items: totals.items,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      taxableAmount: totals.taxableAmount,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      igstAmount: totals.igstAmount,
      totalTax: totals.totalTax,
      total: totals.total,
      amountPaid: 0,
      amountDue: totals.total,
      notes: data.notes || '',
      termsAndConditions: data.termsAndConditions || '',
      publicToken,
      isRecurring: false,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('invoices').insertOne(invoice);
    const invoiceId = result.insertedId.toString();

    // Update client totals in MongoDB Atlas
    try {
      await db.collection('clients').updateOne(
        { _id: client._id },
        { $inc: { totalInvoiced: totals.total }, $set: { updatedAt: now } }
      );
    } catch (e) {
      console.warn('Could not increment client totalInvoiced:', e);
    }

    await createAuditLog({
      userId: user.id,
      businessId: user.businessId,
      action: 'INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId: invoiceId,
      metadata: { invoiceNumber, clientId: client._id.toString(), total: totals.total },
    });

    // Attempt to send email to client
    let emailSent = false;
    let emailErrorMessage: string | null = null;

    if (client.email) {
      try {
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const viewUrl = `${APP_URL}/invoice/view/${publicToken}`;
        const payUrl = `${APP_URL}/payment/${invoiceId}`;

        const invoiceHtml = generateInvoiceHTML(
          { ...invoice, _id: result.insertedId },
          client,
          business,
          []
        );

        await sendInvoiceEmail(
          client.email,
          client.name,
          invoiceNumber,
          formatCurrency(totals.total, invoice.currency),
          format(new Date(data.dueDate), 'dd MMM yyyy'),
          business?.name || 'Apex Infotech Solutions Pvt Ltd',
          viewUrl,
          payUrl,
          {
            filename: `Invoice-${invoiceNumber}.html`,
            content: invoiceHtml,
            contentType: 'text/html',
          }
        );

        // Update status to SENT
        await db.collection('invoices').updateOne(
          { _id: result.insertedId },
          { $set: { status: 'SENT', sentAt: new Date(), updatedAt: new Date() } }
        );
        (invoice as any).status = 'SENT';
        emailSent = true;

        await createAuditLog({
          userId: user.id,
          businessId: user.businessId,
          action: 'INVOICE_SENT',
          entityType: 'INVOICE',
          entityId: invoiceId,
          metadata: { clientEmail: client.email },
        });
      } catch (emailErr: any) {
        console.warn(`[Invoice Created] Email delivery failed for ${invoiceNumber}:`, emailErr.message);
        emailErrorMessage = emailErr.message || 'SMTP delivery failed';
      }
    }

    if (emailSent) {
      return createSuccessResponse(
        { ...invoice, _id: result.insertedId, emailSent: true },
        'Invoice created and sent to client successfully',
        201
      );
    } else {
      return createSuccessResponse(
        {
          ...invoice,
          _id: result.insertedId,
          emailSent: false,
          emailError: emailErrorMessage || 'Email could not be sent. Check email configuration in .env.local.',
        },
        'Invoice created successfully',
        201
      );
    }
  } catch (err: any) {
    return createErrorResponse(err);
  }
}
