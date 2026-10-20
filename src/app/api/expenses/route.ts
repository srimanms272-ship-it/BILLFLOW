import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, createErrorResponse, createSuccessResponse, createAuditLog, ApiError } from '@/lib/auth-utils';
import { ExpenseSchema, PaginationSchema } from '@/lib/validations';
import { rupeesToPaise } from '@/lib/calculations';
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
      sortBy: searchParams.get('sortBy') || 'expenseDate',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    });

    const filter: Record<string, unknown> = { businessId: user.businessId, isActive: true };
    const category = searchParams.get('category');
    if (category) filter.category = category;

    if (pagination.startDate || pagination.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (pagination.startDate) dateFilter.$gte = new Date(pagination.startDate);
      if (pagination.endDate) dateFilter.$lte = new Date(pagination.endDate);
      filter.expenseDate = dateFilter;
    }

    const skip = (pagination.page - 1) * pagination.limit;
    const [expenses, total, categoryStats] = await Promise.all([
      db.collection('expenses').find(filter).sort({ expenseDate: -1 }).skip(skip).limit(pagination.limit).toArray(),
      db.collection('expenses').countDocuments(filter),
      db.collection('expenses').aggregate([
        { $match: { businessId: user.businessId, isActive: true } },
        { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]).toArray(),
    ]);

    return createSuccessResponse({ expenses, total, page: pagination.page, limit: pagination.limit, totalPages: Math.ceil(total / pagination.limit), categoryStats });
  } catch (err) {
    return createErrorResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const body = await request.json();
    const data = ExpenseSchema.parse(body);
    const db = await getDb();

    const now = new Date();
    const expense = {
      ...data,
      businessId: user.businessId,
      amount: rupeesToPaise(data.amount),
      expenseDate: new Date(data.expenseDate as string),
      isActive: true,
      currency: 'INR',
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };

    const result = await db.collection('expenses').insertOne(expense);

    await createAuditLog({
      userId: user.id,
      businessId: user.businessId,
      action: 'EXPENSE_CREATED',
      entityType: 'EXPENSE',
      entityId: result.insertedId.toString(),
      metadata: { title: data.title, amount: expense.amount },
    });

    return createSuccessResponse({ ...expense, _id: result.insertedId }, 'Expense recorded', 201);
  } catch (err) {
    return createErrorResponse(err);
  }
}
