'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, Search, Filter, Download, Eye, Send, MoreVertical, FileText, ChevronLeft, ChevronRight, Loader2, AlertCircle, X } from 'lucide-react';
import { toast } from '@/components/ui/toaster';

interface Invoice {
  _id: string;
  invoiceNumber: string;
  status: string;
  invoiceDate: string;
  dueDate: string;
  total: number;
  amountPaid: number;
  amountDue: number;
  client?: { name: string; email: string; company?: string };
}

const STATUS_OPTIONS = ['ALL', 'DRAFT', 'SENT', 'VIEWED', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'];

function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_STYLES: Record<string, string> = {
  PAID: 'status-paid', SENT: 'status-sent', DRAFT: 'status-draft',
  OVERDUE: 'status-overdue', PARTIALLY_PAID: 'status-partially_paid',
  CANCELLED: 'status-cancelled', VIEWED: 'status-viewed', PENDING: 'status-pending',
};

export default function InvoicesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || 'ALL');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sendingId, setSendingId] = useState<string | null>(null);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search) params.set('search', search);
      if (status && status !== 'ALL') params.set('status', status);

      const res = await fetch(`/api/invoices?${params}`);
      if (!res.ok) throw new Error('Failed to fetch invoices');
      const data = await res.json();
      setInvoices(data.data?.invoices || []);
      setTotal(data.data?.total || 0);
    } catch {
      setError('Failed to load invoices. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchInvoices();
  };

  const handleSendInvoice = async (id: string) => {
    setSendingId(id);
    setError('');
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to send invoice');
      toast({ title: 'Invoice Sent', description: 'Invoice sent to client successfully', variant: 'success' });
      fetchInvoices();
    } catch (err: any) {
      const msg = err.message || 'Failed to send invoice. Check email configuration in .env.local.';
      setError(msg);
      toast({ title: 'Send Failed', description: msg, variant: 'error' });
    } finally {
      setSendingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Invoices</h1>
          <p className="text-slate-400 text-sm mt-1">{total} total invoices</p>
        </div>
        <Link href="/admin/invoices/new" className="btn btn-primary" id="new-invoice-btn">
          <Plus className="w-4 h-4" /> New Invoice
        </Link>
      </div>

      {/* Filters */}
      <div className="metric-card">
        <div className="flex flex-col sm:flex-row gap-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by invoice number..."
                className="input pl-11 text-sm"
                id="invoice-search"
              />
            </div>
            <button type="submit" className="btn btn-secondary text-sm px-3">Search</button>
            {search && <button type="button" onClick={() => { setSearch(''); setPage(1); }} className="btn btn-secondary p-2"><X className="w-4 h-4" /></button>}
          </form>

          <div className="flex gap-2 flex-wrap">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(1); }}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${
                  status === s
                    ? 'bg-indigo-500 text-white'
                    : 'bg-[#1e293b] text-slate-400 hover:text-white'
                }`}
                id={`filter-${s.toLowerCase()}`}
              >
                {s === 'ALL' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="metric-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <input type="checkbox" className="rounded" onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(invoices.map(i => i._id)));
                    else setSelectedIds(new Set());
                  }} />
                </th>
                <th>Invoice</th>
                <th>Client</th>
                <th>Issue Date</th>
                <th>Due Date</th>
                <th>Amount</th>
                <th>Paid</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(9)].map((_, j) => (
                      <td key={j}><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-16">
                    <FileText className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No invoices found</p>
                    <p className="text-slate-600 text-sm mt-1">
                      {search || status !== 'ALL' ? 'Try adjusting your filters' : 'Create your first invoice to get started'}
                    </p>
                    {!search && status === 'ALL' && (
                      <Link href="/admin/invoices/new" className="btn btn-primary text-sm mt-4 inline-flex">
                        <Plus className="w-4 h-4" /> Create Invoice
                      </Link>
                    )}
                  </td>
                </tr>
              ) : invoices.map((invoice) => (
                <tr key={invoice._id} className={selectedIds.has(invoice._id) ? 'bg-indigo-500/5' : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(invoice._id)}
                      onChange={() => toggleSelect(invoice._id)}
                      className="rounded"
                    />
                  </td>
                  <td>
                    <Link href={`/admin/invoices/${invoice._id}`} className="text-indigo-400 hover:text-indigo-300 font-semibold text-sm">
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td>
                    <div className="text-sm text-white font-medium">{invoice.client?.name || '—'}</div>
                    <div className="text-xs text-slate-500">{invoice.client?.company || invoice.client?.email}</div>
                  </td>
                  <td className="text-sm text-slate-300">{formatDate(invoice.invoiceDate)}</td>
                  <td className="text-sm">
                    <span className={new Date(invoice.dueDate) < new Date() && !['PAID', 'CANCELLED'].includes(invoice.status) ? 'text-red-400' : 'text-slate-300'}>
                      {formatDate(invoice.dueDate)}
                    </span>
                  </td>
                  <td className="text-sm font-bold text-white">{formatAmount(invoice.total)}</td>
                  <td className="text-sm text-green-400">{invoice.amountPaid > 0 ? formatAmount(invoice.amountPaid) : '—'}</td>
                  <td>
                    <span className={`status-badge ${STATUS_STYLES[invoice.status] || 'status-draft'}`}>
                      {invoice.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/invoices/${invoice._id}`}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                        title="View"
                        id={`view-invoice-${invoice._id}`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Link>
                      {['DRAFT', 'VIEWED'].includes(invoice.status) && (
                        <button
                          onClick={() => handleSendInvoice(invoice._id)}
                          disabled={sendingId === invoice._id}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                          title="Send"
                          id={`send-invoice-${invoice._id}`}
                        >
                          {sendingId === invoice._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      <a
                        href={`/api/invoices/${invoice._id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"
                        title="Download PDF"
                        id={`download-invoice-${invoice._id}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e293b]">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary p-2 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-secondary p-2 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
