'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import {
  LayoutDashboard, Users, FileText, CreditCard, Receipt,
  BarChart3, Settings, Bell, LogOut, Zap, Menu, X,
  ChevronRight, Building2, FilePen, DollarSign,
  BookOpen, FileSearch, UserCog, Shield
} from 'lucide-react';

const navItems = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/clients', label: 'Clients', icon: Users },
  { href: '/admin/quotations', label: 'Quotations', icon: FilePen },
  { href: '/admin/invoices', label: 'Invoices', icon: FileText },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/expenses', label: 'Expenses', icon: DollarSign },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { href: '/admin/notifications', label: 'Notifications', icon: Bell },
  { href: '/admin/audit-logs', label: 'Audit Logs', icon: Shield },
  { href: '/admin/team', label: 'Team', icon: UserCog },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
    if (!isPending && session) {
      const user = session.user as { role?: string };
      if (user.role === 'CLIENT') {
        router.push('/client/dashboard');
      }
    }
  }, [session, isPending, router]);

  useEffect(() => {
    // Fetch notification count
    const fetchNotificationCount = async () => {
      try {
        const res = await fetch('/api/notifications?unread=true&limit=1');
        if (res.ok) {
          const data = await res.json();
          setNotificationCount(data.data?.unreadCount || 0);
        }
      } catch { /* ignore */ }
    };
    if (session) {
      fetchNotificationCount();
      const interval = setInterval(fetchNotificationCount, 30000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const user = session.user as { name?: string; email?: string; image?: string; role?: string };
  const initials = (user.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-[#080c18]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar ${sidebarOpen ? 'open' : ''} lg:translate-x-0`}
        style={{ transform: sidebarOpen ? 'translateX(0)' : undefined }}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-[#1e293b]">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-base font-bold text-white">BillFlow</div>
              <div className="text-xs text-slate-500">Business Portal</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm font-medium transition-all duration-150 group relative ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                    : 'text-slate-400 hover:bg-[#1e293b] hover:text-white'
                }`}
              >
                <item.icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-white'}`} />
                <span>{item.label}</span>
                {item.href === '/admin/notifications' && notificationCount > 0 && (
                  <span className="ml-auto bg-indigo-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3 h-3 ml-auto text-indigo-400" />}
              </Link>
            );
          })}
        </nav>

        {/* User Profile */}
        <div className="border-t border-[#1e293b] p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{user.name}</div>
              <div className="text-xs text-slate-500 truncate">{user.email}</div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
            id="logout-btn"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="page-container lg:ml-[260px]">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-[#080c18]/90 backdrop-blur-md border-b border-[#1e293b] px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b]"
            id="mobile-menu-btn"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500">
            <span>BillFlow</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white capitalize">{pathname.split('/').filter(Boolean).slice(1).join(' / ') || 'Dashboard'}</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Link
              href="/admin/notifications"
              className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b] transition-colors"
              id="notifications-btn"
            >
              <Bell className="w-5 h-5" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white text-[10px] rounded-full flex items-center justify-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
