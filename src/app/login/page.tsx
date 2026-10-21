'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from '@/lib/auth-client';
import { Eye, EyeOff, Zap, Mail, Lock, ArrowRight, Loader2, Shield, User } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};
    if (!email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'Invalid email address';
    if (!password) newErrors.password = 'Password is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const executeLogin = async (loginEmail: string, loginPass: string) => {
    setLoading(true);
    setErrors({});

    try {
      const result = await signIn.email({
        email: loginEmail.toLowerCase().trim(),
        password: loginPass,
      });

      if (result.error) {
        const errorMsg =
          result.error.message ||
          (result.error.status === 401
            ? 'Invalid email or password. Please check your credentials.'
            : 'Authentication failed. Please try again.');
        setErrors({ general: errorMsg });
        setLoading(false);
        return;
      }

      // Check role for redirect
      const user = (result.data as any)?.user;
      if (user?.role === 'CLIENT') {
        window.location.href = '/client/dashboard';
      } else {
        window.location.href = '/admin/dashboard';
      }
    } catch {
      setErrors({ general: 'Something went wrong. Please try again.' });
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    await executeLogin(email, password);
  };

  const handleQuickLogin = async (quickEmail: string, quickPass: string) => {
    setEmail(quickEmail);
    setPassword(quickPass);
    await executeLogin(quickEmail, quickPass);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] via-[#0f172a] to-[#0a0e1a] flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md animate-fade-in my-8">
        {/* Logo */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <Zap className="w-8 h-8 text-indigo-400" />
            <span className="text-2xl font-black gradient-text">BillFlow</span>
          </Link>
          <h1 className="text-3xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-400 mt-1 text-sm">Sign in to your account to continue</p>
        </div>

        {/* Demo Credentials Quick-Fill Cards */}
        <div className="mb-6 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-sm">
          <div className="text-xs font-semibold text-indigo-300 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-indigo-400" /> One-Click Demo Logins
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin('admin@billflow.io', 'Password123!')}
              className="p-2.5 rounded-xl bg-[#0f172a] hover:bg-indigo-600/20 border border-indigo-500/30 text-left transition-all group"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-white group-hover:text-indigo-300">
                <Shield className="w-3.5 h-3.5 text-indigo-400" /> Admin
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">Apex Infotech</div>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleQuickLogin('client@acme.com', 'Password123!')}
              className="p-2.5 rounded-xl bg-[#0f172a] hover:bg-emerald-600/20 border border-emerald-500/30 text-left transition-all group"
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-white group-hover:text-emerald-300">
                <User className="w-3.5 h-3.5 text-emerald-400" /> Client
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">Acme Corp</div>
            </button>
          </div>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 border border-white/5">
          {errors.general && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">!</div>
              {errors.general}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" id="login-form">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={`input pl-11 ${errors.email ? 'border-red-500/50 focus:border-red-500' : ''}`}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
              {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm font-medium text-slate-300">
                  Password
                </label>
                <Link href="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={`input pl-11 pr-11 ${errors.password ? 'border-red-500/50' : ''}`}
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 rounded-md"
                  id="toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              id="login-submit"
              className="btn btn-primary w-full py-3 rounded-xl text-base"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
              ) : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <p className="text-slate-400 text-sm">
              Don't have an account?{' '}
              <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                Create one free
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Protected by role-based session verification & rate limiting
        </p>
      </div>
    </div>
  );
}
