'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, DollarSign, FileText,
  Users, CreditCard, AlertCircle, Clock, ArrowUpRight,
  RefreshCw, Plus, Eye, Loader2, BarChart2, Activity
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';

interface DashboardData {
  summary: {
    totalInvoiced: number; totalPaid: number; totalOutstanding: number;
    totalOverdue: number; totalExpenses: number; profit: number;
    clientCount: number; invoiceCount: number; paymentCount: number;
  };
  invoicesByStatus: Array<{ _id: string; count: number; total: number }>;
  monthlyRevenue: Array<{ month: string; revenue: number; count: number }>;
  recentInvoices: Array<Record<string, unknown>>;
  overdueInvoices: Array<Record<string, unknown>>;
  topClients: Array<{ name?: string; company?: string; revenue: number }>;
}

function formatAmount(paise: number): string {
  const rupees = paise / 100;
  if (rupees >= 10000000) return `₹${(rupees / 10000000).toFixed(1)}Cr`;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toFixed(0)}`;
}

function formatFullAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

const STATUS_COLORS: Record<string, string> = {
  PAID: '#22c55e', SENT: '#3b82f6', DRAFT: '#64748b',
  OVERDUE: '#ef4444', PARTIALLY_PAID: '#f59e0b',
  PENDING: '#8b5cf6', CANCELLED: '#6b7280', VIEWED: '#a855f7',
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonthLabel(monthStr: string): string {
  const [, month] = monthStr.split('-');
  return MONTH_NAMES[parseInt(month) - 1];
}

function MetricCard({ title, value, subtitle, icon: Icon, color, trend, link }: {
  title: string; value: string; subtitle?: string;
  icon: React.ElementType; color: string; trend?: number; link?: string;
}) {
  const content = (
    <div className={`metric-card card-hover group ${link ? 'cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
        {link && <ArrowUpRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors" />}
      </div>
      <div className="text-2xl font-black text-white mb-1">{value}</div>
      <div className="text-sm text-slate-400">{title}</div>
      {subtitle && <div className="text-xs text-slate-600 mt-1">{subtitle}</div>}
    </div>
  );

  return link ? <Link href={link}>{content}</Link> : content;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl p-3 border border-white/10 text-sm">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-white font-bold">₹{((payload[0].value || 0) / 100).toLocaleString('en-IN')}</p>
    </div>
  );
};

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (dateRange.start) params.set('startDate', dateRange.start);
      if (dateRange.end) params.set('endDate', dateRange.end);

      const res = await fetch(`/api/dashboard?${params}`);
      if (!res.ok) throw new Error('Failed to fetch dashboard data');
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError('Failed to load dashboard data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboard(); }, []);

  const pieData = data?.invoicesByStatus?.map(s => ({
    name: s._id,
    value: s.count,
    color: STATUS_COLORS[s._id] || '#64748b',
  })) || [];

  const chartData = data?.monthlyRevenue?.map(m => ({
    month: getMonthLabel(m.month),
    revenue: m.revenue,
    count: m.count,
  })) || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">Your business performance overview</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(p => ({ ...p, start: e.target.value }))}
              className="input text-sm py-2"
            />
            <span className="text-slate-500 text-sm">to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(p => ({ ...p, end: e.target.value }))}
              className="input text-sm py-2"
            />
          </div>
          <button onClick={fetchDashboard} className="btn btn-secondary p-2" disabled={loading} id="refresh-dashboard">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/admin/invoices/new" className="btn btn-primary text-sm" id="create-invoice-btn">
            <Plus className="w-4 h-4" /> New Invoice
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={fetchDashboard} className="ml-auto text-red-400 hover:text-white underline">Retry</button>
        </div>
      )}

      {loading && !data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="metric-card animate-pulse">
              <div className="w-11 h-11 bg-slate-700 rounded-xl mb-4" />
              <div className="h-8 bg-slate-700 rounded mb-2 w-2/3" />
              <div className="h-4 bg-slate-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : data ? (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Total Revenue" value={formatAmount(data.summary.totalPaid)}
              icon={TrendingUp} color="text-green-400 bg-green-400/10" link="/admin/reports?type=revenue"
            />
            <MetricCard
              title="Outstanding" value={formatAmount(data.summary.totalOutstanding)}
              icon={Clock} color="text-blue-400 bg-blue-400/10" link="/admin/invoices?status=SENT"
            />
            <MetricCard
              title="Overdue" value={formatAmount(data.summary.totalOverdue)}
              icon={AlertCircle} color="text-red-400 bg-red-400/10" link="/admin/invoices?status=OVERDUE"
            />
            <MetricCard
              title="Net Profit" value={formatAmount(data.summary.profit)}
              icon={Activity} color={data.summary.profit >= 0 ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}
            />
            <MetricCard
              title="Total Invoiced" value={formatAmount(data.summary.totalInvoiced)}
              icon={FileText} color="text-purple-400 bg-purple-400/10" link="/admin/invoices"
            />
            <MetricCard
              title="Total Expenses" value={formatAmount(data.summary.totalExpenses)}
              icon={DollarSign} color="text-orange-400 bg-orange-400/10" link="/admin/expenses"
            />
            <MetricCard
              title="Active Clients" value={data.summary.clientCount.toString()}
              icon={Users} color="text-indigo-400 bg-indigo-400/10" link="/admin/clients"
            />
            <MetricCard
              title="Payments" value={data.summary.paymentCount.toString()}
              icon={CreditCard} color="text-cyan-400 bg-cyan-400/10" link="/admin/payments"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue chart */}
            <div className="lg:col-span-2 metric-card">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-white">Monthly Revenue</h3>
                  <p className="text-xs text-slate-500">Last 12 months</p>
                </div>
                <BarChart2 className="w-4 h-4 text-slate-500" />
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} fill="url(#revenueGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">
                  No payment data available for this period
                </div>
              )}
            </div>

            {/* Invoice status pie */}
            <div className="metric-card">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-base font-bold text-white">Invoice Status</h3>
                  <p className="text-xs text-slate-500">{data.summary.invoiceCount} total invoices</p>
                </div>
              </div>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, name]} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-500 text-sm">No invoices yet</div>
              )}
              <div className="space-y-1.5 mt-4">
                {pieData.slice(0, 4).map(item => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
                      <span className="text-slate-400 capitalize">{item.name}</span>
                    </div>
                    <span className="text-white font-semibold">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tables Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Invoices */}
            <div className="metric-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white">Recent Invoices</h3>
                <Link href="/admin/invoices" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                  View all <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-2">
                {data.recentInvoices.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">No invoices yet. <Link href="/admin/invoices/new" className="text-indigo-400">Create one</Link></div>
                ) : data.recentInvoices.map((inv: Record<string, unknown>) => (
                  <Link key={inv._id as string} href={`/admin/invoices/${inv._id}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#0f172a] hover:bg-[#1a2540] transition-colors"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">{inv.invoiceNumber as string}</div>
                      <div className="text-xs text-slate-500">{(inv.client as Record<string, string>)?.name || 'Unknown'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-white">{formatAmount(inv.total as number)}</div>
                      <div className={`status-badge status-${(inv.status as string).toLowerCase()}`}>{inv.status as string}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Overdue Invoices */}
            <div className="metric-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white">Overdue Invoices</h3>
                <span className="text-xs text-red-400">{data.overdueInvoices.length} pending action</span>
              </div>
              <div className="space-y-2">
                {data.overdueInvoices.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    </div>
                    All invoices are up to date!
                  </div>
                ) : data.overdueInvoices.map((inv: Record<string, unknown>) => (
                  <Link key={inv._id as string} href={`/admin/invoices/${inv._id}`}
                    className="flex items-center justify-between p-3 rounded-xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">{inv.invoiceNumber as string}</div>
                      <div className="text-xs text-slate-500">{(inv.client as Record<string, string>)?.name}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-400">{formatAmount(inv.amountDue as number)}</div>
                      <div className="text-xs text-red-500">
                        {Math.floor((Date.now() - new Date(inv.dueDate as string).getTime()) / (1000 * 60 * 60 * 24))} days overdue
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Top Clients */}
          {data.topClients.length > 0 && (
            <div className="metric-card">
              <h3 className="text-base font-bold text-white mb-4">Top Clients by Revenue</h3>
              <div className="space-y-3">
                {data.topClients.map((client, idx) => {
                  const maxRevenue = Math.max(...data.topClients.map(c => c.revenue));
                  const pct = maxRevenue > 0 ? (client.revenue / maxRevenue) * 100 : 0;
                  return (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="text-sm font-semibold text-slate-400 w-4">{idx + 1}</div>
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {(client.name || client.company || 'C')[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{client.name || client.company}</div>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <div className="text-sm font-bold text-white whitespace-nowrap">{formatAmount(client.revenue)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
