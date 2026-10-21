import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { getDb } from '@/lib/db';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let authInstance: any = null;

export async function getAuth(): Promise<ReturnType<typeof betterAuth>> {
  if (authInstance) return authInstance;

  const db = await getDb();

  authInstance = betterAuth({
    database: mongodbAdapter(db),
    secret:
      process.env.BETTER_AUTH_SECRET ||
      'your-super-secret-key-change-this-in-production-minimum-32-chars',
    baseURL:
      process.env.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://billflow-backend-ntt5.onrender.com',
    trustedOrigins: [
      'https://billflow-murex-phi.vercel.app',
      'https://billflow-git-frontend-backend-split-xx6148026-4193s-projects.vercel.app',
      'https://billflow.vercel.app',
      'http://localhost:3000',
      'http://localhost:5000',
      process.env.NEXT_PUBLIC_APP_URL || '',
      process.env.APP_URL || '',
    ].filter(Boolean),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
      sendResetPassword: async ({ user, url }) => {
        const { sendPasswordResetEmail } = await import('@/lib/email');
        await sendPasswordResetEmail(user.email, url, user.name || '');
      },
    },
    emailVerification: {
      sendOnSignUp: process.env.REQUIRE_EMAIL_VERIFICATION === 'true',
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        const { sendVerificationEmail } = await import('@/lib/email');
        await sendVerificationEmail(user.email, url, user.name || '');
      },
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes cache
      },
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // 24 hours
    },
    advanced: {
      cookiePrefix: 'billflow',
      useSecureCookies: process.env.NODE_ENV === 'production',
      defaultCookieAttributes: {
        sameSite: 'none',
        secure: true,
      },
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'CLIENT',
          input: false,
        },
        businessId: {
          type: 'string',
          required: false,
          input: false,
        },
        isActive: {
          type: 'boolean',
          defaultValue: true,
          input: false,
        },
        phone: {
          type: 'string',
          required: false,
        },
      },
    },
    rateLimit: {
      window: 60,
      max: 20,
      customRules: {
        '/api/auth/sign-in/email': {
          window: 60,
          max: 5,
        },
        '/api/auth/forgot-password': {
          window: 60,
          max: 3,
        },
        '/api/auth/send-verification-email': {
          window: 60,
          max: 3,
        },
      },
    },
  });

  return authInstance;
}

// Sync version for cases where we have already initialized
export { authInstance };
