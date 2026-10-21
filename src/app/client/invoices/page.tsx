'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, Download, CreditCard, Search, Loader2 } from 'lucide-react';

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

function formatAmount(paise: number): string {
  return `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function ClientInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        const res = await fetch('/api/invoices?limit=50');
        if (res.ok) {
          const json = await res.json();
          setInvoices(json.data?.invoices || []);
        }
      } catch (err) {
        console.error('Failed to load invoices:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, []);

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(search.toLowerCase());
    const isPaid = (inv.status === 'PAID') && (inv.amountDue <= 0);
    if (statusFilter === 'PAID') return matchesSearch && isPaid;
    if (statusFilter === 'PENDING') return matchesSearch && !isPaid;
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div>
        <h1 className="text-2xl font-black text-white">My Invoices</h1>
        <p className="text-slate-400 text-sm mt-1">View, track, and pay your commercial invoices online.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice number..."
            className="input pl-11 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {['ALL', 'PENDING', 'PAID'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === tab
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-[#1e293b] text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'ALL' ? 'All Invoices' : tab === 'PENDING' ? 'Pending Due' : 'Paid'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="metric-card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-sm">
            No invoices found matching your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Invoice #</th>
                  <th>Date</th>
                  <th>Due Date</th>
                  <th className="text-right">Total Amount</th>
                  <th className="text-right">Balance Due</th>
                  <th>Status</th>
                  <th className="pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((inv) => {
                  const isPaid = (inv.status === 'PAID') && (inv.amountDue <= 0);
                  const displayStatus = isPaid
                    ? 'PAID'
                    : (inv.amountDue > 0 && inv.status === 'PAID')
                    ? 'UNPAID'
                    : (inv.status || 'PENDING');
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
                          {displayStatus}
                        </span>
                      </td>
                      <td className="pr-6 text-right space-x-2">
                        <a
                          href={`/api/invoices/${inv._id}/pdf`}
                          download={`Invoice-${inv.invoiceNumber || inv._id}.pdf`}
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
                            <CreditCard className="w-3.5 h-3.5" /> Pay Now
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
    </div>
  );
}
