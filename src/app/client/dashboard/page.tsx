'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText, CreditCard, Receipt, Clock, CheckCircle,
  AlertTriangle, Download, ArrowRight, Loader2, DollarSign
} from 'lucide-react';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  total: number;
  amountPaid: number;
  amountDue: number;
  status: string;
  invoiceDate: string;
  dueDate: string;
}

interface Payment {
  _id: string;
  receiptNumber: string;
  amount: number;
  method: string;
  paidAt: string;
  invoiceId: string;
}

function formatAmount(paise: number): string {
  return `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function ClientDashboardPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invRes, payRes] = await Promise.all([
          fetch('/api/invoices?limit=10'),
          fetch('/api/payments?limit=5'),
        ]);

        if (invRes.ok) {
          const invData = await invRes.json();
          setInvoices(invData.data?.invoices || []);
        }

        if (payRes.ok) {
          const payData = await payRes.json();
          setPayments(payData.data?.payments || []);
        }
      } catch (err) {
        console.error('Failed to load client data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
  const totalOutstanding = invoices.reduce((sum, inv) => sum + (inv.amountDue || 0), 0);
  const pendingInvoices = invoices.filter(inv => inv.status !== 'PAID' && inv.status !== 'CANCELLED');

  return (
    <div className="space-y-8 animate-fade-in max-w-6xl">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-black text-white">Client Portal</h1>
        <p className="text-slate-400 text-sm mt-1">Review your invoices, payment history, and pay outstanding balances securely.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400 font-medium">Total Invoiced</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white">{formatAmount(totalInvoiced)}</div>
          <div className="text-xs text-slate-500 mt-1">{invoices.length} total invoice(s)</div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400 font-medium">Total Paid</span>
            <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-green-400">{formatAmount(totalPaid)}</div>
          <div className="text-xs text-slate-500 mt-1">{payments.length} verified payment(s)</div>
        </div>

        <div className="metric-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400 font-medium">Outstanding Due</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-400">{formatAmount(totalOutstanding)}</div>
          <div className="text-xs text-slate-500 mt-1">{pendingInvoices.length} pending invoice(s)</div>
        </div>
      </div>

      {/* Pending payments banner */}
      {pendingInvoices.length > 0 && (
        <div className="glass rounded-2xl p-6 border border-amber-500/20 bg-amber-500/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-white font-bold">You have {pendingInvoices.length} pending invoice(s)</h3>
              <p className="text-slate-400 text-xs mt-0.5">Total balance due: <strong className="text-amber-400 font-semibold">{formatAmount(totalOutstanding)}</strong></p>
            </div>
          </div>
          <Link
            href={`/payment/${pendingInvoices[0]._id}`}
            className="btn btn-primary text-sm whitespace-nowrap"
          >
            <CreditCard className="w-4 h-4" /> Pay Now ({pendingInvoices[0].invoiceNumber})
          </Link>
        </div>
      )}

      {/* Invoices Table */}
      <div className="metric-card p-0 overflow-hidden">
        <div className="p-6 border-b border-[#1e293b] flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Your Invoices</h2>
            <p className="text-xs text-slate-400 mt-0.5">Click any invoice to download PDF or pay online</p>
          </div>
          <Link href="/client/invoices" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No invoices found for your account.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Invoice #</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">Balance Due</th>
                  <th>Status</th>
                  <th className="pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const isPaid = inv.status === 'PAID';
                  return (
                    <tr key={inv._id}>
                      <td className="pl-6 font-semibold text-white">{inv.invoiceNumber}</td>
                      <td className="text-slate-400 text-sm">{inv.invoiceDate}</td>
                      <td className="text-slate-400 text-sm">{inv.dueDate}</td>
                      <td className="text-right text-sm font-semibold text-white">{formatAmount(inv.total)}</td>
                      <td className={`text-right text-sm font-bold ${inv.amountDue > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {formatAmount(inv.amountDue)}
                      </td>
                      <td>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isPaid
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : inv.status === 'OVERDUE'
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="pr-6 text-right space-x-2">
                        <a
                          href={`/api/invoices/${inv._id}/pdf`}
                          target="_blank"
                          className="btn btn-secondary text-xs py-1 px-2.5"
                          title="Download PDF"
                        >
                          <Download className="w-3.5 h-3.5" /> PDF
                        </a>
                        {!isPaid && (
                          <Link
                            href={`/payment/${inv._id}`}
                            className="btn btn-primary text-xs py-1 px-2.5"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Pay
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="metric-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white">Recent Payment Receipts</h2>
            <Link href="/client/receipts" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1">
              All Receipts <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {payments.map((p) => (
              <div key={p._id} className="flex items-center justify-between p-3.5 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{p.receiptNumber}</div>
                    <div className="text-xs text-slate-500">{p.method} · {new Date(p.paidAt).toLocaleDateString('en-IN')}</div>
                  </div>
                </div>
                <div className="text-sm font-bold text-green-400">{formatAmount(p.amount)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
