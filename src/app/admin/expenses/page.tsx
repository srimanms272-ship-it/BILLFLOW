'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, DollarSign, ChevronLeft, ChevronRight, Loader2, AlertCircle, X, Filter } from 'lucide-react';
import { toast } from '@/components/ui/toaster';

interface Expense {
  _id: string;
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  vendor?: string;
  description?: string;
}

const CATEGORIES = ['OFFICE', 'TRAVEL', 'MARKETING', 'SALARIES', 'UTILITIES', 'RENT', 'EQUIPMENT', 'SOFTWARE', 'OTHER'];

const CATEGORY_COLORS: Record<string, string> = {
  OFFICE: 'text-blue-400 bg-blue-500/10',
  TRAVEL: 'text-green-400 bg-green-500/10',
  MARKETING: 'text-purple-400 bg-purple-500/10',
  SALARIES: 'text-amber-400 bg-amber-500/10',
  UTILITIES: 'text-cyan-400 bg-cyan-500/10',
  RENT: 'text-orange-400 bg-orange-500/10',
  EQUIPMENT: 'text-indigo-400 bg-indigo-500/10',
  SOFTWARE: 'text-pink-400 bg-pink-500/10',
  OTHER: 'text-slate-400 bg-slate-500/10',
};

const INITIAL_FORM = { title: '', category: 'OTHER', amount: '', expenseDate: new Date().toISOString().split('T')[0], description: '', vendor: '' };

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [total, setTotal] = useState(0);
  const [categoryStats, setCategoryStats] = useState<Array<{ _id: string; total: number; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (category) params.set('category', category);

      const res = await fetch(`/api/expenses?${params}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setExpenses(data.data?.expenses || []);
      setTotal(data.data?.total || 0);
      setCategoryStats(data.data?.categoryStats || []);
    } catch {
      setError('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [page, category]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount || !formData.expenseDate) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'error' });
      return;
    }
    setFormLoading(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, amount: parseFloat(formData.amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast({ title: 'Expense Recorded', variant: 'success' });
      setShowForm(false);
      setFormData(INITIAL_FORM);
      fetchExpenses();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed', variant: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const totalExpenses = categoryStats.reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Expenses</h1>
          <p className="text-slate-400 text-sm mt-1">
            Total: ₹{(totalExpenses / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary" id="add-expense-btn">
          <Plus className="w-4 h-4" /> Record Expense
        </button>
      </div>

      {/* Category summary */}
      {categoryStats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categoryStats.slice(0, 4).map(cat => (
            <div
              key={cat._id}
              className={`metric-card cursor-pointer transition-all ${category === cat._id ? 'border-indigo-500/40' : ''}`}
              onClick={() => setCategory(prev => prev === cat._id ? '' : cat._id)}
            >
              <div className={`text-xs font-semibold px-2 py-1 rounded-full inline-block mb-2 ${CATEGORY_COLORS[cat._id] || CATEGORY_COLORS.OTHER}`}>
                {cat._id}
              </div>
              <div className="text-lg font-black text-white">₹{((cat.total) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
              <div className="text-xs text-slate-500">{cat.count} items</div>
            </div>
          ))}
        </div>
      )}

      {/* Category filter */}
      <div className="metric-card flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-slate-500" />
        <button onClick={() => setCategory('')} className={`text-xs px-3 py-1.5 rounded-full font-medium ${!category ? 'bg-indigo-500 text-white' : 'bg-[#1e293b] text-slate-400 hover:text-white'}`}>All</button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(prev => prev === cat ? '' : cat)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${category === cat ? 'bg-indigo-500 text-white' : 'bg-[#1e293b] text-slate-400 hover:text-white'}`}
            id={`filter-${cat.toLowerCase()}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      <div className="metric-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Title</th>
                <th>Category</th>
                <th>Vendor</th>
                <th>Date</th>
                <th className="text-right pr-6">Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(5)].map((_, j) => <td key={j}><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-16">
                    <DollarSign className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No expenses recorded</p>
                    <button onClick={() => setShowForm(true)} className="btn btn-primary text-sm mt-4">
                      <Plus className="w-4 h-4" /> Record Expense
                    </button>
                  </td>
                </tr>
              ) : expenses.map((expense) => (
                <tr key={expense._id}>
                  <td className="pl-6">
                    <div className="text-sm font-semibold text-white">{expense.title}</div>
                    {expense.description && <div className="text-xs text-slate-500">{expense.description}</div>}
                  </td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${CATEGORY_COLORS[expense.category] || CATEGORY_COLORS.OTHER}`}>
                      {expense.category}
                    </span>
                  </td>
                  <td className="text-sm text-slate-400">{expense.vendor || '—'}</td>
                  <td className="text-sm text-slate-300">{new Date(expense.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                  <td className="text-right pr-6 text-sm font-bold text-white">
                    ₹{(expense.amount / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#1e293b]">
            <p className="text-sm text-slate-500">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary p-2 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-secondary p-2 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Record Expense</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b]"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" id="expense-form">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Title *</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData(p => ({ ...p, title: e.target.value }))} className="input text-sm" required placeholder="Office supplies, vendor payment..." id="expense-title" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Category *</label>
                  <select value={formData.category} onChange={(e) => setFormData(p => ({ ...p, category: e.target.value }))} className="input text-sm" id="expense-category">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Amount (₹) *</label>
                  <input type="number" min="0.01" step="0.01" value={formData.amount} onChange={(e) => setFormData(p => ({ ...p, amount: e.target.value }))} className="input text-sm" required placeholder="0.00" id="expense-amount" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Date *</label>
                  <input type="date" value={formData.expenseDate} onChange={(e) => setFormData(p => ({ ...p, expenseDate: e.target.value }))} className="input text-sm" required id="expense-date" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Vendor</label>
                  <input type="text" value={formData.vendor} onChange={(e) => setFormData(p => ({ ...p, vendor: e.target.value }))} className="input text-sm" placeholder="Vendor name" id="expense-vendor" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} className="input resize-none text-sm" placeholder="Additional details..." id="expense-description" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={formLoading} className="btn btn-primary flex-1" id="save-expense-btn">
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Record Expense
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
