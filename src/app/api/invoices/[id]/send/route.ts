import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, createErrorResponse, createSuccessResponse, createAuditLog, ApiError } from '@/lib/auth-utils';
import { sendInvoiceEmail } from '@/lib/email';
import { formatCurrency } from '@/lib/calculations';
import { generateInvoiceHTML } from '@/lib/invoice-html';
import { ObjectId } from 'mongodb';
import { format } from 'date-fns';

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    const db = await getDb();

    const objectId = new ObjectId(id);
    const invoice = await db.collection('invoices').findOne({
      _id: objectId,
      businessId: user.businessId,
    });
    if (!invoice) throw new ApiError('Invoice not found', 404);
    if (invoice.status === 'PAID') throw new ApiError('Invoice is already paid', 400);
    if (invoice.status === 'CANCELLED') throw new ApiError('Cannot send cancelled invoice', 400);

    let clientObjectId: ObjectId | string;
    try {
      clientObjectId = new ObjectId(invoice.clientId);
    } catch {
      clientObjectId = invoice.clientId;
    }

    const [client, business, payments] = await Promise.all([
      db.collection('clients').findOne({
        $or: [{ _id: clientObjectId }, { _id: invoice.clientId }],
      }),
      db.collection('businesses').findOne({ _id: new ObjectId(user.businessId) }),
      db.collection('payments').find({ invoiceId: id, status: 'SUCCESS' }).toArray(),
    ]);

    if (!client) throw new ApiError('Client not found', 404);
    if (!client.email) throw new ApiError('Client does not have an email address configured', 400);
    if (!business) throw new ApiError('Business not found', 404);

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const viewUrl = `${APP_URL}/invoice/view/${invoice.publicToken}`;
    const payUrl = `${APP_URL}/payment/${id}`;

    // Generate printable invoice HTML for attachment
    const invoiceHtml = generateInvoiceHTML(invoice, client, business, payments);

    // Send email with error handling
    try {
      console.log(`[Send Invoice] Initiating email for Invoice #${invoice.invoiceNumber} to ${client.email}...`);
      await sendInvoiceEmail(
        client.email,
        client.name,
        invoice.invoiceNumber,
        formatCurrency(invoice.total, invoice.currency),
        format(new Date(invoice.dueDate), 'dd MMM yyyy'),
        business.name,
        viewUrl,
        payUrl,
        {
          filename: `Invoice-${invoice.invoiceNumber}.html`,
          content: invoiceHtml,
          contentType: 'text/html',
        }
      );
      console.log(`[Send Invoice] Email delivered successfully to ${client.email}`);
    } catch (emailErr: any) {
      console.error('\n========================================');
      console.error('❌ [INVOICE EMAIL DELIVERY FAILED]');
      console.error(`Invoice #: ${invoice.invoiceNumber}`);
      console.error(`Recipient: ${client.email}`);
      console.error(`Reason: ${emailErr.message || emailErr}`);
      console.error('========================================\n');

      const errorDetail = emailErr.message || 'SMTP delivery failed';
      throw new ApiError(
        `Failed to send email to ${client.email}: ${errorDetail}`,
        500
      );
    }

    // Update invoice status
    await db.collection('invoices').updateOne(
      { _id: objectId, businessId: user.businessId },
      {
        $set: {
          status: invoice.status === 'DRAFT' ? 'SENT' : invoice.status,
          sentAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Schedule reminders
    const reminderDaysBefore = business.settings?.reminderDaysBefore || [3, 7];
    const reminderDaysAfter = business.settings?.reminderDaysAfter || [1, 3, 7];
    const dueDate = new Date(invoice.dueDate);

    const reminders = [
      ...reminderDaysBefore.map((days: number) => ({
        businessId: user.businessId,
        invoiceId: id,
        clientId: invoice.clientId,
        type: 'BEFORE_DUE',
        daysOffset: days,
        scheduledFor: new Date(dueDate.getTime() - days * 24 * 60 * 60 * 1000),
        isSent: false,
        createdAt: new Date(),
      })),
      {
        businessId: user.businessId,
        invoiceId: id,
        clientId: invoice.clientId,
        type: 'ON_DUE',
        daysOffset: 0,
        scheduledFor: dueDate,
        isSent: false,
        createdAt: new Date(),
      },
      ...reminderDaysAfter.map((days: number) => ({
        businessId: user.businessId,
        invoiceId: id,
        clientId: invoice.clientId,
        type: 'AFTER_DUE',
        daysOffset: days,
        scheduledFor: new Date(dueDate.getTime() + days * 24 * 60 * 60 * 1000),
        isSent: false,
        createdAt: new Date(),
      })),
    ].filter(r => new Date(r.scheduledFor) > new Date());

    if (reminders.length > 0) {
      // Remove old reminders, insert new ones
      await db.collection('invoiceReminders').deleteMany({ invoiceId: id, isSent: false });
      await db.collection('invoiceReminders').insertMany(reminders);
    }

    await createAuditLog({
      userId: user.id,
      businessId: user.businessId,
      action: 'INVOICE_SENT',
      entityType: 'INVOICE',
      entityId: id,
      metadata: { clientEmail: client.email },
    });

    return createSuccessResponse(null, 'Invoice sent successfully');
  } catch (err) {
    return createErrorResponse(err);
  }
}
