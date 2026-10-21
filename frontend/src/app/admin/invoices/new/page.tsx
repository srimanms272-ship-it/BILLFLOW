'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Trash2, ChevronLeft, Loader2, AlertCircle, Search } from 'lucide-react';
import { toast } from '@/components/ui/toaster';

interface Client { _id: string; name: string; email: string; company?: string; gstin?: string; billingAddress?: Record<string, string>; }
interface Business { settings?: { defaultCgstRate?: number; defaultSgstRate?: number; defaultIgstRate?: number; invoicePrefix?: string; defaultPaymentTerms?: number; }; }
interface LineItem {
  id: string; description: string; quantity: string;
  unitPrice: string; discount: string; cgstRate: string; sgstRate: string; igstRate: string; unit: string;
}

function genId() { return Math.random().toString(36).substr(2, 9); }

function calcItemTotals(item: LineItem) {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  const discount = parseFloat(item.discount) || 0;
  const cgst = parseFloat(item.cgstRate) || 0;
  const sgst = parseFloat(item.sgstRate) || 0;
  const igst = parseFloat(item.igstRate) || 0;
  const subtotal = qty * price;
  const discountAmt = subtotal * discount / 100;
  const taxable = subtotal - discountAmt;
  const taxAmt = taxable * (cgst + sgst + igst) / 100;
  const total = taxable + taxAmt;
  return { subtotal, discountAmt, taxable, taxAmt, total };
}

function calcTotals(items: LineItem[]) {
  return items.reduce((acc, item) => {
    const t = calcItemTotals(item);
    return {
      subtotal: acc.subtotal + t.subtotal,
      discountAmt: acc.discountAmt + t.discountAmt,
      taxable: acc.taxable + t.taxable,
      taxAmt: acc.taxAmt + t.taxAmt,
      total: acc.total + t.total,
    };
  }, { subtotal: 0, discountAmt: 0, taxable: 0, taxAmt: 0, total: 0 });
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientSearch, setShowClientSearch] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const defaultDue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    clientId: '',
    invoiceDate: today,
    dueDate: defaultDue,
    currency: 'INR',
    notes: '',
    termsAndConditions: '',
  });

  const [items, setItems] = useState<LineItem[]>([{
    id: genId(), description: '', quantity: '1', unitPrice: '',
    discount: '0', cgstRate: '9', sgstRate: '9', igstRate: '0', unit: '',
  }]);

  useEffect(() => {
    const fetchData = async () => {
      const [clientsRes, businessRes] = await Promise.all([
        fetch('/api/clients?limit=100&status=active'),
        fetch('/api/business'),
      ]);
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(data.data?.clients || []);
      }
      if (businessRes.ok) {
        const data = await businessRes.json();
        const biz = data.data?.business;
        setBusiness(biz);
        if (biz?.settings) {
          setItems([{
            id: genId(), description: '', quantity: '1', unitPrice: '',
            discount: '0',
            cgstRate: biz.settings.defaultCgstRate?.toString() || '9',
            sgstRate: biz.settings.defaultSgstRate?.toString() || '9',
            igstRate: biz.settings.defaultIgstRate?.toString() || '0',
            unit: '',
          }]);
          if (biz.settings.defaultPaymentTerms) {
            const dueDate = new Date(Date.now() + biz.settings.defaultPaymentTerms * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            setForm(p => ({ ...p, dueDate }));
          }
        }
      }
    };
    fetchData();
  }, []);

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.company || '').toLowerCase().includes(clientSearch.toLowerCase())
  );

  const addItem = () => {
    const lastItem = items[items.length - 1];
    setItems(prev => [...prev, {
      id: genId(), description: '', quantity: '1', unitPrice: '',
      discount: lastItem?.discount || '0',
      cgstRate: lastItem?.cgstRate || '9',
      sgstRate: lastItem?.sgstRate || '9',
      igstRate: lastItem?.igstRate || '0',
      unit: '',
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length === 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: keyof LineItem, value: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const totals = calcTotals(items);

  const handleSubmit = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    if (!form.clientId) { setError('Please select a client'); return; }
    if (items.some(i => !i.description || !i.unitPrice)) {
      setError('Please fill in all item descriptions and prices'); return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        clientId: form.clientId,
        invoiceDate: form.invoiceDate,
        dueDate: form.dueDate,
        currency: form.currency,
        items: items.map(i => ({
          id: i.id,
          description: i.description,
          quantity: parseFloat(i.quantity) || 1,
          unitPrice: parseFloat(i.unitPrice) || 0,
          discount: parseFloat(i.discount) || 0,
          cgstRate: parseFloat(i.cgstRate) || 0,
          sgstRate: parseFloat(i.sgstRate) || 0,
          igstRate: parseFloat(i.igstRate) || 0,
          unit: i.unit,
        })),
        notes: form.notes,
        termsAndConditions: form.termsAndConditions,
      };

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create invoice');

      if (data.data?.emailSent) {
        toast({
          title: 'Invoice Sent',
          description: `Invoice ${data.data?.invoiceNumber} created and sent to client successfully`,
          variant: 'success',
        });
      } else if (data.data?.emailSent === false) {
        toast({
          title: 'Invoice Created',
          description: 'Invoice created, but email could not be sent.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Invoice Created',
          description: `Invoice ${data.data?.invoiceNumber} created successfully`,
          variant: 'success',
        });
      }
      router.push(`/admin/invoices/${data.data?._id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/invoices" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-[#1e293b]">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-black text-white">Create Invoice</h1>
          <p className="text-slate-400 text-sm">Fill in the details below to create a new invoice</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <form onSubmit={(e) => handleSubmit(e)} className="space-y-6" id="create-invoice-form">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - main form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Client selection */}
            <div className="metric-card">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold">1</span>
                Select Client
              </h3>
              {selectedClient ? (
                <div className="flex items-center justify-between p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  <div>
                    <div className="text-sm font-bold text-white">{selectedClient.name}</div>
                    <div className="text-xs text-slate-400">{selectedClient.email}</div>
                    {selectedClient.company && <div className="text-xs text-slate-500">{selectedClient.company}</div>}
                    {selectedClient.gstin && <div className="text-xs text-slate-500">GSTIN: {selectedClient.gstin}</div>}
                  </div>
                  <button type="button" onClick={() => { setSelectedClient(null); setForm(p => ({ ...p, clientId: '' })); }} className="text-xs text-red-400 hover:text-red-300">Change</button>
                </div>
              ) : (
                <div className="relative">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={clientSearch}
                      onChange={(e) => { setClientSearch(e.target.value); setShowClientSearch(true); }}
                      onFocus={() => setShowClientSearch(true)}
                      placeholder="Search clients by name, email, or company..."
                      className="input pl-11 text-sm"
                      id="client-search-input"
                    />
                  </div>
                  {showClientSearch && filteredClients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1e293b] border border-[#334155] rounded-xl shadow-xl z-50 max-h-60 overflow-y-auto">
                      {filteredClients.map(c => (
                        <button
                          key={c._id}
                          type="button"
                          onClick={() => {
                            setSelectedClient(c);
                            setForm(p => ({ ...p, clientId: c._id }));
                            setShowClientSearch(false);
                            setClientSearch('');
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-[#334155] transition-colors"
                          id={`select-client-${c._id}`}
                        >
                          <div className="text-sm font-medium text-white">{c.name}</div>
                          <div className="text-xs text-slate-400">{c.company} · {c.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {clients.length === 0 && (
                    <p className="text-xs text-slate-500 mt-2">
                      No clients yet. <Link href="/admin/clients/new" className="text-indigo-400">Create a client</Link> first.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Invoice Details */}
            <div className="metric-card">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold">2</span>
                Invoice Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Invoice Date *</label>
                  <input type="date" value={form.invoiceDate} onChange={(e) => setForm(p => ({ ...p, invoiceDate: e.target.value }))} className="input text-sm" required id="invoice-date" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Due Date *</label>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm(p => ({ ...p, dueDate: e.target.value }))} className="input text-sm" required id="due-date" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Currency</label>
                  <select value={form.currency} onChange={(e) => setForm(p => ({ ...p, currency: e.target.value }))} className="input text-sm" id="currency-select">
                    <option value="INR">INR - Indian Rupee</option>
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="metric-card">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold">3</span>
                Line Items
              </h3>

              <div className="space-y-3">
                {items.map((item, idx) => {
                  const t = calcItemTotals(item);
                  return (
                    <div key={item.id} className="p-4 rounded-xl bg-[#0f172a] border border-[#1e293b] space-y-3">
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-slate-600 font-semibold mt-1 w-4">{idx + 1}</span>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            placeholder="Item description / service name"
                            className="input text-sm mb-2"
                            required
                            id={`item-desc-${idx}`}
                          />
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">Qty</label>
                              <input
                                type="number" min="0.01" step="0.01"
                                value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                                className="input text-sm" required id={`item-qty-${idx}`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">Unit Price (₹)</label>
                              <input
                                type="number" min="0" step="0.01"
                                value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                                placeholder="0.00" className="input text-sm" required id={`item-price-${idx}`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">Discount %</label>
                              <input
                                type="number" min="0" max="100" step="0.1"
                                value={item.discount} onChange={(e) => updateItem(item.id, 'discount', e.target.value)}
                                className="input text-sm" id={`item-discount-${idx}`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">Unit</label>
                              <input
                                type="text" value={item.unit}
                                onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                                placeholder="pcs, hrs, kg..."
                                className="input text-sm" id={`item-unit-${idx}`}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">CGST %</label>
                              <input
                                type="number" min="0" max="50" step="0.5"
                                value={item.cgstRate} onChange={(e) => updateItem(item.id, 'cgstRate', e.target.value)}
                                className="input text-sm" id={`item-cgst-${idx}`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">SGST %</label>
                              <input
                                type="number" min="0" max="50" step="0.5"
                                value={item.sgstRate} onChange={(e) => updateItem(item.id, 'sgstRate', e.target.value)}
                                className="input text-sm" id={`item-sgst-${idx}`}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500 mb-1 block">IGST %</label>
                              <input
                                type="number" min="0" max="100" step="0.5"
                                value={item.igstRate} onChange={(e) => updateItem(item.id, 'igstRate', e.target.value)}
                                className="input text-sm" id={`item-igst-${idx}`}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="text-right min-w-[80px]">
                          <div className="text-xs text-slate-500 mb-1">Total</div>
                          <div className="text-sm font-bold text-white">₹{t.total.toFixed(2)}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-30"
                          id={`remove-item-${idx}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={addItem}
                className="mt-3 w-full py-2.5 border border-dashed border-[#334155] text-slate-400 hover:border-indigo-500 hover:text-indigo-400 rounded-xl text-sm flex items-center justify-center gap-2 transition-all"
                id="add-item-btn"
              >
                <Plus className="w-4 h-4" /> Add Line Item
              </button>
            </div>

            {/* Notes */}
            <div className="metric-card">
              <h3 className="text-sm font-semibold text-white mb-4">Additional Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Notes (visible to client)</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Payment instructions, thank you message..."
                    rows={3}
                    className="input resize-none text-sm"
                    id="invoice-notes"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Terms & Conditions</label>
                  <textarea
                    value={form.termsAndConditions}
                    onChange={(e) => setForm(p => ({ ...p, termsAndConditions: e.target.value }))}
                    placeholder="Payment terms, late fees, warranty..."
                    rows={3}
                    className="input resize-none text-sm"
                    id="invoice-terms"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right column - summary */}
          <div className="space-y-4">
            {/* Price summary */}
            <div className="metric-card sticky top-24">
              <h3 className="text-sm font-semibold text-white mb-4">Invoice Summary</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="text-white">₹{totals.subtotal.toFixed(2)}</span>
                </div>
                {totals.discountAmt > 0 && (
                  <div className="flex justify-between text-slate-400">
                    <span>Discount</span>
                    <span className="text-red-400">-₹{totals.discountAmt.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>Taxable Amount</span>
                  <span className="text-white">₹{totals.taxable.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Tax</span>
                  <span className="text-white">₹{totals.taxAmt.toFixed(2)}</span>
                </div>
                <div className="border-t border-[#334155] pt-2.5">
                  <div className="flex justify-between text-base font-black">
                    <span className="text-white">Total</span>
                    <span className="gradient-text">₹{totals.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <button
                  type="submit"
                  disabled={loading || !form.clientId}
                  className="btn btn-primary w-full py-3 rounded-xl text-sm"
                  id="save-invoice-btn"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : 'Create Invoice'}
                </button>
                <Link href="/admin/invoices" className="btn btn-secondary w-full py-2.5 rounded-xl text-sm justify-center">
                  Cancel
                </Link>
              </div>

              <p className="text-xs text-slate-600 mt-4 text-center">
                Totals will be recalculated server-side for accuracy
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
