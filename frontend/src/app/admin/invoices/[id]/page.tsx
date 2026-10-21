'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ChevronLeft, Send, Download, CreditCard, Loader2, AlertCircle,
  CheckCircle, Clock, AlertTriangle, Building2, User, Calendar,
  DollarSign, FileText, Edit2, X, Check, Plus
} from 'lucide-react';
import { toast } from '@/components/ui/toaster';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface InvoiceData {
  invoice: any;
  client: any;
  business: any;
  payments: any[];
}

function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
}

const STATUS_INFO: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  PENDING: { label: 'Unpaid / Pending', icon: Clock, className: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  UNPAID: { label: 'Unpaid', icon: Clock, className: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  DRAFT: { label: 'Draft', icon: FileText, className: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  SENT: { label: 'Sent (Unpaid)', icon: Send, className: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  VIEWED: { label: 'Viewed (Unpaid)', icon: CheckCircle, className: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  PARTIALLY_PAID: { label: 'Partially Paid', icon: DollarSign, className: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  PAID: { label: 'Paid', icon: CheckCircle, className: 'text-green-400 bg-green-500/10 border-green-500/20' },
  OVERDUE: { label: 'Overdue', icon: AlertTriangle, className: 'text-red-400 bg-red-500/10 border-red-500/20' },
  CANCELLED: { label: 'Cancelled', icon: X, className: 'text-gray-400 bg-gray-500/10 border-gray-500/20' },
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showManualPayment, setShowManualPayment] = useState(false);
  const [manualPayment, setManualPayment] = useState({ amount: '', method: 'BANK_TRANSFER', notes: '', paidAt: new Date().toISOString().split('T')[0] });

  const fetchInvoice = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invoices/${id}`);
      if (!res.ok) throw new Error('Invoice not found');
      const json = await res.json();
      setData(json.data);
    } catch {
      setError('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (id) fetchInvoice(); }, [id]);

  const handleSend = async () => {
    setActionLoading('send');
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Send failed');
      toast({ title: 'Invoice Sent', description: 'Invoice sent to client successfully', variant: 'success' });
      fetchInvoice();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to send invoice', variant: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this invoice?')) return;
    setActionLoading('cancel');
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Cancel failed');
      toast({ title: 'Invoice Cancelled', variant: 'default' });
      router.push('/admin/invoices');
    } catch {
      toast({ title: 'Error', description: 'Failed to cancel invoice', variant: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('payment');
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'manual',
          invoiceId: id,
          amount: parseFloat(manualPayment.amount),
          method: manualPayment.method,
          notes: manualPayment.notes,
          paidAt: manualPayment.paidAt,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Payment failed');
      toast({ title: 'Payment Recorded', description: `Receipt: ${json.data?.receiptNumber}`, variant: 'success' });
      setShowManualPayment(false);
      fetchInvoice();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Payment failed', variant: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <AlertCircle className="w-12 h-12 text-red-400" />
      <p className="text-white font-bold">{error || 'Invoice not found'}</p>
      <Link href="/admin/invoices" className="btn btn-secondary">Back to Invoices</Link>
    </div>
  );

  const { invoice, client, business, payments } = data;
  const items = (invoice.items as Record<string, unknown>[]) || [];
  const isPaid = (invoice.status === 'PAID') && ((invoice.amountDue ?? 0) <= 0);
  const effectiveStatusKey = isPaid ? 'PAID' : (invoice.status === 'PAID' ? 'PENDING' : (invoice.status as string || 'PENDING'));
  const statusInfo = STATUS_INFO[effectiveStatusKey] || STATUS_INFO.PENDING;
  const StatusIcon = statusInfo.icon;
  const isOverdue = new Date(invoice.dueDate as string) < new Date() && !isPaid && invoice.status !== 'CANCELLED';
  const amountDue = invoice.amountDue as number;
  const amountPaid = invoice.amountPaid as number;
  const total = invoice.total as number;
  const address = client?.billingAddress as Record<string, string>;

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/invoices" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b]">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-white">{invoice.invoiceNumber as string}</h1>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-semibold ${statusInfo.className}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {statusInfo.label}
              </div>
              {isOverdue && <div className="flex items-center gap-1 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-1 rounded-full"><AlertTriangle className="w-3 h-3" /> Overdue</div>}
            </div>
            <p className="text-slate-400 text-sm mt-1">Created {formatDate(invoice.createdAt as string)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['DRAFT', 'SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE', 'PENDING'].includes(invoice.status as string) && (
            <>
              <button
                onClick={handleSend}
                disabled={actionLoading === 'send'}
                className="btn btn-secondary text-sm"
                id="send-invoice-btn"
              >
                {actionLoading === 'send' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
              <button
                onClick={() => setShowManualPayment(true)}
                className="btn btn-secondary text-sm text-green-400"
                id="record-payment-btn"
              >
                <Plus className="w-4 h-4" /> Record Payment
              </button>
              {amountDue > 0 && (
                <Link href={`/payment/${id}`} className="btn btn-primary text-sm" id="pay-online-btn">
                  <CreditCard className="w-4 h-4" /> Pay Online
                </Link>
              )}
            </>
          )}
          <a
            href={`/api/invoices/${id}/pdf`}
            target="_blank"
            className="btn btn-secondary text-sm"
            id="download-pdf-btn"
          >
            <Download className="w-4 h-4" /> PDF
          </a>
          {['DRAFT', 'SENT'].includes(invoice.status as string) && (
            <button
              onClick={handleCancel}
              disabled={actionLoading === 'cancel'}
              className="btn btn-danger text-sm"
              id="cancel-invoice-btn"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main invoice content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice header card */}
          <div className="metric-card">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">From</div>
                <div className="text-sm font-bold text-white">{business?.name as string}</div>
                <div className="text-xs text-slate-400 mt-1">{(business?.address as Record<string, string>)?.line1}</div>
                <div className="text-xs text-slate-400">{(business?.address as Record<string, string>)?.city}, {(business?.address as Record<string, string>)?.state}</div>
                <div className="text-xs text-slate-400">{business?.email as string}</div>
                {business?.gstin && <div className="text-xs text-slate-500 mt-1">GSTIN: {business.gstin as string}</div>}
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Bill To</div>
                <div className="text-sm font-bold text-white">{client?.name as string}</div>
                {client?.company && <div className="text-xs text-indigo-400">{client.company as string}</div>}
                {address && (
                  <>
                    <div className="text-xs text-slate-400 mt-1">{address.line1}</div>
                    <div className="text-xs text-slate-400">{address.city}, {address.state} {address.pincode}</div>
                  </>
                )}
                <div className="text-xs text-slate-400">{client?.email as string}</div>
                {client?.gstin && <div className="text-xs text-slate-500 mt-1">GSTIN: {client.gstin as string}</div>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 bg-[#0f172a] rounded-xl">
              <div>
                <div className="text-xs text-slate-500 mb-1">Invoice Date</div>
                <div className="text-sm font-semibold text-white">{formatDate(invoice.invoiceDate as string)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Due Date</div>
                <div className={`text-sm font-semibold ${isOverdue ? 'text-red-400' : 'text-white'}`}>
                  {formatDate(invoice.dueDate as string)}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">Currency</div>
                <div className="text-sm font-semibold text-white">{invoice.currency as string}</div>
              </div>
            </div>
          </div>

          {/* Items table */}
          <div className="metric-card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pl-6">#</th>
                    <th>Description</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Discount</th>
                    <th className="text-right">Tax</th>
                    <th className="text-right pr-6">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="pl-6 text-slate-500">{idx + 1}</td>
                      <td>
                        <div className="text-sm text-white font-medium">{item.description as string}</div>
                        {item.unit && <div className="text-xs text-slate-500">{item.unit as string}</div>}
                      </td>
                      <td className="text-right text-sm">{item.quantity as number}</td>
                      <td className="text-right text-sm">₹{((item.unitPrice as number) / 100).toFixed(2)}</td>
                      <td className="text-right text-sm">{item.discount as number}%</td>
                      <td className="text-right text-sm">{item.taxRate as number}%</td>
                      <td className="text-right text-sm font-semibold text-white pr-6">₹{((item.total as number) / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end p-6">
              <div className="w-64 space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span>{formatAmount(invoice.subtotal as number)}</span>
                </div>
                {(invoice.discountAmount as number) > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Discount</span>
                    <span className="text-red-400">-{formatAmount(invoice.discountAmount as number)}</span>
                  </div>
                )}
                {(invoice.cgstAmount as number) > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>CGST</span><span>{formatAmount(invoice.cgstAmount as number)}</span>
                  </div>
                )}
                {(invoice.sgstAmount as number) > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>SGST</span><span>{formatAmount(invoice.sgstAmount as number)}</span>
                  </div>
                )}
                {(invoice.igstAmount as number) > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>IGST</span><span>{formatAmount(invoice.igstAmount as number)}</span>
                  </div>
                )}
                <div className="border-t border-[#334155] pt-2">
                  <div className="flex justify-between font-black text-base">
                    <span className="text-white">Total</span>
                    <span className="gradient-text">{formatAmount(total)}</span>
                  </div>
                </div>
                {amountPaid > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Amount Paid</span><span>{formatAmount(amountPaid)}</span>
                  </div>
                )}
                {amountDue > 0 && (
                  <div className="flex justify-between text-red-400 font-bold">
                    <span>Amount Due</span><span>{formatAmount(amountDue)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.termsAndConditions) && (
            <div className="metric-card space-y-4">
              {invoice.notes && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Notes</div>
                  <p className="text-sm text-slate-300">{invoice.notes as string}</p>
                </div>
              )}
              {invoice.termsAndConditions && (
                <div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Terms & Conditions</div>
                  <p className="text-sm text-slate-400">{invoice.termsAndConditions as string}</p>
                </div>
              )}
            </div>
          )}

          {/* Payment History */}
          {payments.length > 0 && (
            <div className="metric-card">
              <h3 className="text-sm font-semibold text-white mb-4">Payment History</h3>
              <div className="space-y-2">
                {payments.map((payment: Record<string, unknown>) => (
                  <div key={payment._id as string} className="flex items-center justify-between p-3 rounded-xl bg-[#0f172a]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{payment.receiptNumber as string}</div>
                        <div className="text-xs text-slate-500">{payment.method as string} · {new Date(payment.paidAt as string || payment.createdAt as string).toLocaleDateString('en-IN')}</div>
                      </div>
                    </div>
                    <div className="text-sm font-bold text-green-400">{formatAmount(payment.amount as number)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column - actions */}
        <div className="space-y-4">
          {/* Amount summary */}
          <div className="metric-card">
            <h3 className="text-sm font-semibold text-white mb-4">Payment Status</h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-400">Invoice Total</span>
                  <span className="text-white font-bold">{formatAmount(total)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#1e293b] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all"
                    style={{ width: `${total > 0 ? (amountPaid / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Paid</span>
                <span className="text-green-400 font-semibold">{formatAmount(amountPaid)}</span>
              </div>
              {amountDue > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Remaining</span>
                  <span className="text-red-400 font-semibold">{formatAmount(amountDue)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Quick actions */}
          <div className="metric-card">
            <h3 className="text-sm font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <a href={`/api/invoices/${id}/pdf`} target="_blank" className="w-full btn btn-secondary text-sm justify-center">
                <Download className="w-4 h-4" /> Download PDF
              </a>
              {amountDue > 0 && (
                <Link href={`/payment/${id}`} className="w-full btn btn-primary text-sm justify-center">
                  <CreditCard className="w-4 h-4" /> Pay Online
                </Link>
              )}
              {client?.email && (
                <a href={`mailto:${client.email}?subject=Invoice ${invoice.invoiceNumber}&body=Please find your invoice attached.`} className="w-full btn btn-secondary text-sm justify-center">
                  <Send className="w-4 h-4" /> Email Client
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Manual Payment Dialog */}
      {showManualPayment && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-white mb-6">Record Manual Payment</h3>
            <form onSubmit={handleManualPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Amount (₹) — Max: ₹{(amountDue / 100).toFixed(2)}
                </label>
                <input
                  type="number" min="0.01" max={amountDue / 100} step="0.01"
                  value={manualPayment.amount}
                  onChange={(e) => setManualPayment(p => ({ ...p, amount: e.target.value }))}
                  className="input text-sm" placeholder={`${(amountDue / 100).toFixed(2)}`} required
                  id="manual-payment-amount"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Payment Method</label>
                <select value={manualPayment.method} onChange={(e) => setManualPayment(p => ({ ...p, method: e.target.value }))} className="input text-sm" id="manual-payment-method">
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="UPI">UPI</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Payment Date</label>
                <input type="date" value={manualPayment.paidAt} onChange={(e) => setManualPayment(p => ({ ...p, paidAt: e.target.value }))} className="input text-sm" required id="manual-payment-date" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Notes (optional)</label>
                <input type="text" value={manualPayment.notes} onChange={(e) => setManualPayment(p => ({ ...p, notes: e.target.value }))} className="input text-sm" placeholder="Reference number, check number..." id="manual-payment-notes" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={actionLoading === 'payment'} className="btn btn-primary flex-1" id="submit-manual-payment">
                  {actionLoading === 'payment' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Record Payment
                </button>
                <button type="button" onClick={() => setShowManualPayment(false)} className="btn btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
