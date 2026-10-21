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
  try {
    await ensureDbInit();
    const auth = await getAuth();
    const handler = toNextJsHandler(auth);
    return await handler.GET(request);
  } catch (err: any) {
    console.error('Better Auth GET error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Auth Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDbInit();
    const auth = await getAuth();
    const handler = toNextJsHandler(auth);
    return await handler.POST(request);
  } catch (err: any) {
    console.error('Better Auth POST error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Auth Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
