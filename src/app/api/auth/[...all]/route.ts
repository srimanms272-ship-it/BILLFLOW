import { getAuth } from '@/lib/auth';
import { initializeDatabase } from '@/lib/db-init';
import { toNextJsHandler } from 'better-auth/next-js';

// Initialize database on first request
let dbInitialized = false;
async function ensureDbInit() {
  if (!dbInitialized) {
    try {
      await initializeDatabase();
      dbInitialized = true;
    } catch (err) {
      console.error('DB init error:', err);
    }
  }
}

export async function GET(request: Request) {
  await ensureDbInit();
  const auth = await getAuth();
  const handler = toNextJsHandler(auth);
  return handler.GET(request);
}

export async function POST(request: Request) {
  await ensureDbInit();
  const auth = await getAuth();
  const handler = toNextJsHandler(auth);
  return handler.POST(request);
}
