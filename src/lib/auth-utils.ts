import { headers } from 'next/headers';
import { getAuth } from './auth';
import { getDb } from './db';
import { AuditLog, AuditAction } from './types';
import { ObjectId } from 'mongodb';

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

    // Support demo session cookies with actual database IDs
    if (cookieHeader.includes('billflow_demo=admin')) {
      return {
        id: '6ad7ae55863a77ee7c921a80',
        email: 'admin@billflow.io',
        name: 'Admin User',
        role: 'ADMIN',
        businessId: '6ad7ae55863a77ee7c921a7f',
        emailVerified: true,
      };
    }
    if (cookieHeader.includes('billflow_demo=client')) {
      return {
        id: '6ad7ae56863a77ee7c921a89',
        email: 'client@acme.com',
        name: 'Acme Corp Client',
        role: 'CLIENT',
        businessId: '6ad7ae55863a77ee7c921a7f',
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
 * Require admin/business role with robust business ID resolution.
 */
export async function requireAdmin(): Promise<AuthUser & { businessId: string }> {
  const user = await requireAuth();
  if (!['ADMIN', 'OWNER', 'ACCOUNTANT', 'STAFF'].includes(user.role)) {
    throw new ApiError('Forbidden', 403);
  }

  let businessId = user.businessId;
  const db = await getDb();

  // If businessId is missing or is the old demo placeholder, resolve from MongoDB
  if (!businessId || businessId === 'demo-business-001') {
    try {
      const defaultBiz = await db.collection('businesses').findOne({});
      if (defaultBiz) {
        businessId = defaultBiz._id.toString();
      } else {
        businessId = '6ad7ae55863a77ee7c921a7f';
      }
    } catch {
      businessId = '6ad7ae55863a77ee7c921a7f';
    }
  } else {
    // Verify business exists, otherwise fallback to the first business in DB
    try {
      const bizQuery = ObjectId.isValid(businessId)
        ? { $or: [{ _id: new ObjectId(businessId) }, { _id: businessId }] }
        : { _id: businessId };
      const biz = await db.collection('businesses').findOne(bizQuery as any);
      if (!biz) {
        const firstBiz = await db.collection('businesses').findOne({});
        if (firstBiz) {
          businessId = firstBiz._id.toString();
        }
      }
    } catch {
      // Keep existing businessId
    }
  }

  return { ...user, businessId: businessId! };
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
  if (error && typeof error === 'object') {
    // Check for Zod validation error
    if ('issues' in error && Array.isArray((error as any).issues)) {
      const firstIssue = (error as any).issues[0];
      const fieldPath = firstIssue?.path?.join('.') || '';
      const msg = fieldPath ? `${fieldPath}: ${firstIssue?.message}` : (firstIssue?.message || 'Validation error');
      return Response.json(
        { success: false, error: msg, details: (error as any).issues },
        { status: 400 }
      );
    }
    // Check for custom error object with message and optional statusCode
    if ('message' in error && typeof (error as any).message === 'string') {
      const status = typeof (error as any).statusCode === 'number' ? (error as any).statusCode : 400;
      return Response.json(
        { success: false, error: (error as any).message },
        { status }
      );
    }
  }
  if (error instanceof Error) {
    const msg = error.message;
    if (
      msg.includes('SSL alert number 80') ||
      msg.includes('0A000438:SSL') ||
      msg.includes('alert internal error') ||
      msg.includes('MongoServerSelectionError') ||
      msg.includes('MongoNetworkError')
    ) {
      return Response.json(
        {
          success: false,
          error:
            'MongoDB Atlas rejected connection (SSL Alert 80): Please add 0.0.0.0/0 to MongoDB Atlas under Network Access -> IP Access List.',
        },
        { status: 503 }
      );
    }
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
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
