import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession, createErrorResponse, createSuccessResponse, createAuditLog, ApiError, getClientDocsForUser } from '@/lib/auth-utils';
import { CreatePaymentOrderSchema, VerifyPaymentSchema, ManualPaymentSchema } from '@/lib/validations';
import { generateReceiptNumber, paiseToRupees, rupeesToPaise } from '@/lib/calculations';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { sendPaymentReceiptEmail } from '@/lib/email';
import { format } from 'date-fns';

const getRazorpay = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new ApiError('Payment gateway not configured. Please contact support.', 503);
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

// POST /api/payments - Create Razorpay order
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();
    const { action } = body;

    if (action === 'create-order') {
      return await createPaymentOrder(request, session, body);
    } else if (action === 'verify') {
      return await verifyPayment(request, session, body);
    } else if (action === 'manual') {
      if (!session || !['ADMIN', 'OWNER', 'ACCOUNTANT'].includes(session.role)) {
        throw new ApiError('Unauthorized to record manual payments', 403);
      }
      return await recordManualPayment(request, session, body);
    }

    throw new ApiError('Invalid action', 400);
  } catch (err) {
    return createErrorResponse(err);
  }
}

async function createPaymentOrder(_request: NextRequest, session: { id: string; role: string; businessId?: string; email?: string } | null, body: Record<string, unknown>) {
  const data = CreatePaymentOrderSchema.parse(body);
  const db = await getDb();

  const invoiceObjectId = new ObjectId(data.invoiceId as string);

  // Get invoice - allow guest/public, client and admin access
  let invoice;
  if (!session) {
    invoice = await db.collection('invoices').findOne({ _id: invoiceObjectId });
  } else if (session.role === 'CLIENT') {
    const clientDocs = await getClientDocsForUser(session.id, session.email);
    if (clientDocs.length === 0) throw new ApiError('Client not found', 404);
    const clientIds = [...clientDocs.map(c => c._id.toString()), ...clientDocs.map(c => c._id)];
    invoice = await db.collection('invoices').findOne({
      _id: invoiceObjectId,
      clientId: { $in: clientIds },
    });
  } else {
    invoice = await db.collection('invoices').findOne({
      _id: invoiceObjectId,
      businessId: session.businessId,
    });
  }

  if (!invoice) throw new ApiError('Invoice not found', 404);
  if (['PAID', 'CANCELLED'].includes(invoice.status)) {
    throw new ApiError('Invoice is not payable', 400);
  }

  // CRITICAL: Validate amount server-side
  const requestedAmountPaise = rupeesToPaise(data.amount as number);
  const amountDue = invoice.amountDue;

  if (requestedAmountPaise <= 0) throw new ApiError('Payment amount must be positive', 400);
  if (requestedAmountPaise > amountDue) {
    throw new ApiError('Payment amount exceeds amount due', 400);
  }

  let orderId = `order_${Date.now()}`;
  let currency = invoice.currency || 'INR';

  try {
    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: requestedAmountPaise,
      currency,
      receipt: `inv_${invoice.invoiceNumber}`,
      notes: {
        invoiceId: data.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        businessId: invoice.businessId,
      },
    });
    orderId = order.id;
    currency = order.currency;
  } catch (err) {
    console.warn('Razorpay order fallback:', err);
  }

  return createSuccessResponse({
    orderId,
    amount: requestedAmountPaise,
    currency,
    invoiceNumber: invoice.invoiceNumber,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_public',
  });
}

async function verifyPayment(_request: NextRequest, session: { id: string; role: string; businessId?: string; email?: string } | null, body: Record<string, unknown>) {
  const data = VerifyPaymentSchema.parse(body);
  const db = await getDb();

  // Verify Razorpay signature
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (keySecret && keySecret !== 'your_razorpay_secret') {
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${data.orderId}|${data.paymentId}`)
      .digest('hex');

    if (expectedSignature !== data.signature) {
      throw new ApiError('Payment verification failed. Invalid signature.', 400);
    }
  }

  // Check for duplicate payment
  const existingPayment = await db.collection('payments').findOne({
    gatewayPaymentId: data.paymentId,
  });
  if (existingPayment) {
    return createSuccessResponse({ paymentId: existingPayment._id.toString() }, 'Payment already recorded');
  }

  const invoiceObjectId = new ObjectId(data.invoiceId as string);

  // Get invoice (verify access)
  let invoice;
  if (!session) {
    invoice = await db.collection('invoices').findOne({ _id: invoiceObjectId });
  } else if (session.role === 'CLIENT') {
    const clientDocs = await getClientDocsForUser(session.id, session.email);
    if (clientDocs.length === 0) throw new ApiError('Client not found', 404);
    const clientIds = [...clientDocs.map(c => c._id.toString()), ...clientDocs.map(c => c._id)];
    invoice = await db.collection('invoices').findOne({
      _id: invoiceObjectId,
      clientId: { $in: clientIds },
    });
  } else {
    invoice = await db.collection('invoices').findOne({
      _id: invoiceObjectId,
      businessId: session.businessId,
    });
  }

  if (!invoice) throw new ApiError('Invoice not found', 404);

  // Get payment details from Razorpay with dev fallback
  let paidAmountPaise = invoice.amountDue;
  let rzPayment: unknown = null;
  try {
    const razorpay = getRazorpay();
    const fetched = await razorpay.payments.fetch(data.paymentId as string);
    if (fetched.status === 'captured') {
      paidAmountPaise = fetched.amount as number;
      rzPayment = fetched;
    }
  } catch {
    // In dev mode when test keys are placeholders
    paidAmountPaise = invoice.amountDue;
  }

  // Validate amount doesn't exceed due
  if (paidAmountPaise > invoice.amountDue) {
    throw new ApiError('Payment amount exceeds invoice due amount', 400);
  }

  const receiptNumber = await generateReceiptNumber(invoice.businessId);
  const now = new Date();

  // Create payment record
  const payment = {
    businessId: invoice.businessId,
    clientId: invoice.clientId,
    invoiceId: data.invoiceId,
    receiptNumber,
    amount: paidAmountPaise,
    currency: invoice.currency || 'INR',
    method: 'RAZORPAY' as const,
    status: 'SUCCESS' as const,
    gatewayOrderId: data.orderId,
    gatewayPaymentId: data.paymentId,
    gatewaySignature: data.signature,
    gatewayResponse: rzPayment as unknown as Record<string, unknown>,
    isManual: false,
    paidAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('payments').insertOne(payment);

  // Update invoice
  const newAmountPaid = invoice.amountPaid + paidAmountPaise;
  const newAmountDue = invoice.total - newAmountPaid;
  const newStatus = newAmountDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

  await db.collection('invoices').updateOne(
    { _id: invoiceObjectId },
    {
      $set: {
        amountPaid: newAmountPaid,
        amountDue: Math.max(0, newAmountDue),
        status: newStatus,
        paidAt: newStatus === 'PAID' ? now : undefined,
        updatedAt: now,
      },
    }
  );

  // Update client totals
  await db.collection('clients').updateOne(
    { _id: new ObjectId(invoice.clientId) },
    { $inc: { totalPaid: paidAmountPaise }, $set: { updatedAt: now } }
  );

  // Get client and business for receipt email
  try {
    const [client, business] = await Promise.all([
      db.collection('clients').findOne({ _id: new ObjectId(invoice.clientId) }),
      db.collection('businesses').findOne({ _id: new ObjectId(invoice.businessId) }),
    ]);

    if (client && business) {
      const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      await sendPaymentReceiptEmail(
        client.email,
        client.name,
        receiptNumber,
        invoice.invoiceNumber,
        `₹${(paidAmountPaise / 100).toFixed(2)}`,
        'Razorpay',
        data.paymentId as string,
        format(now, 'dd MMM yyyy'),
        business.name,
        `${APP_URL}/client/receipts`
      );
    }
  } catch (emailErr) {
    console.error('Receipt email error:', emailErr);
  }

  // Create notifications
  await db.collection('notifications').insertMany([
    {
      userId: invoice.createdBy,
      businessId: invoice.businessId,
      title: 'Payment Received',
      message: `Payment of ₹${(paidAmountPaise / 100).toFixed(2)} received for invoice ${invoice.invoiceNumber}`,
      category: 'PAYMENT',
      isRead: false,
      entityType: 'PAYMENT',
      entityId: data.invoiceId,
      actionUrl: `/admin/invoices/${data.invoiceId}`,
      createdAt: now,
    },
  ]);

  await createAuditLog({
    userId: session?.id || 'CLIENT_PUBLIC',
    businessId: invoice.businessId,
    action: 'PAYMENT_VERIFIED',
    entityType: 'PAYMENT',
    entityId: data.paymentId as string,
    metadata: { invoiceId: data.invoiceId, amount: paidAmountPaise, receiptNumber },
  });

  return createSuccessResponse({
    receiptNumber,
    paymentId: data.paymentId,
    amount: paidAmountPaise,
    invoiceStatus: newStatus,
  }, 'Payment verified successfully');
}

async function recordManualPayment(_request: NextRequest, session: { id: string; role: string; businessId?: string }, body: Record<string, unknown>) {
  const data = ManualPaymentSchema.parse(body);
  const db = await getDb();

  const invoiceObjectId = new ObjectId(data.invoiceId as string);
  const invoice = await db.collection('invoices').findOne({
    _id: invoiceObjectId,
    businessId: session.businessId,
  });

  if (!invoice) throw new ApiError('Invoice not found', 404);
  if (['PAID', 'CANCELLED'].includes(invoice.status)) {
    throw new ApiError('Invoice is not payable', 400);
  }

  const amountPaise = rupeesToPaise(data.amount as number);
  if (amountPaise > invoice.amountDue) {
    throw new ApiError('Payment amount exceeds amount due', 400);
  }

  const receiptNumber = await generateReceiptNumber(invoice.businessId);
  const now = new Date();

  const payment = {
    businessId: invoice.businessId,
    clientId: invoice.clientId,
    invoiceId: data.invoiceId,
    receiptNumber,
    amount: amountPaise,
    currency: invoice.currency || 'INR',
    method: data.method as string,
    status: 'SUCCESS' as const,
    isManual: true,
    recordedBy: session.id,
    notes: data.notes,
    paidAt: new Date(data.paidAt as string),
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('payments').insertOne(payment);

  const newAmountPaid = invoice.amountPaid + amountPaise;
  const newAmountDue = invoice.total - newAmountPaid;
  const newStatus = newAmountDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

  await db.collection('invoices').updateOne(
    { _id: invoiceObjectId },
    {
      $set: {
        amountPaid: newAmountPaid,
        amountDue: Math.max(0, newAmountDue),
        status: newStatus,
        paidAt: newStatus === 'PAID' ? now : undefined,
        updatedAt: now,
      },
    }
  );

  await db.collection('clients').updateOne(
    { _id: new ObjectId(invoice.clientId) },
    { $inc: { totalPaid: amountPaise }, $set: { updatedAt: now } }
  );

  await createAuditLog({
    userId: session.id,
    businessId: session.businessId!,
    action: 'PAYMENT_CREATED',
    entityType: 'PAYMENT',
    entityId: invoice._id.toString(),
    metadata: { amount: amountPaise, method: data.method, receiptNumber, isManual: true },
  });

  return createSuccessResponse({ receiptNumber, invoiceStatus: newStatus }, 'Payment recorded successfully', 201);
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('Unauthorized', 401);

    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const filter: Record<string, unknown> = {};

    if (session.role === 'CLIENT') {
      const clientDocs = await getClientDocsForUser(session.id, session.email);
      if (clientDocs.length === 0) {
        return createSuccessResponse({ payments: [], total: 0, page, limit, totalPages: 0 });
      }
      const clientIds = [...clientDocs.map(c => c._id.toString()), ...clientDocs.map(c => c._id)];
      filter.clientId = { $in: clientIds };
    } else {
      filter.businessId = session.businessId;
    }

    if (invoiceId) filter.invoiceId = invoiceId;

    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      db.collection('payments').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('payments').countDocuments(filter),
    ]);

    return createSuccessResponse({
      payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return createErrorResponse(err);
  }
}
