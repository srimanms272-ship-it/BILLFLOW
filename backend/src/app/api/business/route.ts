import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, createErrorResponse, createSuccessResponse, createAuditLog, ApiError } from '@/lib/auth-utils';
import { BusinessSchema, BusinessSettingsSchema } from '@/lib/validations';
import { ObjectId } from 'mongodb';

export async function GET(_req: NextRequest) {
  try {
    const user = await requireAdmin();
    const db = await getDb();

    let business = null;
    if (user.businessId) {
      const bizQuery = ObjectId.isValid(user.businessId)
        ? { $or: [{ _id: new ObjectId(user.businessId) }, { _id: user.businessId }] }
        : { _id: user.businessId };
      business = await db.collection('businesses').findOne(bizQuery as any);
    }
    if (!business) {
      business = await db.collection('businesses').findOne({});
    }

    if (!business) {
      business = {
        _id: '6ad7ae55863a77ee7c921a7f',
        name: 'Apex Infotech Solutions Pvt Ltd',
        email: 'billing@apexinfotech.in',
        phone: '+91 98765 43210',
        currency: 'INR',
        gstin: '29ABCDE1234F1Z5',
        settings: {
          invoicePrefix: 'INV',
          invoiceCounter: 1005,
          defaultPaymentTerms: 30,
          defaultTaxRate: 18,
          defaultCgstRate: 9,
          defaultSgstRate: 9,
          defaultIgstRate: 0,
          taxEnabled: true,
          gstEnabled: true,
        },
      };
    }

    return createSuccessResponse({ business });
  } catch (err) {
    return createErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await (await import('@/lib/auth-utils')).getSession();
    if (!session) throw new ApiError('Unauthorized', 401);
    if (session.businessId) throw new ApiError('You already have a business', 400);

    const body = await request.json();
    const data = BusinessSchema.parse(body);
    const db = await getDb();

    const now = new Date();
    const business = {
      ...data,
      ownerId: session.id,
      isActive: true,
      settings: {
        invoicePrefix: 'INV',
        invoiceCounter: 0,
        quotationPrefix: 'QUO',
        quotationCounter: 0,
        defaultPaymentTerms: 30,
        defaultTaxRate: 18,
        defaultCgstRate: 9,
        defaultSgstRate: 9,
        defaultIgstRate: 0,
        taxEnabled: true,
        gstEnabled: true,
        reminderDaysBefore: [3, 7],
        reminderDaysAfter: [1, 3, 7, 14],
        emailNotifications: true,
        autoSendInvoice: false,
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('businesses').insertOne(business);
    const businessId = result.insertedId.toString();

    // Update user's businessId and role
    const { getAuth } = await import('@/lib/auth');
    const auth = await getAuth();
    await db.collection('user').updateOne(
      { id: session.id },
      { $set: { businessId, role: 'ADMIN', updatedAt: now } }
    );

    // Also create team member entry
    await db.collection('teamMembers').insertOne({
      businessId,
      userId: session.id,
      role: 'OWNER',
      permissions: ['*'],
      isActive: true,
      invitedAt: now,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog({
      userId: session.id,
      businessId,
      action: 'BUSINESS_CREATED',
      entityType: 'BUSINESS',
      entityId: businessId,
      metadata: { name: data.name },
    });

    return createSuccessResponse({ ...business, _id: result.insertedId }, 'Business created', 201);
  } catch (err) {
    return createErrorResponse(err);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = await request.json();
    const db = await getDb();

    const { settings, ...profileData } = body;

    if (settings) {
      const validatedSettings = BusinessSettingsSchema.partial().parse(settings);
      await db.collection('businesses').updateOne(
        { _id: new ObjectId(user.businessId) },
        { $set: { 'settings': validatedSettings, updatedAt: new Date() } }
      );
    }

    if (Object.keys(profileData).length > 0) {
      const validatedProfile = BusinessSchema.partial().parse(profileData);
      await db.collection('businesses').updateOne(
        { _id: new ObjectId(user.businessId) },
        { $set: { ...validatedProfile, updatedAt: new Date() } }
      );
    }

    await createAuditLog({
      userId: user.id,
      businessId: user.businessId,
      action: 'SETTINGS_UPDATED',
      entityType: 'BUSINESS',
      entityId: user.businessId,
    });

    const updated = await db.collection('businesses').findOne({ _id: new ObjectId(user.businessId) });
    return createSuccessResponse(updated, 'Business settings updated');
  } catch (err) {
    return createErrorResponse(err);
  }
}
