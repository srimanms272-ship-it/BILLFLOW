import { headers } from 'next/headers';
import { getAuth } from './auth';
import { getDb } from './db';
import { AuditLog, AuditAction } from './types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  businessId?: string;
  emailVerified: boolean;
}

/**
 * Get the current authenticated user from the session.
 * Returns null if not authenticated.
 */
export async function getSession(): Promise<AuthUser | null> {
  try {
    const hdrs = await headers();
    const cookieHeader = hdrs.get('cookie') || '';

    // Support demo session cookies
    if (cookieHeader.includes('billflow_demo=admin')) {
      return {
        id: 'demo-admin-user',
        email: 'admin@billflow.io',
        name: 'Admin User',
        role: 'ADMIN',
        businessId: 'demo-business-001',
        emailVerified: true,
      };
    }
    if (cookieHeader.includes('billflow_demo=client')) {
      return {
        id: 'demo-client-user',
        email: 'client@acme.com',
        name: 'Acme Corp Client',
        role: 'CLIENT',
        businessId: 'demo-business-001',
        emailVerified: true,
      };
    }

    const auth = await getAuth();
    const session = await auth.api.getSession({ headers: hdrs });

    if (!session?.user) return null;

    const user = session.user as unknown as (AuthUser & { role?: string; businessId?: string });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: (user.role as string) || 'CLIENT',
      businessId: user.businessId as string | undefined,
      emailVerified: user.emailVerified,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication - throws if not authenticated.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getSession();
  if (!user) {
    throw new ApiError('Unauthorized', 401);
  }
  return user;
}

/**
 * Require admin/business role.
 */
export async function requireAdmin(): Promise<AuthUser & { businessId: string }> {
  const user = await requireAuth();
  if (!['ADMIN', 'OWNER', 'ACCOUNTANT', 'STAFF'].includes(user.role)) {
    throw new ApiError('Forbidden', 403);
  }
  if (!user.businessId) {
    throw new ApiError('No business associated with this account', 403);
  }
  return user as AuthUser & { businessId: string };
}

/**
 * Require that user is a client.
 */
export async function requireClient(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== 'CLIENT') {
    throw new ApiError('Forbidden: Client access only', 403);
  }
  return user;
}

/**
 * Verify that a businessId belongs to the current user's business.
 * CRITICAL: Always verify business ownership server-side.
 */
export async function verifyBusinessOwnership(
  user: AuthUser,
  targetBusinessId: string
): Promise<boolean> {
  if (!user.businessId) return false;
  return user.businessId === targetBusinessId;
}

/**
 * Get all client records associated with a user (by userId OR user email)
 * and ensure userId link is updated in the database.
 */
export async function getClientDocsForUser(
  userId: string,
  email?: string
) {
  const db = await getDb();
  const orConditions: Record<string, unknown>[] = [{ userId }];
  if (email) {
    const escapedEmail = email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    orConditions.push({ email: { $regex: `^${escapedEmail}$`, $options: 'i' } });
  }

  const clientDocs = await db.collection('clients').find({
    $or: orConditions,
  }).toArray();

  // Auto-link client documents if not yet linked with this userId
  const unlinked = clientDocs.filter(c => !c.userId || c.userId !== userId);
  if (unlinked.length > 0) {
    await db.collection('clients').updateMany(
      { _id: { $in: unlinked.map(c => c._id) } },
      { $set: { userId, updatedAt: new Date() } }
    );
  }

  return clientDocs;
}

/**
 * Verify that a client belongs to the authenticated client user.
 */
export async function verifyClientAccess(
  userId: string,
  clientId: string,
  email?: string
): Promise<boolean> {
  const db = await getDb();
  let objId: any;
  try {
    const { ObjectId } = await import('mongodb');
    objId = new ObjectId(clientId);
  } catch {
    objId = clientId;
  }

  const orConditions: Record<string, unknown>[] = [{ userId }];
  if (email) {
    const escapedEmail = email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    orConditions.push({ email: { $regex: `^${escapedEmail}$`, $options: 'i' } });
  }

  const client = await db.collection('clients').findOne({
    _id: objId,
    $or: orConditions,
  });

  if (client && (!client.userId || client.userId !== userId)) {
    await db.collection('clients').updateOne(
      { _id: client._id },
      { $set: { userId, updatedAt: new Date() } }
    );
  }

  return !!client;
}

// ==================== AUDIT LOGGING ====================
export async function createAuditLog(
  data: Omit<AuditLog, '_id' | 'createdAt'>
): Promise<void> {
  try {
    const db = await getDb();
    await db.collection('auditLogs').insertOne({
      ...data,
      createdAt: new Date(),
    });
  } catch (err) {
    // Never let audit log failures crash the main flow
    console.error('Audit log error:', err);
  }
}

// ==================== API ERROR ====================
export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

export function createErrorResponse(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { success: false, error: error.message },
      { status: error.statusCode }
    );
  }
  console.error('Unhandled error:', error);
  return Response.json(
    { success: false, error: 'Something went wrong. Please try again.' },
    { status: 500 }
  );
}

export function createSuccessResponse<T>(data: T, message?: string, status = 200): Response {
  return Response.json(
    { success: true, data, message },
    { status }
  );
}

// ==================== RATE LIMITING ====================
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

// ==================== PAGINATION HELPERS ====================
export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function buildPaginationResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginationResult<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    data,
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
