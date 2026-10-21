'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, User, Building2, Mail, Phone, MoreVertical, Edit, Eye, UserX, UserCheck, ChevronLeft, ChevronRight, Loader2, AlertCircle, X } from 'lucide-react';
import { toast } from '@/components/ui/toaster';

interface Client {
  _id: string; name: string; email: string; phone?: string;
  company?: string; gstin?: string; isActive: boolean;
  totalInvoiced: number; totalPaid: number; createdAt: string;
}

const INITIAL_FORM = {
  name: '', email: '', phone: '', company: '', gstin: '', pan: '', notes: '',
  billingAddress: { line1: '', line2: '', city: '', state: '', country: 'India', pincode: '' },
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const limit = 20;
  const totalPages = Math.ceil(total / limit);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
      if (search) params.set('search', search);
      if (status) params.set('status', status);

      const res = await fetch(`/api/clients?${params}`);
      if (!res.ok) throw new Error('Failed to fetch clients');
      const data = await res.json();
      setClients(data.data?.clients || []);
      setTotal(data.data?.total || 0);
    } catch {
      setError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.name || formData.name.trim().length < 2) errors.name = 'Name is required (min 2 chars)';
    if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email.trim())) errors.email = 'Valid email is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setFormLoading(true);
    try {
      const method = editClient ? 'PUT' : 'POST';
      const url = editClient ? `/api/clients/${editClient._id}` : '/api/clients';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save client');

      toast({ title: editClient ? 'Client Updated' : 'Client Created', variant: 'success' });
      setShowForm(false);
      setEditClient(null);
      setFormData(INITIAL_FORM);
      fetchClients();
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Failed to save client';
      const description =
        rawMsg.includes('SSL alert') ||
        rawMsg.includes('0A000438:SSL') ||
        rawMsg.includes('alert internal error') ||
        rawMsg.includes('SSL routines')
          ? 'MongoDB Atlas rejected connection: Please add 0.0.0.0/0 under MongoDB Atlas -> Network Access -> IP Access List.'
          : rawMsg;
      toast({ title: 'Save Failed', description, variant: 'error' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleActive = async (client: Client) => {
    try {
      const res = await fetch(`/api/clients/${client._id}?restore=${!client.isActive}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast({ title: client.isActive ? 'Client Deactivated' : 'Client Restored', variant: client.isActive ? 'default' : 'success' });
      fetchClients();
    } catch {
      toast({ title: 'Error', description: 'Failed to update client status', variant: 'error' });
    }
    setMenuOpen(null);
  };

  const openEdit = (client: Client) => {
    setEditClient(client);
    setFormData({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      company: client.company || '',
      gstin: client.gstin || '',
      pan: (client as any).pan || '',
      notes: (client as any).notes || '',
      billingAddress: {
        line1: (client as any).billingAddress?.line1 || '',
        line2: (client as any).billingAddress?.line2 || '',
        city: (client as any).billingAddress?.city || '',
        state: (client as any).billingAddress?.state || '',
        country: (client as any).billingAddress?.country || 'India',
        pincode: (client as any).billingAddress?.pincode || '',
      },
    });
    setShowForm(true);
    setMenuOpen(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Clients</h1>
          <p className="text-slate-400 text-sm mt-1">{total} {status === 'active' ? 'active' : ''} clients</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditClient(null); setFormData(INITIAL_FORM); }} className="btn btn-primary" id="new-client-btn">
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      {/* Filters */}
      <div className="metric-card flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text" value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (setPage(1), fetchClients())}
            placeholder="Search clients..."
            className="input pl-11 text-sm"
            id="client-search"
          />
        </div>
        <div className="flex gap-2">
          {['active', 'inactive', ''].map((s, i) => (
            <button
              key={i}
              onClick={() => { setStatus(s); setPage(1); }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all ${status === s ? 'bg-indigo-500 text-white' : 'bg-[#1e293b] text-slate-400 hover:text-white'}`}
            >
              {s === '' ? 'All' : s === 'active' ? 'Active' : 'Inactive'}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}

      {/* Table */}
      <div className="metric-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="pl-6">Client</th>
                <th>Contact</th>
                <th>Company</th>
                <th>Total Invoiced</th>
                <th>Total Paid</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>{[...Array(7)].map((_, j) => <td key={j}><div className="h-4 bg-slate-800 rounded animate-pulse" /></td>)}</tr>
                ))
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <User className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-400 font-medium">No clients found</p>
                    <p className="text-slate-600 text-sm mt-1">Add your first client to get started</p>
                    <button onClick={() => setShowForm(true)} className="btn btn-primary text-sm mt-4">
                      <Plus className="w-4 h-4" /> Add Client
                    </button>
                  </td>
                </tr>
              ) : clients.map((client) => (
                <tr key={client._id} className={!client.isActive ? 'opacity-60' : ''}>
                  <td className="pl-6">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                        {client.name[0].toUpperCase()}
                      </div>
                      <div>
                        <Link href={`/admin/clients/${client._id}`} className="text-sm font-semibold text-white hover:text-indigo-400 transition-colors">
                          {client.name}
                        </Link>
                        {client.gstin && <div className="text-xs text-slate-500">GSTIN: {client.gstin}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="text-xs text-slate-300 flex items-center gap-1"><Mail className="w-3 h-3 text-slate-500" />{client.email}</div>
                    {client.phone && <div className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Phone className="w-3 h-3" />{client.phone}</div>}
                  </td>
                  <td className="text-sm text-slate-300">{client.company || '—'}</td>
                  <td className="text-sm font-semibold text-white">₹{((client.totalInvoiced || 0) / 100).toLocaleString('en-IN')}</td>
                  <td className="text-sm font-semibold text-green-400">₹{((client.totalPaid || 0) / 100).toLocaleString('en-IN')}</td>
                  <td>
                    <span className={`status-badge ${client.isActive ? 'status-paid' : 'status-cancelled'}`}>
                      {client.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="relative">
                      <div className="flex items-center gap-1">
                        <Link href={`/admin/clients/${client._id}`} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700" title="View" id={`view-client-${client._id}`}>
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <button onClick={() => openEdit(client)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700" title="Edit" id={`edit-client-${client._id}`}>
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(client)}
                          className={`p-1.5 rounded-lg transition-colors ${client.isActive ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-500 hover:text-green-400 hover:bg-green-500/10'}`}
                          title={client.isActive ? 'Deactivate' : 'Restore'}
                          id={`toggle-client-${client._id}`}
                        >
                          {client.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
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
              <span className="text-sm text-slate-400">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn btn-secondary p-2 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Client Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-6 w-full max-w-2xl my-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{editClient ? 'Edit Client' : 'Add New Client'}</h3>
              <button onClick={() => { setShowForm(false); setEditClient(null); }} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4" id="client-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Full Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} className={`input text-sm ${formErrors.name ? 'border-red-500/50' : ''}`} required id="client-name" />
                  {formErrors.name && <p className="text-xs text-red-400 mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Email *</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} className={`input text-sm ${formErrors.email ? 'border-red-500/50' : ''}`} required id="client-email" />
                  {formErrors.email && <p className="text-xs text-red-400 mt-1">{formErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Phone</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} className="input text-sm" id="client-phone" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Company</label>
                  <input type="text" value={formData.company} onChange={(e) => setFormData(p => ({ ...p, company: e.target.value }))} className="input text-sm" id="client-company" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">GSTIN</label>
                  <input type="text" value={formData.gstin} onChange={(e) => setFormData(p => ({ ...p, gstin: e.target.value }))} className="input text-sm" placeholder="22AAAAA0000A1Z5" id="client-gstin" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">PAN</label>
                  <input type="text" value={formData.pan} onChange={(e) => setFormData(p => ({ ...p, pan: e.target.value }))} className="input text-sm" id="client-pan" />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Billing Address</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Address Line 1</label>
                    <input type="text" value={formData.billingAddress.line1} onChange={(e) => setFormData(p => ({ ...p, billingAddress: { ...p.billingAddress, line1: e.target.value } }))} className="input text-sm" id="billing-line1" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Address Line 2</label>
                    <input type="text" value={formData.billingAddress.line2} onChange={(e) => setFormData(p => ({ ...p, billingAddress: { ...p.billingAddress, line2: e.target.value } }))} className="input text-sm" id="billing-line2" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">City</label>
                    <input type="text" value={formData.billingAddress.city} onChange={(e) => setFormData(p => ({ ...p, billingAddress: { ...p.billingAddress, city: e.target.value } }))} className="input text-sm" id="billing-city" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">State</label>
                    <input type="text" value={formData.billingAddress.state} onChange={(e) => setFormData(p => ({ ...p, billingAddress: { ...p.billingAddress, state: e.target.value } }))} className="input text-sm" id="billing-state" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Pincode</label>
                    <input type="text" value={formData.billingAddress.pincode} onChange={(e) => setFormData(p => ({ ...p, billingAddress: { ...p.billingAddress, pincode: e.target.value } }))} className="input text-sm" id="billing-pincode" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Country</label>
                    <input type="text" value={formData.billingAddress.country} onChange={(e) => setFormData(p => ({ ...p, billingAddress: { ...p.billingAddress, country: e.target.value } }))} className="input text-sm" id="billing-country" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} className="input resize-none text-sm" placeholder="Internal notes..." id="client-notes" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={formLoading} className="btn btn-primary flex-1" id="save-client-btn">
                  {formLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editClient ? 'Update Client' : 'Create Client'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditClient(null); }} className="btn btn-secondary flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
