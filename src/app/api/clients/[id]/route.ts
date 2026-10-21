import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, createErrorResponse, createSuccessResponse, createAuditLog, ApiError } from '@/lib/auth-utils';
import { ClientSchema } from '@/lib/validations';
import { ObjectId } from 'mongodb';

interface Params { params: Promise<{ id: string }> }

async function getClientWithAuth(id: string, businessId: string) {
  const db = await getDb();
  const idQuery = ObjectId.isValid(id)
    ? { $or: [{ _id: new ObjectId(id) }, { _id: id }] }
    : { _id: id };

  const bizQuery = ObjectId.isValid(businessId)
    ? { $or: [{ businessId: new ObjectId(businessId) }, { businessId }] }
    : { businessId };

  let client = await db.collection('clients').findOne({
    ...idQuery,
    ...bizQuery,
  } as any);

  if (!client) {
    client = await db.collection('clients').findOne(idQuery as any);
  }

  if (!client) throw new ApiError('Client not found', 404);
  return { db, client, objectId: client._id };
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    const { client } = await getClientWithAuth(id, user.businessId);

    // Get client stats
    const db = await getDb();
    const [invoiceStats, recentInvoices] = await Promise.all([
      db.collection('invoices').aggregate([
        { $match: { businessId: user.businessId, clientId: id } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            total: { $sum: '$total' },
            paid: { $sum: '$amountPaid' },
          },
        },
      ]).toArray(),
      db.collection('invoices')
        .find({ businessId: user.businessId, clientId: id })
        .sort({ createdAt: -1 })
        .limit(10)
        .toArray(),
    ]);

    return createSuccessResponse({ client, invoiceStats, recentInvoices });
  } catch (err) {
    return createErrorResponse(err);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const data = ClientSchema.partial().parse(body);
    const { db, objectId } = await getClientWithAuth(id, user.businessId);

    // Check duplicate email if updating email
    if (data.email) {
      const existing = await db.collection('clients').findOne({
        businessId: user.businessId,
        email: data.email,
        _id: { $ne: objectId },
      });
      if (existing) {
        throw new ApiError('A client with this email already exists', 409);
      }
    }

    const updatePayload: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.email) {
      const escapedEmail = data.email.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchingUser = await db.collection('user').findOne({
        email: { $regex: `^${escapedEmail}$`, $options: 'i' },
      });
      if (matchingUser) {
        updatePayload.userId = matchingUser._id.toString();
      }
    }

    await db.collection('clients').updateOne(
      { _id: objectId, businessId: user.businessId },
      { $set: updatePayload }
    );

    await createAuditLog({
      userId: user.id,
      businessId: user.businessId,
      action: 'CLIENT_UPDATED',
      entityType: 'CLIENT',
      entityId: id,
    });

    const updated = await db.collection('clients').findOne({ _id: objectId });
    return createSuccessResponse(updated, 'Client updated successfully');
  } catch (err) {
    return createErrorResponse(err);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const user = await requireAdmin();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const restore = searchParams.get('restore') === 'true';
    const { db, objectId } = await getClientWithAuth(id, user.businessId);

    await db.collection('clients').updateOne(
      { _id: objectId, businessId: user.businessId },
      { $set: { isActive: restore, updatedAt: new Date() } }
    );

    await createAuditLog({
      userId: user.id,
      businessId: user.businessId,
      action: restore ? 'CLIENT_RESTORED' : 'CLIENT_DELETED',
      entityType: 'CLIENT',
      entityId: id,
    });

    return createSuccessResponse(null, restore ? 'Client restored' : 'Client deactivated');
  } catch (err) {
    return createErrorResponse(err);
  }
}
