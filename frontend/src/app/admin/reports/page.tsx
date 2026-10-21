'use client';

import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, FileText, DollarSign, AlertTriangle, RefreshCw, Download, Loader2 } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

type ReportType = 'revenue' | 'invoices' | 'outstanding' | 'expenses' | 'profit' | 'gst';

const REPORT_TYPES: { id: ReportType; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'revenue', label: 'Revenue', icon: TrendingUp, description: 'Payment collections over time' },
  { id: 'invoices', label: 'Invoices', icon: FileText, description: 'Invoice creation and status' },
  { id: 'outstanding', label: 'Outstanding', icon: AlertTriangle, description: 'Pending and overdue invoices' },
  { id: 'expenses', label: 'Expenses', icon: DollarSign, description: 'Expense tracking by category' },
  { id: 'profit', label: 'Profit & Loss', icon: BarChart3, description: 'Revenue vs expenses' },
  { id: 'gst', label: 'GST Summary', icon: FileText, description: 'GST collected breakdown' },
];

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

function formatAmount(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(1)}Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toFixed(0)}`;
}

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('revenue');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const thisYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${thisYear}-01-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ type: reportType, startDate, endDate });
      const res = await fetch(`/api/reports?${params}`);
      if (!res.ok) throw new Error('Failed to fetch report');
      const json = await res.json();
      setData(json.data);
    } catch {
      setError('Failed to load report data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [reportType, startDate, endDate]);

  const exportCSV = () => {
    if (!data) return;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}-report-${startDate}-${endDate}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (!active || !(payload as unknown[])?.length) return null;
    return (
      <div className="glass rounded-xl p-3 border border-white/10 text-sm">
        <p className="text-slate-400 mb-1">{label as string}</p>
        {(payload as Array<{ name: string; value: number; fill?: string }>).map((p, i) => (
          <p key={i} className="font-bold" style={{ color: p.fill || '#6366f1' }}>
            {p.name}: {typeof p.value === 'number' && p.value > 100 ? formatAmount(p.value) : p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Reports</h1>
          <p className="text-slate-400 text-sm mt-1">Business performance analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchReport} className="btn btn-secondary p-2" disabled={loading} id="refresh-report">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={exportCSV} className="btn btn-secondary text-sm" id="export-report">
            <Download className="w-4 h-4" /> Export
          </button>
        </div>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {REPORT_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => setReportType(type.id)}
            className={`metric-card card-hover text-left transition-all ${reportType === type.id ? 'border-indigo-500/50 bg-indigo-500/10' : ''}`}
            id={`report-${type.id}`}
          >
            <type.icon className={`w-5 h-5 mb-2 ${reportType === type.id ? 'text-indigo-400' : 'text-slate-500'}`} />
            <div className={`text-sm font-semibold ${reportType === type.id ? 'text-indigo-400' : 'text-white'}`}>{type.label}</div>
            <div className="text-xs text-slate-600 mt-1 hidden sm:block">{type.description}</div>
          </button>
        ))}
      </div>

      {/* Date filters */}
      <div className="metric-card flex items-center gap-4 flex-wrap">
        <span className="text-sm text-slate-400">Date Range:</span>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input text-sm py-2 w-auto" id="report-start-date" />
        <span className="text-slate-500 text-sm">to</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input text-sm py-2 w-auto" id="report-end-date" />
        {[
          { label: 'This Month', fn: () => { const n = new Date(); setStartDate(`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-01`); setEndDate(n.toISOString().split('T')[0]); } },
          { label: 'This Year', fn: () => { const n = new Date(); setStartDate(`${n.getFullYear()}-01-01`); setEndDate(n.toISOString().split('T')[0]); } },
          { label: 'Last Year', fn: () => { const y = new Date().getFullYear()-1; setStartDate(`${y}-01-01`); setEndDate(`${y}-12-31`); } },
        ].map(preset => (
          <button key={preset.label} onClick={preset.fn} className="text-xs px-3 py-1.5 rounded-full bg-[#1e293b] text-slate-400 hover:text-white">{preset.label}</button>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <p className="text-slate-400 text-sm">Generating report...</p>
          </div>
        </div>
      ) : data && (
        <div className="space-y-6">
          {/* Revenue Report */}
          {reportType === 'revenue' && (() => {
            const summary = data.summary as Record<string, number>;
            const byMonth = data.byMonth as Array<{ period: string; revenue: number; count: number }>;
            const byMethod = data.byMethod as Array<{ _id: string; total: number; count: number }>;

            return (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="metric-card">
                    <div className="text-slate-400 text-sm mb-1">Total Collected</div>
                    <div className="text-3xl font-black gradient-text">{formatAmount(summary?.total || 0)}</div>
                    <div className="text-xs text-slate-500 mt-1">{summary?.count || 0} payments</div>
                  </div>
                  <div className="metric-card">
                    <div className="text-slate-400 text-sm mb-1">Avg Payment</div>
                    <div className="text-3xl font-black gradient-text">{formatAmount(summary?.count > 0 ? summary.total / summary.count : 0)}</div>
                    <div className="text-xs text-slate-500 mt-1">per transaction</div>
                  </div>
                </div>

                <div className="metric-card">
                  <h3 className="text-base font-bold text-white mb-4">Monthly Revenue</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={byMonth}>
                      <defs><linearGradient id="grad1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} /><stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAmount(v)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366f1" strokeWidth={2} fill="url(#grad1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {byMethod && byMethod.length > 0 && (
                  <div className="metric-card">
                    <h3 className="text-base font-bold text-white mb-4">Revenue by Payment Method</h3>
                    <div className="grid grid-cols-2 gap-6">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie data={byMethod} dataKey="total" nameKey="_id" cx="50%" cy="50%" outerRadius={80} paddingAngle={3}>
                            {byMethod.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: any) => formatAmount(Number(v) || 0)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {byMethod.map((m, i) => (
                          <div key={m._id} className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            <div className="flex-1">
                              <div className="text-sm text-white font-medium">{m._id}</div>
                              <div className="text-xs text-slate-500">{m.count} payments</div>
                            </div>
                            <div className="text-sm font-bold text-white">{formatAmount(m.total)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Profit & Loss */}
          {reportType === 'profit' && (() => {
            const summary = data.summary as Record<string, number>;
            const byMonth = data.byMonth as Array<{ period: string; revenue: number; expenses: number; profit: number }>;

            return (
              <>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Total Revenue', value: summary?.totalRevenue || 0, color: 'text-green-400' },
                    { label: 'Total Expenses', value: summary?.totalExpenses || 0, color: 'text-red-400' },
                    { label: 'Net Profit', value: summary?.profit || 0, color: (summary?.profit || 0) >= 0 ? 'text-indigo-400' : 'text-red-400' },
                  ].map(item => (
                    <div key={item.label} className="metric-card">
                      <div className="text-slate-400 text-sm mb-1">{item.label}</div>
                      <div className={`text-2xl font-black ${item.color}`}>{formatAmount(item.value)}</div>
                    </div>
                  ))}
                </div>
                <div className="metric-card">
                  <h3 className="text-base font-bold text-white mb-4">Monthly Profit & Loss</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={byMonth}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatAmount(v)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Profit" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            );
          })()}

          {/* GST Summary */}
          {reportType === 'gst' && (() => {
            const gst = data.gstSummary as Record<string, number>;
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'CGST Collected', value: gst?.totalCgst || 0 },
                  { label: 'SGST Collected', value: gst?.totalSgst || 0 },
                  { label: 'IGST Collected', value: gst?.totalIgst || 0 },
                  { label: 'Total Tax', value: gst?.totalTax || 0 },
                ].map(item => (
                  <div key={item.label} className="metric-card">
                    <div className="text-slate-400 text-sm mb-1">{item.label}</div>
                    <div className="text-2xl font-black gradient-text">{formatAmount(item.value)}</div>
                    <div className="text-xs text-slate-500 mt-1">₹{(item.value / 100).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Outstanding */}
          {reportType === 'outstanding' && (() => {
            const invoices = data.invoices as Array<Record<string, unknown>>;
            return (
              <div className="metric-card overflow-hidden p-0">
                <div className="p-4 flex items-center justify-between border-b border-[#1e293b]">
                  <h3 className="text-base font-bold text-white">Outstanding Invoices</h3>
                  <div className="text-sm text-red-400 font-semibold">{formatAmount((data.total as number) || 0)} outstanding</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Client</th>
                        <th>Due Date</th>
                        <th>Days Overdue</th>
                        <th>Amount Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices?.map((inv) => (
                        <tr key={inv._id as string}>
                          <td className="font-semibold text-indigo-400">{inv.invoiceNumber as string}</td>
                          <td className="text-sm">{(inv.client as Record<string, string>)?.name || '—'}</td>
                          <td className="text-sm text-red-400">{new Date(inv.dueDate as string).toLocaleDateString('en-IN')}</td>
                          <td className="text-sm text-red-400">{Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate as string).getTime()) / (1000 * 60 * 60 * 24)))} days</td>
                          <td className="text-sm font-bold text-red-400">{formatAmount(inv.amountDue as number)}</td>
                          <td><span className={`status-badge status-${(inv.status as string).toLowerCase()}`}>{inv.status as string}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* Expenses */}
          {reportType === 'expenses' && (() => {
            const summary = data.summary as Record<string, number>;
            const byCategory = data.byCategory as Array<{ _id: string; total: number; count: number }>;
            const byMonth = data.byMonth as Array<{ period: string; total: number; count: number }>;

            return (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="metric-card"><div className="text-slate-400 text-sm mb-1">Total Expenses</div><div className="text-3xl font-black text-red-400">{formatAmount(summary?.total || 0)}</div><div className="text-xs text-slate-500 mt-1">{summary?.count || 0} items</div></div>
                  <div className="metric-card"><div className="text-slate-400 text-sm mb-1">Categories</div><div className="text-3xl font-black gradient-text">{byCategory?.length || 0}</div></div>
                </div>
                <div className="metric-card">
                  <h3 className="text-base font-bold text-white mb-4">Expenses by Category</h3>
                  <div className="space-y-3">
                    {byCategory?.map((cat, i) => {
                      const maxTotal = Math.max(...(byCategory || []).map(c => c.total));
                      return (
                        <div key={cat._id} className="flex items-center gap-4">
                          <div className="w-28 text-xs text-slate-400 truncate">{cat._id}</div>
                          <div className="flex-1 h-2 rounded-full bg-[#1e293b] overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(cat.total / maxTotal) * 100}%`, background: COLORS[i % COLORS.length] }} />
                          </div>
                          <div className="text-sm font-semibold text-white w-20 text-right">{formatAmount(cat.total)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}

          {/* Invoices Report */}
          {reportType === 'invoices' && (() => {
            const byStatus = data.byStatus as Array<{ _id: string; count: number; total: number }>;
            return (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {byStatus?.map((s) => (
                    <div key={s._id} className="metric-card">
                      <div className="text-slate-400 text-sm mb-1">{s._id}</div>
                      <div className="text-2xl font-black text-white">{s.count}</div>
                      <div className="text-xs text-slate-500 mt-1">{formatAmount(s.total)}</div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
