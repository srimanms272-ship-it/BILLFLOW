import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { createAuditLog } from '@/lib/auth-utils';
import { generateReceiptNumber } from '@/lib/calculations';
import { sendPaymentReceiptEmail } from '@/lib/email';
import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { format } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature');
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('RAZORPAY_WEBHOOK_SECRET not set');
      return new Response('OK', { status: 200 }); // Always return 200 to Razorpay
    }

    // Verify webhook signature
    if (signature) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');

      if (expectedSignature !== signature) {
        console.error('Invalid webhook signature');
        return new Response('OK', { status: 200 }); // Return 200 but don't process
      }
    }

    const event = JSON.parse(body);
    const db = await getDb();

    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload.payment.entity;
        const orderId = payment.order_id;
        const paymentId = payment.id;
        const amount = payment.amount;

        // Check for duplicate webhook
        const existingPayment = await db.collection('payments').findOne({ gatewayPaymentId: paymentId });
        if (existingPayment) {
          console.log('Duplicate webhook, skipping:', paymentId);
          break;
        }

        // Find the invoice from the order notes
        const invoiceId = payment.notes?.invoiceId;
        const businessId = payment.notes?.businessId;
        if (!invoiceId || !businessId) break;

        const invoice = await db.collection('invoices').findOne({
          _id: new ObjectId(invoiceId),
          businessId,
        });
        if (!invoice) break;
        if (['PAID', 'CANCELLED'].includes(invoice.status)) break;

        const receiptNumber = await generateReceiptNumber(businessId);
        const now = new Date();

        // Create payment record
        await db.collection('payments').insertOne({
          businessId,
          clientId: invoice.clientId,
          invoiceId,
          receiptNumber,
          amount,
          currency: payment.currency,
          method: 'RAZORPAY',
          status: 'SUCCESS',
          gatewayOrderId: orderId,
          gatewayPaymentId: paymentId,
          gatewayResponse: payment,
          isManual: false,
          paidAt: now,
          createdAt: now,
          updatedAt: now,
        });

        // Update invoice
        const newAmountPaid = invoice.amountPaid + amount;
        const newAmountDue = invoice.total - newAmountPaid;
        const newStatus = newAmountDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';

        await db.collection('invoices').updateOne(
          { _id: new ObjectId(invoiceId) },
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

        await createAuditLog({
          userId: 'WEBHOOK',
          businessId,
          action: 'PAYMENT_VERIFIED',
          entityType: 'PAYMENT',
          entityId: paymentId,
          metadata: { invoiceId, amount, receiptNumber, source: 'webhook' },
        });

        // Send receipt email
        try {
          const [client, business] = await Promise.all([
            db.collection('clients').findOne({ _id: new ObjectId(invoice.clientId) }),
            db.collection('businesses').findOne({ _id: new ObjectId(businessId) }),
          ]);

          if (client && business) {
            const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
            await sendPaymentReceiptEmail(
              client.email,
              client.name,
              receiptNumber,
              invoice.invoiceNumber,
              `₹${(amount / 100).toFixed(2)}`,
              'Razorpay',
              paymentId,
              format(now, 'dd MMM yyyy'),
              business.name,
              `${APP_URL}/client/receipts`
            );
          }
        } catch (e) {
          console.error('Webhook receipt email error:', e);
        }
        break;
      }

      case 'payment.failed': {
        const payment = event.payload.payment.entity;
        const invoiceId = payment.notes?.invoiceId;
        const businessId = payment.notes?.businessId;
        if (!invoiceId || !businessId) break;

        await db.collection('payments').insertOne({
          businessId,
          clientId: (await db.collection('invoices').findOne({ _id: new ObjectId(invoiceId) }))?.clientId,
          invoiceId,
          receiptNumber: `FAILED-${payment.id}`,
          amount: payment.amount,
          currency: payment.currency,
          method: 'RAZORPAY',
          status: 'FAILED',
          gatewayOrderId: payment.order_id,
          gatewayPaymentId: payment.id,
          gatewayResponse: payment,
          isManual: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await createAuditLog({
          userId: 'WEBHOOK',
          businessId,
          action: 'PAYMENT_FAILED',
          entityType: 'PAYMENT',
          entityId: payment.id,
          metadata: { invoiceId, reason: payment.error_description },
        });
        break;
      }

      case 'refund.created': {
        const refund = event.payload.refund.entity;
        await db.collection('payments').updateOne(
          { gatewayPaymentId: refund.payment_id },
          {
            $set: {
              status: 'REFUNDED',
              refundedAt: new Date(),
              refundAmount: refund.amount,
              updatedAt: new Date(),
            },
          }
        );
        break;
      }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response('OK', { status: 200 }); // Always return 200
  }
}
