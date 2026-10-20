import { paiseToRupees } from '@/lib/calculations';
import { format } from 'date-fns';

export function generateInvoiceHTML(
  invoice: Record<string, unknown>,
  client: Record<string, unknown> | null,
  business: Record<string, unknown> | null,
  payments: Record<string, unknown>[] = []
): string {
  const items = (invoice.items as Record<string, unknown>[]) || [];
  const address = (business?.address as Record<string, string>) || {};
  const billingAddress = (client?.billingAddress as Record<string, string>) || {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #fff; color: #1e293b; font-size: 13px; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .logo { font-size: 24px; font-weight: 800; color: #6366f1; }
    .invoice-label { text-align: right; }
    .invoice-number { font-size: 28px; font-weight: 800; color: #1e293b; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .status-paid { background: #dcfce7; color: #166534; }
    .status-overdue { background: #fee2e2; color: #991b1b; }
    .status-sent { background: #dbeafe; color: #1e40af; }
    .status-draft { background: #f1f5f9; color: #475569; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
    .info-section h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
    .info-section p { color: #1e293b; line-height: 1.6; }
    .dates-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 40px; background: #f8fafc; padding: 20px; border-radius: 8px; }
    .date-item label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; display: block; margin-bottom: 4px; }
    .date-item span { font-weight: 600; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    th { background: #1e293b; color: #f8fafc; padding: 12px 16px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #fafafa; }
    .text-right { text-align: right; }
    .totals { width: 300px; margin-left: auto; }
    .totals table { margin-bottom: 0; }
    .totals td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
    .total-row td { background: #6366f1; color: #fff; font-weight: 700; font-size: 15px; }
    .notes { margin-top: 40px; padding: 20px; background: #f8fafc; border-radius: 8px; }
    .notes h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; color: #94a3b8; font-size: 11px; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .container { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="logo">${business?.name || 'BillFlow'}</div>
        <p style="color:#64748b;margin-top:4px;">${address.line1 || ''} ${address.city || ''}</p>
        <p style="color:#64748b;">${business?.email || ''} | ${business?.phone || ''}</p>
        ${business?.gstin ? `<p style="color:#64748b;">GSTIN: ${business.gstin}</p>` : ''}
      </div>
      <div class="invoice-label">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:4px;">INVOICE</div>
        <div class="invoice-number">#${invoice.invoiceNumber}</div>
        <div style="margin-top:8px;">
          <span class="status-badge status-${(invoice.status as string || 'draft').toLowerCase()}">${invoice.status || 'DRAFT'}</span>
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-section">
        <h3>Bill To</h3>
        <p><strong>${client?.name || ''}</strong></p>
        ${client?.company ? `<p>${client.company}</p>` : ''}
        <p>${billingAddress.line1 || ''}</p>
        <p>${billingAddress.city || ''}, ${billingAddress.state || ''} ${billingAddress.pincode || ''}</p>
        <p>${client?.email || ''}</p>
        ${client?.gstin ? `<p>GSTIN: ${client.gstin}</p>` : ''}
      </div>
    </div>

    <div class="dates-grid">
      <div class="date-item">
        <label>Invoice Date</label>
        <span>${invoice.invoiceDate ? format(new Date(invoice.invoiceDate as string), 'dd MMM yyyy') : '-'}</span>
      </div>
      <div class="date-item">
        <label>Due Date</label>
        <span>${invoice.dueDate ? format(new Date(invoice.dueDate as string), 'dd MMM yyyy') : '-'}</span>
      </div>
      <div class="date-item">
        <label>Currency</label>
        <span>${invoice.currency || 'INR'}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Discount</th>
          <th class="text-right">Tax</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${item.description}</td>
            <td class="text-right">${item.quantity} ${item.unit || ''}</td>
            <td class="text-right">₹${paiseToRupees(item.unitPrice as number).toFixed(2)}</td>
            <td class="text-right">${item.discount || 0}%</td>
            <td class="text-right">${item.taxRate || 0}%</td>
            <td class="text-right">₹${paiseToRupees(item.total as number).toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <table>
        <tr><td>Subtotal</td><td class="text-right">₹${paiseToRupees(invoice.subtotal as number).toFixed(2)}</td></tr>
        ${Number(invoice.discountAmount) > 0 ? `<tr><td>Discount</td><td class="text-right">-₹${paiseToRupees(invoice.discountAmount as number).toFixed(2)}</td></tr>` : ''}
        ${Number(invoice.cgstAmount) > 0 ? `<tr><td>CGST</td><td class="text-right">₹${paiseToRupees(invoice.cgstAmount as number).toFixed(2)}</td></tr>` : ''}
        ${Number(invoice.sgstAmount) > 0 ? `<tr><td>SGST</td><td class="text-right">₹${paiseToRupees(invoice.sgstAmount as number).toFixed(2)}</td></tr>` : ''}
        ${Number(invoice.igstAmount) > 0 ? `<tr><td>IGST</td><td class="text-right">₹${paiseToRupees(invoice.igstAmount as number).toFixed(2)}</td></tr>` : ''}
        <tr class="total-row"><td>Total</td><td class="text-right">₹${paiseToRupees(invoice.total as number).toFixed(2)}</td></tr>
        ${Number(invoice.amountPaid) > 0 ? `<tr><td>Amount Paid</td><td class="text-right" style="color:#22c55e;">₹${paiseToRupees(invoice.amountPaid as number).toFixed(2)}</td></tr>` : ''}
        ${Number(invoice.amountDue) > 0 ? `<tr><td><strong>Amount Due</strong></td><td class="text-right" style="color:#ef4444;font-weight:700;">₹${paiseToRupees(invoice.amountDue as number).toFixed(2)}</td></tr>` : ''}
      </table>
    </div>

    ${invoice.notes ? `<div class="notes"><h3>Notes</h3><p>${invoice.notes}</p></div>` : ''}
    ${invoice.termsAndConditions ? `<div class="notes" style="margin-top:16px;"><h3>Terms & Conditions</h3><p>${invoice.termsAndConditions}</p></div>` : ''}

    <div class="footer">
      <p>Thank you for your business!</p>
      <p style="margin-top:4px;">Generated by BillFlow · ${business?.name || ''}</p>
    </div>
  </div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}
