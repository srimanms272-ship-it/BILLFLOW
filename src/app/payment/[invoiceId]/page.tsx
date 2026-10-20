'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, CheckCircle, CreditCard, ArrowLeft, Shield, Lock } from 'lucide-react';
import { Zap } from 'lucide-react';

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open(): void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface InvoiceData {
  invoice: Record<string, unknown>;
  client: Record<string, unknown> | null;
  business: Record<string, unknown> | null;
  payments: Record<string, unknown>[];
}

function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PaymentPage() {
  const { invoiceId } = useParams();
  const router = useRouter();
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ receiptNumber: string; amount: number; paymentId: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await fetch(`/api/invoices/${invoiceId}`);
        if (!res.ok) throw new Error('Invoice not found');
        const json = await res.json();
        setData(json.data);
        const amountDue = json.data?.invoice?.amountDue || 0;
        setPaymentAmount((amountDue / 100).toFixed(2));
      } catch {
        setError('Invoice not found or not accessible.');
      } finally {
        setLoading(false);
      }
    };
    if (invoiceId) fetchInvoice();
  }, [invoiceId]);

  const handlePayment = async () => {
    setPaymentLoading(true);
    setError('');

    try {
      const amountNum = parseFloat(paymentAmount);
      if (!amountNum || amountNum <= 0) throw new Error('Please enter a valid amount');
      
      const invoice = data?.invoice;
      const amountDue = (invoice?.amountDue as number) || 0;
      if (amountNum * 100 > amountDue) throw new Error('Amount exceeds amount due');

      // Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Payment gateway could not be loaded. Please try again.');

      // Create order
      const orderRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-order',
          invoiceId,
          amount: amountNum,
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create payment order');

      const client = data?.client;
      const business = data?.business;

      // Open Razorpay checkout
      const options: RazorpayOptions = {
        key: orderData.data.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
        amount: orderData.data.amount,
        currency: orderData.data.currency || 'INR',
        name: (business?.name as string) || 'BillFlow',
        description: `Invoice ${invoice?.invoiceNumber}`,
        order_id: orderData.data.orderId,
        prefill: {
          name: client?.name as string,
          email: client?.email as string,
          contact: client?.phone as string,
        },
        theme: { color: '#6366f1' },
        handler: async (response: RazorpayResponse) => {
          // Verify payment on server
          try {
            const verifyRes = await fetch('/api/payments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'verify',
                invoiceId,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Payment verification failed');

            setSuccess({
              receiptNumber: verifyData.data?.receiptNumber,
              amount: amountNum,
              paymentId: response.razorpay_payment_id,
            });
          } catch (verifyErr) {
            setError(verifyErr instanceof Error ? verifyErr.message : 'Payment verification failed. Please contact support.');
          }
          setPaymentLoading(false);
        },
        modal: {
          ondismiss: () => setPaymentLoading(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
      setPaymentLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
    </div>
  );

  if (success) return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f172a] to-[#0a0e1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center animate-fade-in">
        <div className="glass rounded-2xl p-8 border border-green-500/20">
          <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Payment Successful!</h1>
          <p className="text-slate-400 mb-6">Your payment has been received and confirmed.</p>

          <div className="bg-[#0f172a] rounded-xl p-4 mb-6 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Receipt Number</span>
              <span className="text-white font-semibold">{success.receiptNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Invoice</span>
              <span className="text-white font-semibold">{data?.invoice?.invoiceNumber as string}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Amount Paid</span>
              <span className="text-green-400 font-bold">₹{success.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Transaction ID</span>
              <span className="text-slate-300 text-xs font-mono">{success.paymentId}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Link href="/client/receipts" className="btn btn-primary w-full py-3 rounded-xl justify-center">
              View Receipts
            </Link>
            <Link href="/client/invoices" className="btn btn-secondary w-full py-3 rounded-xl justify-center">
              Back to Invoices
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  if (error && !data) return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
      <div className="text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Invoice Not Found</h2>
        <p className="text-slate-400 text-sm">{error}</p>
      </div>
    </div>
  );

  const invoice = data?.invoice;
  const client = data?.client;
  const business = data?.business;
  const amountDue = (invoice?.amountDue as number) || 0;
  const total = (invoice?.total as number) || 0;
  const amountPaid = (invoice?.amountPaid as number) || 0;

  if (invoice?.status === 'PAID' || amountDue === 0) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="glass rounded-2xl p-8 border border-green-500/20">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Invoice Already Paid</h2>
            <p className="text-slate-400 text-sm mb-4">This invoice has been fully paid. No further payment is needed.</p>
            <Link href="/client/invoices" className="btn btn-secondary">View Invoices</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f172a] to-[#0a0e1a] flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/client/invoices" className="text-slate-400 hover:text-white flex items-center gap-1 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Lock className="w-3 h-3" /> Secured by Razorpay
          </div>
        </div>

        {/* Invoice summary */}
        <div className="glass rounded-2xl border border-white/5 overflow-hidden mb-4">
          {/* Business header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-white/70" />
              <span className="text-white/70 text-sm">{business?.name as string}</span>
            </div>
            <h1 className="text-xl font-black text-white">Invoice Payment</h1>
            <div className="text-white/80 text-sm mt-1">{invoice?.invoiceNumber as string}</div>
          </div>

          <div className="p-5 space-y-4">
            {/* Client */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
                <span className="text-indigo-400 font-bold text-sm">{(client?.name as string || 'C')[0].toUpperCase()}</span>
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{client?.name as string}</div>
                <div className="text-xs text-slate-400">{client?.email as string}</div>
              </div>
            </div>

            {/* Amount breakdown */}
            <div className="bg-[#0f172a] rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Invoice Total</span>
                <span>{formatAmount(total)}</span>
              </div>
              {amountPaid > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Amount Paid</span>
                  <span>{formatAmount(amountPaid)}</span>
                </div>
              )}
              <div className="border-t border-[#1e293b] pt-2 flex justify-between text-base font-black">
                <span className="text-white">Amount Due</span>
                <span className="gradient-text">{formatAmount(amountDue)}</span>
              </div>
            </div>

            {/* Payment amount input */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Payment Amount (₹) — Max: ₹{(amountDue / 100).toFixed(2)}
              </label>
              <input
                type="number"
                min="1"
                max={amountDue / 100}
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="input text-lg font-bold text-center"
                id="payment-amount-input"
              />
              {parseFloat(paymentAmount) < amountDue / 100 && (
                <p className="text-xs text-amber-400 mt-1 text-center">Partial payment — invoice will remain open</p>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            {/* Pay button */}
            <button
              onClick={handlePayment}
              disabled={paymentLoading || !paymentAmount || parseFloat(paymentAmount) <= 0}
              className="btn btn-primary w-full py-4 rounded-xl text-base font-bold"
              id="pay-now-btn"
            >
              {paymentLoading ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</>
              ) : (
                <><CreditCard className="w-5 h-5" /> Pay ₹{paymentAmount || '0.00'}</>
              )}
            </button>

            {/* Payment methods */}
            <div className="text-center">
              <p className="text-xs text-slate-500 mb-2">Powered by Razorpay — Accepts</p>
              <div className="flex items-center justify-center gap-3 text-xs text-slate-500">
                <span className="px-2 py-1 bg-[#1e293b] rounded">UPI</span>
                <span className="px-2 py-1 bg-[#1e293b] rounded">Cards</span>
                <span className="px-2 py-1 bg-[#1e293b] rounded">Net Banking</span>
                <span className="px-2 py-1 bg-[#1e293b] rounded">Wallets</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-600">
              <Shield className="w-3 h-3" />
              256-bit SSL encryption · PCI DSS compliant
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
