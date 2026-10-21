'use client';

import Link from 'next/link';
import { ArrowRight, BarChart3, FileText, CreditCard, Shield, Zap, Users } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f172a] to-[#0a0e1a]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-indigo-400" />
            <span className="text-xl font-bold gradient-text">BillFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Sign In</Link>
            <Link href="/register" className="btn btn-primary text-sm py-2 px-4 rounded-lg">
              Get Started <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Production-Grade Billing Platform
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-6">
            Professional
            <span className="gradient-text block">Billing & Invoicing</span>
            for Modern Business
          </h1>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            Create invoices, manage clients, accept payments, track expenses and generate reports — all in one powerful platform.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register" className="btn btn-primary text-base py-3 px-8 rounded-xl">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="btn btn-secondary text-base py-3 px-8 rounded-xl">
              Sign In to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: 'Invoices Generated', value: '50K+' },
            { label: 'Payments Processed', value: '₹10Cr+' },
            { label: 'Active Businesses', value: '2,000+' },
            { label: 'Uptime', value: '99.9%' },
          ].map((stat) => (
            <div key={stat.label} className="metric-card text-center">
              <div className="text-3xl font-black gradient-text mb-1">{stat.value}</div>
              <div className="text-sm text-slate-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-white mb-4">Everything you need</h2>
            <p className="text-slate-400 text-lg">A complete billing solution for your business</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: FileText, title: 'Smart Invoicing', description: 'Create professional invoices with GST, auto-numbering, and PDF export in seconds.', color: 'text-indigo-400 bg-indigo-400/10' },
              { icon: CreditCard, title: 'Online Payments', description: 'Accept UPI, cards, net banking via Razorpay. Real-time payment verification.', color: 'text-green-400 bg-green-400/10' },
              { icon: Users, title: 'Client Portal', description: 'Clients get their own portal to view invoices, make payments, and download receipts.', color: 'text-blue-400 bg-blue-400/10' },
              { icon: BarChart3, title: 'Business Reports', description: 'Revenue, GST, expense, and profit/loss reports with date filters and CSV export.', color: 'text-purple-400 bg-purple-400/10' },
              { icon: Shield, title: 'Enterprise Security', description: 'Multi-tenant isolation, RBAC, audit logs, and secure session management.', color: 'text-red-400 bg-red-400/10' },
              { icon: Zap, title: 'Automation', description: 'Auto reminders, recurring invoices, and overdue notifications — set and forget.', color: 'text-yellow-400 bg-yellow-400/10' },
            ].map((feature) => (
              <div key={feature.title} className="metric-card card-hover">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${feature.color}`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="metric-card" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))', borderColor: 'rgba(99,102,241,0.3)' }}>
            <h2 className="text-4xl font-black text-white mb-4">Ready to get started?</h2>
            <p className="text-slate-400 mb-8">Join thousands of businesses using BillFlow to manage their finances.</p>
            <Link href="/register" className="btn btn-primary text-base py-3 px-8 rounded-xl">
              Create Free Account <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-slate-500 text-sm">
          © 2026 BillFlow. Built with Next.js, MongoDB, and Razorpay.
        </p>
      </footer>
    </div>
  );
}
