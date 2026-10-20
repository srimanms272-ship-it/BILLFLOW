'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, CheckCheck, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

interface Notification {
  _id: string;
  title: string;
  message: string;
  category: string;
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  PAYMENT: 'text-green-400 bg-green-500/10',
  INVOICE: 'text-blue-400 bg-blue-500/10',
  REMINDER: 'text-yellow-400 bg-yellow-500/10',
  SYSTEM: 'text-slate-400 bg-slate-500/10',
  ALERT: 'text-red-400 bg-red-500/10',
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: '20' });
      if (filter === 'unread') params.set('unread', 'true');
      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setNotifications(data.data?.notifications || []);
      setTotal(data.data?.total || 0);
      setUnreadCount(data.data?.unreadCount || 0);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-all-read' }),
    });
    fetchNotifications();
  };

  const markRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark-read', notificationId: id }),
    });
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            Notifications
            {unreadCount > 0 && (
              <span className="text-sm font-semibold px-2 py-0.5 rounded-full bg-indigo-500 text-white">{unreadCount}</span>
            )}
          </h1>
          <p className="text-slate-400 text-sm mt-1">{total} total notifications</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="btn btn-secondary text-sm" id="mark-all-read-btn">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1); }}
            className={`text-xs px-4 py-2 rounded-full font-medium transition-all ${filter === f ? 'bg-indigo-500 text-white' : 'bg-[#1e293b] text-slate-400 hover:text-white'}`}
            id={`filter-${f}`}
          >
            {f === 'all' ? 'All' : `Unread (${unreadCount})`}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="metric-card text-center py-16">
            <BellOff className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No notifications</p>
            <p className="text-slate-600 text-sm mt-1">{filter === 'unread' ? 'All caught up!' : "You'll be notified of payments, reminders, and more"}</p>
          </div>
        ) : notifications.map((notif) => (
          <div
            key={notif._id}
            className={`metric-card transition-all cursor-pointer group ${!notif.isRead ? 'border-indigo-500/20 bg-indigo-500/5' : ''}`}
            onClick={() => { if (!notif.isRead) markRead(notif._id); }}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${CATEGORY_COLORS[notif.category] || CATEGORY_COLORS.SYSTEM}`}>
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm font-semibold ${!notif.isRead ? 'text-white' : 'text-slate-300'}`}>
                      {notif.title}
                    </p>
                    <p className="text-sm text-slate-400 mt-0.5">{notif.message}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs text-slate-600">{timeAgo(notif.createdAt)}</span>
                    {!notif.isRead && <div className="w-2 h-2 rounded-full bg-indigo-500 ml-auto mt-1" />}
                  </div>
                </div>
                {notif.actionUrl && (
                  <a
                    href={notif.actionUrl}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                    onClick={e => e.stopPropagation()}
                  >
                    View <ChevronRight className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
