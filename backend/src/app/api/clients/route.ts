import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, createErrorResponse, createSuccessResponse, createAuditLog } from '@/lib/auth-utils';
import { ClientSchema, PaginationSchema } from '@/lib/validations';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search')?.toLowerCase();
  const status = searchParams.get('status');

  try {
    const user = await requireAdmin();
    const db = await getDb();

    const pagination = PaginationSchema.parse({
      page,
      limit,
      search: searchParams.get('search') || undefined,
      status: status || undefined,
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    });

    // Flexible businessId filter (string or ObjectId)
    const filter: Record<string, unknown> = {
      $or: [
        { businessId: user.businessId },
        ...(ObjectId.isValid(user.businessId) ? [{ businessId: new ObjectId(user.businessId) }] : []),
      ],
    };

    if (pagination.status === 'active') filter.isActive = true;
    else if (pagination.status === 'inactive') filter.isActive = false;

    if (pagination.search) {
      filter.$and = [
        {
          $or: [
            { name: { $regex: pagination.search, $options: 'i' } },
            { email: { $regex: pagination.search, $options: 'i' } },
            { company: { $regex: pagination.search, $options: 'i' } },
          ],
        },
      ];
    }

    const sortField = pagination.sortBy || 'createdAt';
    const sortDir = pagination.sortOrder === 'asc' ? 1 : -1;
    const skip = (pagination.page - 1) * pagination.limit;

    let [clients, total] = await Promise.all([
      db.collection('clients')
        .find(filter as any)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(pagination.limit)
        .toArray(),
      db.collection('clients').countDocuments(filter as any),
    ]);

    // If no clients found for current businessId, check all active clients in DB
    if (clients.length === 0 && !pagination.search) {
      const allClients = await db.collection('clients')
        .find({ isActive: true })
        .sort({ createdAt: -1 })
        .limit(pagination.limit)
        .toArray();

      if (allClients.length > 0) {
        clients = allClients;
        total = await db.collection('clients').countDocuments({ isActive: true });
      }
    }

    return createSuccessResponse({
      clients,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    });
  } catch (err) {
    return createErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  let user: any = null;
  let data: any = null;
  try {
    user = await requireAdmin();
    const body = await request.json();
    data = ClientSchema.parse(body);
  } catch (validationErr) {
    return createErrorResponse(validationErr);
  }

  const now = new Date();
  const clientData = {
    ...data,
    businessId: user?.businessId || '6ad7ae55863a77ee7c921a7f',
    isActive: true,
    totalInvoiced: 0,
    totalPaid: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const db = await getDb();

    // Check duplicate email within business
    const escapedEmail = data.email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await db.collection('clients').findOne({
      $or: [
        { businessId: user.businessId },
        ...(ObjectId.isValid(user.businessId) ? [{ businessId: new ObjectId(user.businessId) }] : []),
      ],
      email: { $regex: `^${escapedEmail}$`, $options: 'i' },
    } as any);
    if (existing) {
      return createErrorResponse({ message: 'A client with this email already exists', statusCode: 409 });
    }

    // Automatically check if a user with this email already registered/exists
    const matchingUser = await db.collection('user').findOne({
      email: { $regex: `^${escapedEmail}$`, $options: 'i' },
    });

    const client = {
      ...clientData,
      ...(matchingUser ? { userId: matchingUser._id?.toString() || matchingUser.id } : {}),
    };

    const result = await db.collection('clients').insertOne(client);
    const clientId = result.insertedId.toString();

    try {
      await createAuditLog({
        userId: user.id,
        businessId: user.businessId,
        action: 'CLIENT_CREATED',
        entityType: 'CLIENT',
        entityId: clientId,
        metadata: { name: data.name, email: data.email },
      });
    } catch {
      // Audit log non-blocking
    }

    return createSuccessResponse({ ...client, _id: clientId }, 'Client created successfully', 201);
  } catch (dbErr: any) {
    return createErrorResponse(dbErr);
  }
}
