import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { getSession, createErrorResponse, createSuccessResponse, ApiError } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('Unauthorized', 401);

    const db = await getDb();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unread') === 'true';

    const filter: Record<string, unknown> = { userId: session.id };
    if (unreadOnly) filter.isRead = false;

    const skip = (page - 1) * limit;
    const [notifications, total, unreadCount] = await Promise.all([
      db.collection('notifications').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      db.collection('notifications').countDocuments(filter),
      db.collection('notifications').countDocuments({ userId: session.id, isRead: false }),
    ]);

    return createSuccessResponse({ notifications, total, unreadCount, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    return createErrorResponse(err);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new ApiError('Unauthorized', 401);

    const db = await getDb();
    const body = await request.json();
    const { action, notificationId } = body;

    if (action === 'mark-all-read') {
      await db.collection('notifications').updateMany(
        { userId: session.id, isRead: false },
        { $set: { isRead: true } }
      );
      return createSuccessResponse(null, 'All notifications marked as read');
    }

    if (action === 'mark-read' && notificationId) {
      await db.collection('notifications').updateOne(
        { _id: notificationId as unknown as import('mongodb').ObjectId, userId: session.id },
        { $set: { isRead: true } }
      );
      return createSuccessResponse(null, 'Notification marked as read');
    }

    throw new ApiError('Invalid action', 400);
  } catch (err) {
    return createErrorResponse(err);
  }
}
