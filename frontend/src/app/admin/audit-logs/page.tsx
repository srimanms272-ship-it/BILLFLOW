'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, ChevronLeft, ChevronRight, Filter, Clock, Loader2 } from 'lucide-react';

interface AuditEntry {
  _id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  INVOICE_CREATED: 'text-blue-400 bg-blue-500/10',
  INVOICE_UPDATED: 'text-yellow-400 bg-yellow-500/10',
  INVOICE_SENT: 'text-indigo-400 bg-indigo-500/10',
  INVOICE_CANCELLED: 'text-red-400 bg-red-500/10',
  PAYMENT_CREATED: 'text-green-400 bg-green-500/10',
  PAYMENT_VERIFIED: 'text-green-400 bg-green-500/10',
  PAYMENT_FAILED: 'text-red-400 bg-red-500/10',
  CLIENT_CREATED: 'text-cyan-400 bg-cyan-500/10',
  CLIENT_UPDATED: 'text-amber-400 bg-amber-500/10',
  EXPENSE_CREATED: 'text-orange-400 bg-orange-500/10',
  SETTINGS_UPDATED: 'text-purple-400 bg-purple-500/10',
  BUSINESS_CREATED: 'text-indigo-400 bg-indigo-500/10',
  QUOTATION_CREATED: 'text-teal-400 bg-teal-500/10',
  QUOTATION_CONVERTED: 'text-green-400 bg-green-500/10',
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const limit = 50;
  const totalPages = Math.ceil(total / limit);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (entityType) params.set('entityType', entityType);
      const res = await fetch(`/api/audit-logs?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setLogs(data.data?.logs || []);
      setTotal(data.data?.total || 0);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [page, entityType]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 30) return `${days}d ago`;
    return new Date(date).toLocaleDateString('en-IN');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-3">
          <Shield className="w-6 h-6 text-indigo-400" /> Audit Logs
        </h1>
        <p className="text-slate-400 text-sm mt-1">{total} actions logged — all admin actions are tracked for security</p>
      </div>

      <div className="metric-card flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-500" />
        {['', 'INVOICE', 'PAYMENT', 'CLIENT', 'EXPENSE', 'QUOTATION', 'BUSINESS'].map(t => (
          <button
            key={t}
            onClick={() => { setEntityType(t); setPage(1); }}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${entityType === t ? 'bg-indigo-500 text-white' : 'bg-[#1e293b] text-slate-400 hover:text-white'}`}
          >
            {t || 'All'}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="metric-card text-center py-16">
            <Shield className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No audit logs yet</p>
          </div>
        ) : logs.map((log) => (
          <div key={log._id} className="metric-card py-3 px-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-shrink-0">
                <Clock className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-xs text-slate-600 w-16">{timeAgo(log.createdAt)}</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${ACTION_COLORS[log.action] || 'text-slate-400 bg-slate-500/10'}`}>
                {log.action.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-slate-500 bg-[#1e293b] px-2 py-0.5 rounded flex-shrink-0">
                {log.entityType}
              </span>
              <span className="text-xs text-slate-400 truncate flex-1 font-mono">{log.entityId}</span>
              {log.metadata && Object.keys(log.metadata).length > 0 && (
                <span className="text-xs text-slate-600 truncate max-w-xs">
                  {Object.entries(log.metadata).map(([k, v]) => `${k}: ${v}`).join(', ')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary p-2 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-secondary p-2 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
