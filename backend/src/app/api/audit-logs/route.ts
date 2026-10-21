import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, createErrorResponse, createSuccessResponse } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const db = await getDb();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const action = searchParams.get('action') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const filter: Record<string, unknown> = { businessId: user.businessId };
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
      filter.createdAt = dateFilter;
    }

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      db.collection('auditLogs').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('auditLogs').countDocuments(filter),
    ]);

    return createSuccessResponse({ logs, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return createErrorResponse(err);
  }
}
