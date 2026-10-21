'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, FilePen, ChevronLeft, ChevronRight, Eye, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toaster';

interface Quotation {
  _id: string;
  quotationNumber: string;
  status: string;
  quotationDate: string;
  expiryDate: string;
  total: number;
  client?: { name: string; email: string; company?: string };
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (status) params.set('status', status);
      const res = await fetch(`/api/quotations?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setQuotations(data.data?.quotations || []);
      setTotal(data.data?.total || 0);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

  const convertToInvoice = async (id: string) => {
    if (!confirm('Convert this quotation to an invoice?')) return;
    setConvertingId(id);
    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'convert', quotationId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast({ title: 'Converted!', description: `Invoice ${data.data?.invoiceNumber} created`, variant: 'success' });
      fetchQuotations();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Conversion failed', variant: 'error' });
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Quotations</h1>
          <p className="text-slate-400 text-sm mt-1">{total} quotations</p>
        </div>
        <Link href="/admin/quotations/new" className="btn btn-primary" id="new-quotation-btn">
          <Plus className="w-4 h-4" /> New Quotation
        </Link>
      </div>

      <div className="metric-card flex items-center gap-2 flex-wrap">
        {['', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'EXPIRED'].map(s => (
          <button
            key={s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${status === s ? 'bg-indigo-500 text-white' : 'bg-[#1e293b] text-slate-400 hover:text-white'}`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="metric-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Quotation</th>
                <th>Client</th>
                <th>Date</th>
                <th>Expiry</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(7)].map((_, j) => <td key={j}><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : quotations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <FilePen className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No quotations found</p>
                  </td>
                </tr>
              ) : quotations.map((q) => (
                <tr key={q._id}>
                  <td className="pl-6 text-sm font-semibold text-indigo-400">{q.quotationNumber}</td>
                  <td>
                    <div className="text-sm text-white">{q.client?.name || '—'}</div>
                    <div className="text-xs text-slate-500">{q.client?.company}</div>
                  </td>
                  <td className="text-sm text-slate-300">{new Date(q.quotationDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="text-sm text-slate-300">{new Date(q.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="text-sm font-bold text-white">₹{(q.total / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                  <td><span className={`status-badge status-${q.status.toLowerCase()}`}>{q.status}</span></td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Link href={`/admin/quotations/${q._id}`} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700" title="View">
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      {q.status !== 'CONVERTED' && (
                        <button
                          onClick={() => convertToInvoice(q._id)}
                          disabled={convertingId === q._id}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-green-400 hover:bg-green-500/10"
                          title="Convert to Invoice"
                        >
                          {convertingId === q._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>
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
