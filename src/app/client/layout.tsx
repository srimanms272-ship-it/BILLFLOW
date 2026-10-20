'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from '@/lib/auth-client';
import {
  LayoutDashboard, FileText, Receipt, LogOut,
  Zap, Menu, ChevronRight, CreditCard
} from 'lucide-react';

const clientNavItems = [
  { href: '/client/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/client/invoices', label: 'My Invoices', icon: FileText },
  { href: '/client/receipts', label: 'Payment Receipts', icon: Receipt },
];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login');
    }
  }, [session, isPending, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0e1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading Client Portal...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const user = session.user as { name?: string; email?: string };
  const initials = (user.name || 'C').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

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
              <div className="text-xs text-indigo-400 font-semibold">Client Portal</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4 flex-1">
          {clientNavItems.map((item) => {
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
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500">
            <span>Client Portal</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-white capitalize">{pathname.split('/').filter(Boolean).slice(1).join(' / ') || 'Dashboard'}</span>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <Link
              href="/client/invoices"
              className="btn btn-primary text-xs py-1.5 px-3 rounded-lg"
            >
              <CreditCard className="w-3.5 h-3.5" /> Pay Invoices
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
