'use client';

import { useState, useEffect, useCallback } from 'react';
import { CreditCard, ChevronLeft, ChevronRight, Search, Download, Loader2 } from 'lucide-react';

interface Payment {
  _id: string;
  receiptNumber: string;
  invoiceId: string;
  amount: number;
  method: string;
  status: string;
  gatewayPaymentId?: string;
  isManual: boolean;
  paidAt: string;
  createdAt: string;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      const res = await fetch(`/api/payments?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setPayments(data.data?.payments || []);
      setTotal(data.data?.total || 0);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white">Payments</h1>
        <p className="text-slate-400 text-sm mt-1">{total} payment records</p>
      </div>

      <div className="metric-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Receipt</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Type</th>
                <th>Status</th>
                <th>Transaction ID</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(7)].map((_, j) => <td key={j}><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <CreditCard className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No payments recorded yet</p>
                    <p className="text-slate-600 text-sm mt-1">Payments will appear here once clients pay invoices</p>
                  </td>
                </tr>
              ) : payments.map((p) => (
                <tr key={p._id}>
                  <td className="pl-6 text-sm font-semibold text-indigo-400">{p.receiptNumber}</td>
                  <td className="text-sm font-bold text-green-400">₹{(p.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="text-sm text-slate-300">{p.method}</td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${p.isManual ? 'text-amber-400 bg-amber-500/10' : 'text-indigo-400 bg-indigo-500/10'}`}>
                      {p.isManual ? 'Manual' : 'Online'}
                    </span>
                  </td>
                  <td><span className={`status-badge status-${p.status.toLowerCase()}`}>{p.status}</span></td>
                  <td className="text-xs text-slate-500 font-mono">{p.gatewayPaymentId || '—'}</td>
                  <td className="text-sm text-slate-300">{new Date(p.paidAt || p.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e293b]">
            <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary p-2 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-secondary p-2 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
