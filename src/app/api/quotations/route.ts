import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, createErrorResponse, createSuccessResponse, createAuditLog, ApiError } from '@/lib/auth-utils';
import { QuotationSchema, PaginationSchema } from '@/lib/validations';
import { calculateInvoiceTotals, generateQuotationNumber, generateInvoiceNumber } from '@/lib/calculations';
import { ObjectId } from 'mongodb';
import { randomBytes } from 'crypto';
import { sendInvoiceEmail } from '@/lib/email';
import { formatCurrency } from '@/lib/calculations';
import { format } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
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
    });

    const filter: Record<string, unknown> = { businessId: user.businessId };
    if (pagination.status) filter.status = pagination.status;
    if (pagination.clientId) filter.clientId = pagination.clientId;
    if (pagination.search) {
      filter.$or = [{ quotationNumber: { $regex: pagination.search, $options: 'i' } }];
    }

    const skip = (pagination.page - 1) * pagination.limit;
    const [quotations, total] = await Promise.all([
      db.collection('quotations').find(filter).sort({ createdAt: -1 }).skip(skip).limit(pagination.limit).toArray(),
      db.collection('quotations').countDocuments(filter),
    ]);

    const clientIds = [...new Set(quotations.map(q => q.clientId))];
    const clients = await db.collection('clients')
      .find({ _id: { $in: clientIds.map(id => { try { return new ObjectId(id); } catch { return id; } }) } })
      .project({ _id: 1, name: 1, email: 1, company: 1 })
      .toArray();
    const clientMap = new Map(clients.map(c => [c._id.toString(), c]));
    const enriched = quotations.map(q => ({ ...q, client: clientMap.get(q.clientId) }));

    return createSuccessResponse({ quotations: enriched, total, page: pagination.page, limit: pagination.limit, totalPages: Math.ceil(total / pagination.limit) });
  } catch (err) {
    return createErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = await request.json();
    const { action } = body;

    if (action === 'convert') {
      return await convertToInvoice(user, body);
    }

    const data = QuotationSchema.parse(body);
    const db = await getDb();

    const client = await db.collection('clients').findOne({
      _id: new ObjectId(data.clientId),
      businessId: user.businessId,
      isActive: true,
    });
    if (!client) throw new ApiError('Client not found', 404);

    const business = await db.collection('businesses').findOne({ _id: new ObjectId(user.businessId) });
    if (!business) throw new ApiError('Business not found', 404);

    const prefix = business.settings?.quotationPrefix || 'QUO';
    const quotationNumber = await generateQuotationNumber(user.businessId, prefix);
    const totals = calculateInvoiceTotals(data.items);
    const publicToken = randomBytes(32).toString('hex');
    const now = new Date();

    const quotation = {
      businessId: user.businessId,
      clientId: data.clientId,
      quotationNumber,
      status: 'DRAFT',
      quotationDate: new Date(data.quotationDate as string),
      expiryDate: new Date(data.expiryDate as string),
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
      notes: data.notes,
      termsAndConditions: data.termsAndConditions,
      publicToken,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('quotations').insertOne(quotation);

    await createAuditLog({
      userId: user.id,
      businessId: user.businessId,
      action: 'QUOTATION_CREATED',
      entityType: 'QUOTATION',
      entityId: result.insertedId.toString(),
      metadata: { quotationNumber, clientId: data.clientId },
    });

    return createSuccessResponse({ ...quotation, _id: result.insertedId }, 'Quotation created', 201);
  } catch (err) {
    return createErrorResponse(err);
  }
}

async function convertToInvoice(user: { id: string; businessId: string }, body: Record<string, unknown>) {
  const db = await getDb();
  const quotationId = body.quotationId as string;
  const quotation = await db.collection('quotations').findOne({
    _id: new ObjectId(quotationId),
    businessId: user.businessId,
  });
  if (!quotation) throw new ApiError('Quotation not found', 404);
  if (quotation.status === 'CONVERTED') throw new ApiError('Quotation already converted', 400);

  const business = await db.collection('businesses').findOne({ _id: new ObjectId(user.businessId) });
  const prefix = business?.settings?.invoicePrefix || 'INV';
  const invoiceNumber = await generateInvoiceNumber(user.businessId, prefix);

  const dueDate = body.dueDate
    ? new Date(body.dueDate as string)
    : new Date(Date.now() + (business?.settings?.defaultPaymentTerms || 30) * 24 * 60 * 60 * 1000);

  const randomBytes = (await import('crypto')).randomBytes;
  const publicToken = randomBytes(32).toString('hex');
  const now = new Date();

  const invoice = {
    businessId: user.businessId,
    clientId: quotation.clientId,
    invoiceNumber,
    status: 'PENDING',
    invoiceDate: now,
    dueDate,
    currency: quotation.currency,
    items: quotation.items,
    subtotal: quotation.subtotal,
    discountAmount: quotation.discountAmount,
    taxableAmount: quotation.taxableAmount,
    cgstAmount: quotation.cgstAmount,
    sgstAmount: quotation.sgstAmount,
    igstAmount: quotation.igstAmount,
    totalTax: quotation.totalTax,
    total: quotation.total,
    amountPaid: 0,
    amountDue: quotation.total,
    notes: quotation.notes,
    termsAndConditions: quotation.termsAndConditions,
    fromQuotationId: quotationId,
    publicToken,
    isRecurring: false,
    createdBy: user.id,
    createdAt: now,
    updatedAt: now,
  };

  const invoiceResult = await db.collection('invoices').insertOne(invoice);
  await db.collection('quotations').updateOne(
    { _id: new ObjectId(quotationId) },
    { $set: { status: 'CONVERTED', convertedToInvoiceId: invoiceResult.insertedId.toString(), updatedAt: now } }
  );

  await db.collection('clients').updateOne(
    { _id: new ObjectId(quotation.clientId) },
    { $inc: { totalInvoiced: quotation.total }, $set: { updatedAt: now } }
  );

  await createAuditLog({
    userId: user.id,
    businessId: user.businessId,
    action: 'QUOTATION_CONVERTED',
    entityType: 'QUOTATION',
    entityId: quotationId,
    metadata: { invoiceId: invoiceResult.insertedId.toString(), invoiceNumber },
  });

  return createSuccessResponse(
    { invoiceId: invoiceResult.insertedId.toString(), invoiceNumber },
    'Quotation converted to invoice'
  );
}
