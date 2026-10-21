'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Receipt, CheckCircle, ExternalLink, Loader2, Download } from 'lucide-react';

interface Payment {
  _id: string;
  receiptNumber: string;
  invoiceId: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  gatewayPaymentId?: string;
  paidAt: string;
}

function formatAmount(paise: number): string {
  return `₹${((paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

export default function ClientReceiptsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const res = await fetch('/api/payments?limit=50');
        if (res.ok) {
          const json = await res.json();
          setPayments(json.data?.payments || []);
        }
      } catch (err) {
        console.error('Failed to load receipts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPayments();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div>
        <h1 className="text-2xl font-black text-white">Payment Receipts</h1>
        <p className="text-slate-400 text-sm mt-1">Official records and transaction confirmations for all your payments.</p>
      </div>

      <div className="metric-card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        ) : payments.length === 0 ? (
          <div className="p-16 text-center text-slate-500 text-sm">
            No payment receipts found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="pl-6">Receipt #</th>
                  <th>Date</th>
                  <th>Payment Method</th>
                  <th>Transaction ID</th>
                  <th>Status</th>
                  <th className="text-right">Amount Paid</th>
                  <th className="pr-6 text-right">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td className="pl-6 font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-indigo-400" />
                        <span>{p.receiptNumber}</span>
                      </div>
                    </td>
                    <td className="text-slate-400 text-sm">{new Date(p.paidAt).toLocaleDateString('en-IN')}</td>
                    <td className="text-slate-300 text-sm font-medium">{p.method}</td>
                    <td className="text-slate-400 font-mono text-xs">{p.gatewayPaymentId || 'Direct Settlement'}</td>
                    <td>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/10 text-green-400 border border-green-500/20">
                        <CheckCircle className="w-3 h-3" /> {p.status}
                      </span>
                    </td>
                    <td className="text-right text-sm font-bold text-green-400">{formatAmount(p.amount)}</td>
                    <td className="pr-6 text-right">
                      {p.invoiceId && (
                        <a
                          href={`/api/invoices/${p.invoiceId}/pdf`}
                          download={`Invoice-${p.invoiceId}.pdf`}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1"
                        >
                          Invoice PDF <Download className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
