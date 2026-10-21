import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;

// Manual implementations for methods not on the react client
export async function forgetPassword(opts: { email: string; redirectTo: string }) {
  const res = await fetch('/api/auth/forget-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  return res.json();
}

export async function resetPassword(opts: { token: string; newPassword: string }) {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  return res.json();
}

export async function sendVerificationEmail(opts: { email: string }) {
  const res = await fetch('/api/auth/send-verification-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  return res.json();
}

export async function verifyEmail(opts: { token: string }) {
  const res = await fetch('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  return res.json();
}

