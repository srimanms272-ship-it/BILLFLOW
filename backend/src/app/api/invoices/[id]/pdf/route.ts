import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession, createErrorResponse, ApiError, getClientDocsForUser } from '@/lib/auth-utils';
import { ObjectId } from 'mongodb';
import { generateInvoiceHTML } from '@/lib/invoice-html';

interface Params { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    const { id } = await params;
    const db = await getDb();

    const objectId = new ObjectId(id);

    let invoice;
    if (!session) {
      invoice = await db.collection('invoices').findOne({ _id: objectId });
    } else if (session.role === 'CLIENT') {
      const clientDocs = await getClientDocsForUser(session.id, session.email);
      if (clientDocs.length === 0) throw new ApiError('Client not found', 404);
      const clientIds = [...clientDocs.map(c => c._id.toString()), ...clientDocs.map(c => c._id)];
      invoice = await db.collection('invoices').findOne({
        _id: objectId,
        clientId: { $in: clientIds },
      });
    } else {
      invoice = await db.collection('invoices').findOne({
        _id: objectId,
        businessId: session.businessId,
      });
    }

    if (!invoice) throw new ApiError('Invoice not found', 404);

    const [client, business, payments] = await Promise.all([
      db.collection('clients').findOne({ _id: new ObjectId(invoice.clientId) }),
      db.collection('businesses').findOne({ _id: new ObjectId(invoice.businessId) }),
      db.collection('payments').find({ invoiceId: id, status: 'SUCCESS' }).toArray(),
    ]);

    // Generate HTML invoice for PDF
    const html = generateInvoiceHTML(invoice, client, business, payments);

    // Return HTML that can be printed as PDF
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNumber}.html"`,
      },
    });
  } catch (err) {
    return createErrorResponse(err);
  }
}

