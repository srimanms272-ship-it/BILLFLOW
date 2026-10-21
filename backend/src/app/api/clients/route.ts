import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, createErrorResponse, createSuccessResponse, createAuditLog } from '@/lib/auth-utils';
import { ClientSchema, PaginationSchema } from '@/lib/validations';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const db = await getDb();
    const { searchParams } = new URL(request.url);

    const pagination = PaginationSchema.parse({
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
      search: searchParams.get('search') || undefined,
      status: searchParams.get('status') || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    });

    // Always filter by businessId - TENANT ISOLATION
    const filter: Record<string, unknown> = { businessId: user.businessId };

    if (pagination.status === 'active') filter.isActive = true;
    else if (pagination.status === 'inactive') filter.isActive = false;

    if (pagination.search) {
      filter.$text = { $search: pagination.search };
    }

    const sortField = pagination.sortBy || 'createdAt';
    const sortDir = pagination.sortOrder === 'asc' ? 1 : -1;

    const skip = (pagination.page - 1) * pagination.limit;

    const [clients, total] = await Promise.all([
      db.collection('clients')
        .find(filter)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(pagination.limit)
        .toArray(),
      db.collection('clients').countDocuments(filter),
    ]);

    return createSuccessResponse({
      clients,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.ceil(total / pagination.limit),
    });
  } catch (err) {
    return createErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = await request.json();
    const data = ClientSchema.parse(body);
    const db = await getDb();

    // Check duplicate email within business
    const escapedEmail = data.email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await db.collection('clients').findOne({
      businessId: user.businessId,
      email: { $regex: `^${escapedEmail}$`, $options: 'i' },
    });
    if (existing) {
      return createErrorResponse({ message: 'A client with this email already exists', statusCode: 409 });
    }

    // Automatically check if a user with this email already registered/exists
    const matchingUser = await db.collection('user').findOne({
      email: { $regex: `^${escapedEmail}$`, $options: 'i' },
    });

    const now = new Date();
    const client = {
      ...data,
      businessId: user.businessId,
      ...(matchingUser ? { userId: matchingUser._id.toString() } : {}),
      isActive: true,
      totalInvoiced: 0,
      totalPaid: 0,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('clients').insertOne(client);

    await createAuditLog({
      userId: user.id,
      businessId: user.businessId,
      action: 'CLIENT_CREATED',
      entityType: 'CLIENT',
      entityId: result.insertedId.toString(),
      metadata: { name: data.name, email: data.email },
    });

    return createSuccessResponse({ ...client, _id: result.insertedId }, 'Client created successfully', 201);
  } catch (err) {
    return createErrorResponse(err);
  }
}
