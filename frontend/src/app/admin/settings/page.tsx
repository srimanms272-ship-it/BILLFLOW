'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Building2, Settings, Bell, CreditCard, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from '@/components/ui/toaster';

const TABS = [
  { id: 'business', label: 'Business Profile', icon: Building2 },
  { id: 'billing', label: 'Billing Settings', icon: Settings },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'payment', label: 'Payment Gateway', icon: CreditCard },
  { id: 'security', label: 'Security', icon: Shield },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('business');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [business, setBusiness] = useState<Record<string, unknown> | null>(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', gstin: '', pan: '',
    address: { line1: '', line2: '', city: '', state: '', country: 'India', pincode: '' },
    bankDetails: { accountName: '', accountNumber: '', bankName: '', ifscCode: '', branch: '', upiId: '' },
    settings: {
      invoicePrefix: 'INV', quotationPrefix: 'QUO',
      defaultPaymentTerms: 30, defaultTaxRate: 18,
      defaultCgstRate: 9, defaultSgstRate: 9, defaultIgstRate: 0,
      taxEnabled: true, gstEnabled: true,
      autoSendInvoice: false, emailNotifications: true,
      reminderDaysBefore: [3, 7], reminderDaysAfter: [1, 3, 7, 14],
    },
  });

  useEffect(() => {
    const fetchBusiness = async () => {
      try {
        const res = await fetch('/api/business');
        if (res.ok) {
          const data = await res.json();
          const biz = data.data?.business;
          if (biz) {
            setBusiness(biz);
            setFormData({
              name: biz.name || '',
              email: biz.email || '',
              phone: biz.phone || '',
              gstin: biz.gstin || '',
              pan: biz.pan || '',
              address: biz.address || { line1: '', line2: '', city: '', state: '', country: 'India', pincode: '' },
              bankDetails: biz.bankDetails || { accountName: '', accountNumber: '', bankName: '', ifscCode: '', branch: '', upiId: '' },
              settings: { ...formData.settings, ...biz.settings },
            });
          }
        }
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    fetchBusiness();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/business', {
        method: business ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setBusiness(data.data);
      toast({ title: 'Settings Saved', description: 'Business settings updated successfully', variant: 'success' });
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to save settings', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Settings</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your business profile and preferences</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary" id="save-settings-btn">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {!business && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          No business profile found. Fill in your details below to create one.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Tab navigation */}
        <div className="metric-card p-3 space-y-1 lg:col-span-1 h-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                  : 'text-slate-400 hover:bg-[#1e293b] hover:text-white'
              }`}
              id={`tab-${tab.id}`}
            >
              <tab.icon className="w-4 h-4 flex-shrink-0" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="lg:col-span-3">
          {activeTab === 'business' && (
            <div className="metric-card space-y-6">
              <h3 className="text-base font-bold text-white">Business Profile</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Business Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} className="input text-sm" id="business-name" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Business Email *</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} className="input text-sm" id="business-email" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Phone</label>
                  <input type="tel" value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} className="input text-sm" id="business-phone" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">GSTIN</label>
                  <input type="text" value={formData.gstin} onChange={(e) => setFormData(p => ({ ...p, gstin: e.target.value }))} className="input text-sm" placeholder="22AAAAA0000A1Z5" id="business-gstin" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">PAN</label>
                  <input type="text" value={formData.pan} onChange={(e) => setFormData(p => ({ ...p, pan: e.target.value }))} className="input text-sm" id="business-pan" />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Business Address</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-400 mb-1">Street Address</label>
                    <input type="text" value={formData.address.line1} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address, line1: e.target.value } }))} className="input text-sm" id="business-address-line1" />
                  </div>
                  <div><label className="block text-xs font-medium text-slate-400 mb-1">City</label><input type="text" value={formData.address.city} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address, city: e.target.value } }))} className="input text-sm" id="business-city" /></div>
                  <div><label className="block text-xs font-medium text-slate-400 mb-1">State</label><input type="text" value={formData.address.state} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address, state: e.target.value } }))} className="input text-sm" id="business-state" /></div>
                  <div><label className="block text-xs font-medium text-slate-400 mb-1">Pincode</label><input type="text" value={formData.address.pincode} onChange={(e) => setFormData(p => ({ ...p, address: { ...p.address, pincode: e.target.value } }))} className="input text-sm" id="business-pincode" /></div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white mb-3">Bank Details (for invoice)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium text-slate-400 mb-1">Account Name</label><input type="text" value={formData.bankDetails.accountName} onChange={(e) => setFormData(p => ({ ...p, bankDetails: { ...p.bankDetails, accountName: e.target.value } }))} className="input text-sm" id="bank-account-name" /></div>
                  <div><label className="block text-xs font-medium text-slate-400 mb-1">Account Number</label><input type="text" value={formData.bankDetails.accountNumber} onChange={(e) => setFormData(p => ({ ...p, bankDetails: { ...p.bankDetails, accountNumber: e.target.value } }))} className="input text-sm" id="bank-account-number" /></div>
                  <div><label className="block text-xs font-medium text-slate-400 mb-1">Bank Name</label><input type="text" value={formData.bankDetails.bankName} onChange={(e) => setFormData(p => ({ ...p, bankDetails: { ...p.bankDetails, bankName: e.target.value } }))} className="input text-sm" id="bank-name" /></div>
                  <div><label className="block text-xs font-medium text-slate-400 mb-1">IFSC Code</label><input type="text" value={formData.bankDetails.ifscCode} onChange={(e) => setFormData(p => ({ ...p, bankDetails: { ...p.bankDetails, ifscCode: e.target.value } }))} className="input text-sm" id="bank-ifsc" /></div>
                  <div className="sm:col-span-2"><label className="block text-xs font-medium text-slate-400 mb-1">UPI ID</label><input type="text" value={formData.bankDetails.upiId} onChange={(e) => setFormData(p => ({ ...p, bankDetails: { ...p.bankDetails, upiId: e.target.value } }))} className="input text-sm" id="bank-upi" /></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="metric-card space-y-6">
              <h3 className="text-base font-bold text-white">Billing Settings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Invoice Prefix</label>
                  <input type="text" value={formData.settings.invoicePrefix} onChange={(e) => setFormData(p => ({ ...p, settings: { ...p.settings, invoicePrefix: e.target.value } }))} className="input text-sm" id="invoice-prefix" />
                  <p className="text-xs text-slate-600 mt-1">Example: INV-2024-001</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Quotation Prefix</label>
                  <input type="text" value={formData.settings.quotationPrefix} onChange={(e) => setFormData(p => ({ ...p, settings: { ...p.settings, quotationPrefix: e.target.value } }))} className="input text-sm" id="quotation-prefix" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Default Payment Terms (days)</label>
                  <input type="number" min="0" value={formData.settings.defaultPaymentTerms} onChange={(e) => setFormData(p => ({ ...p, settings: { ...p.settings, defaultPaymentTerms: parseInt(e.target.value) || 30 } }))} className="input text-sm" id="default-payment-terms" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Default CGST Rate (%)</label>
                  <input type="number" min="0" max="50" step="0.5" value={formData.settings.defaultCgstRate} onChange={(e) => setFormData(p => ({ ...p, settings: { ...p.settings, defaultCgstRate: parseFloat(e.target.value) || 0 } }))} className="input text-sm" id="default-cgst-rate" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Default SGST Rate (%)</label>
                  <input type="number" min="0" max="50" step="0.5" value={formData.settings.defaultSgstRate} onChange={(e) => setFormData(p => ({ ...p, settings: { ...p.settings, defaultSgstRate: parseFloat(e.target.value) || 0 } }))} className="input text-sm" id="default-sgst-rate" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Default IGST Rate (%)</label>
                  <input type="number" min="0" max="100" step="0.5" value={formData.settings.defaultIgstRate} onChange={(e) => setFormData(p => ({ ...p, settings: { ...p.settings, defaultIgstRate: parseFloat(e.target.value) || 0 } }))} className="input text-sm" id="default-igst-rate" />
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-white">Options</h4>
                {[
                  { key: 'taxEnabled', label: 'Enable Tax on Invoices', desc: 'Apply tax rates to invoice line items' },
                  { key: 'gstEnabled', label: 'Enable GST', desc: 'Show CGST/SGST/IGST separately' },
                  { key: 'autoSendInvoice', label: 'Auto-send Invoices', desc: 'Automatically email invoices after creation' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-start gap-3 cursor-pointer group p-3 rounded-xl hover:bg-[#1e293b] transition-colors">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={formData.settings[opt.key as keyof typeof formData.settings] as boolean}
                        onChange={(e) => setFormData(p => ({ ...p, settings: { ...p.settings, [opt.key]: e.target.checked } }))}
                        className="sr-only"
                        id={`setting-${opt.key}`}
                      />
                      <div className={`w-10 h-6 rounded-full transition-colors ${formData.settings[opt.key as keyof typeof formData.settings] ? 'bg-indigo-500' : 'bg-slate-700'}`}>
                        <div className={`w-4 h-4 rounded-full bg-white shadow-md absolute top-1 transition-all ${formData.settings[opt.key as keyof typeof formData.settings] ? 'left-5' : 'left-1'}`} />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{opt.label}</div>
                      <div className="text-xs text-slate-500">{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="metric-card space-y-6">
              <h3 className="text-base font-bold text-white">Notification Settings</h3>
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl hover:bg-[#1e293b]">
                  <input type="checkbox" checked={formData.settings.emailNotifications} onChange={(e) => setFormData(p => ({ ...p, settings: { ...p.settings, emailNotifications: e.target.checked } }))} className="mt-1" id="email-notifications" />
                  <div>
                    <div className="text-sm font-medium text-white">Email Notifications</div>
                    <div className="text-xs text-slate-500">Receive email for payments, overdue, and system events</div>
                  </div>
                </label>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Reminder Days Before Due</label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 3, 7, 14, 30].map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const curr = formData.settings.reminderDaysBefore;
                          const updated = curr.includes(day) ? curr.filter(d => d !== day) : [...curr, day].sort((a, b) => a - b);
                          setFormData(p => ({ ...p, settings: { ...p.settings, reminderDaysBefore: updated } }));
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${formData.settings.reminderDaysBefore.includes(day) ? 'bg-indigo-500 text-white' : 'bg-[#1e293b] text-slate-400 hover:text-white'}`}
                        id={`reminder-before-${day}`}
                      >
                        {day}d before
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-2">Reminder Days After Due</label>
                  <div className="flex flex-wrap gap-2">
                    {[1, 3, 7, 14, 30].map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => {
                          const curr = formData.settings.reminderDaysAfter;
                          const updated = curr.includes(day) ? curr.filter(d => d !== day) : [...curr, day].sort((a, b) => a - b);
                          setFormData(p => ({ ...p, settings: { ...p.settings, reminderDaysAfter: updated } }));
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${formData.settings.reminderDaysAfter.includes(day) ? 'bg-red-500 text-white' : 'bg-[#1e293b] text-slate-400 hover:text-white'}`}
                        id={`reminder-after-${day}`}
                      >
                        {day}d after
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payment' && (
            <div className="metric-card space-y-6">
              <h3 className="text-base font-bold text-white">Payment Gateway</h3>
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-start gap-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold mb-1">Razorpay Configuration</p>
                  <p className="text-xs">Your Razorpay keys are configured via environment variables for security. Edit <code className="bg-amber-500/20 px-1 rounded">.env.local</code> to update them.</p>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: 'RAZORPAY_KEY_ID', desc: 'Your Razorpay Key ID (starts with rzp_)', key: 'key_id' },
                  { label: 'RAZORPAY_KEY_SECRET', desc: 'Your Razorpay Key Secret (keep secret!)', key: 'key_secret' },
                  { label: 'RAZORPAY_WEBHOOK_SECRET', desc: 'Webhook signature verification secret', key: 'webhook_secret' },
                  { label: 'NEXT_PUBLIC_RAZORPAY_KEY_ID', desc: 'Public key for Razorpay Checkout.js', key: 'pub_key' },
                ].map(item => (
                  <div key={item.key} className="p-3 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                    <code className="text-xs font-mono text-indigo-400">{item.label}</code>
                    <p className="text-xs text-slate-500 mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="metric-card space-y-6">
              <h3 className="text-base font-bold text-white">Security</h3>
              <div className="space-y-3">
                {[
                  { icon: CheckCircle, label: 'Multi-tenant data isolation', desc: 'All data is scoped to your business ID', status: true },
                  { icon: CheckCircle, label: 'Audit logging enabled', desc: 'All admin actions are logged', status: true },
                  { icon: CheckCircle, label: 'Rate limiting active', desc: 'Login attempts are rate-limited', status: true },
                  { icon: CheckCircle, label: 'Session management', desc: 'Secure HTTP-only session cookies', status: true },
                  { icon: CheckCircle, label: 'Server-side calculations', desc: 'Invoice totals always calculated server-side', status: true },
                ].map(item => (
                  <div key={item.label} className="flex items-start gap-3 p-3 rounded-xl bg-[#0f172a] border border-[#1e293b]">
                    <item.icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${item.status ? 'text-green-400' : 'text-red-400'}`} />
                    <div>
                      <div className="text-sm font-medium text-white">{item.label}</div>
                      <div className="text-xs text-slate-500">{item.desc}</div>
                    </div>
                    <div className={`ml-auto text-xs font-semibold ${item.status ? 'text-green-400' : 'text-red-400'}`}>{item.status ? 'Active' : 'Disabled'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
