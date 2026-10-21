'use client';

import { useState } from 'react';
import Link from 'next/link';
import { forgetPassword } from '@/lib/auth-client';
import { Zap, Mail, ArrowRight, Loader2, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await forgetPassword({
        email: email.toLowerCase(),
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`,
      });
      // Always show success to avoid user enumeration
      setSubmitted(true);
    } catch {
      setSubmitted(true); // Still show success
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f172a] to-[#0a0e1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <Zap className="w-7 h-7 text-indigo-400" />
            <span className="text-2xl font-black gradient-text">BillFlow</span>
          </Link>
          <h1 className="text-3xl font-bold text-white">Reset your password</h1>
          <p className="text-slate-400 mt-2">Enter your email and we'll send you a reset link</p>
        </div>

        <div className="glass rounded-2xl p-8 border border-white/5">
          {submitted ? (
            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
              <p className="text-slate-400 mb-6 text-sm">
                If an account exists with <span className="text-indigo-400 font-medium">{email}</span>,
                you'll receive a password reset link within a few minutes.
              </p>
              <Link href="/login" className="btn btn-secondary w-full py-3 rounded-xl justify-center text-sm">
                Back to Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" id="forgot-password-form">
              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">{error}</div>
              )}
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="input pl-11"
                    disabled={loading}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} id="send-reset-link" className="btn btn-primary w-full py-3 rounded-xl text-base">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : <>Send Reset Link <ArrowRight className="w-4 h-4" /></>}
              </button>
              <div className="text-center">
                <Link href="/login" className="text-sm text-slate-400 hover:text-white transition-colors">Back to Sign In</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
