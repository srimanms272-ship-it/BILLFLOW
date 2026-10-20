import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, createErrorResponse, createSuccessResponse } from '@/lib/auth-utils';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const db = await getDb();
    const { searchParams } = new URL(request.url);

    const reportType = searchParams.get('type') || 'revenue';
    const startDate = new Date(searchParams.get('startDate') || new Date(new Date().getFullYear(), 0, 1).toISOString());
    const endDate = new Date(searchParams.get('endDate') || new Date().toISOString());
    const clientId = searchParams.get('clientId') || undefined;

    const bId = user.businessId;

    switch (reportType) {
      case 'revenue': {
        const filter: Record<string, unknown> = {
          businessId: bId,
          status: 'SUCCESS',
          createdAt: { $gte: startDate, $lte: endDate },
        };
        if (clientId) filter.clientId = clientId;

        const [payments, byMethod, byMonth] = await Promise.all([
          db.collection('payments').aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
          ]).toArray(),
          db.collection('payments').aggregate([
            { $match: filter },
            { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
          ]).toArray(),
          db.collection('payments').aggregate([
            { $match: filter },
            {
              $group: {
                _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                revenue: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
          ]).toArray(),
        ]);

        return createSuccessResponse({
          summary: payments[0] || { total: 0, count: 0 },
          byMethod,
          byMonth: byMonth.map(m => ({
            period: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
            revenue: m.revenue,
            count: m.count,
          })),
        });
      }

      case 'invoices': {
        const filter: Record<string, unknown> = {
          businessId: bId,
          createdAt: { $gte: startDate, $lte: endDate },
        };
        if (clientId) filter.clientId = clientId;

        const [byStatus, byMonth] = await Promise.all([
          db.collection('invoices').aggregate([
            { $match: filter },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                total: { $sum: '$total' },
                paid: { $sum: '$amountPaid' },
                due: { $sum: '$amountDue' },
              },
            },
          ]).toArray(),
          db.collection('invoices').aggregate([
            { $match: filter },
            {
              $group: {
                _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                count: { $sum: 1 },
                total: { $sum: '$total' },
              },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
          ]).toArray(),
        ]);

        return createSuccessResponse({
          byStatus,
          byMonth: byMonth.map(m => ({
            period: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
            count: m.count,
            total: m.total,
          })),
        });
      }

      case 'outstanding': {
        const overdueInvoices = await db.collection('invoices').aggregate([
          {
            $match: {
              businessId: bId,
              status: { $in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE', 'PENDING'] },
            },
          },
          {
            $addFields: {
              daysOverdue: {
                $divide: [
                  { $subtract: [new Date(), '$dueDate'] },
                  1000 * 60 * 60 * 24,
                ],
              },
            },
          },
          { $sort: { dueDate: 1 } },
        ]).toArray();

        const clientIds = [...new Set(overdueInvoices.map(i => i.clientId))];
        const clients = await db.collection('clients')
          .find({ _id: { $in: clientIds.map(id => { try { return new ObjectId(id); } catch { return id; } }) } })
          .project({ _id: 1, name: 1, email: 1, company: 1 })
          .toArray();
        const clientMap = new Map(clients.map(c => [c._id.toString(), c]));

        return createSuccessResponse({
          invoices: overdueInvoices.map(inv => ({ ...inv, client: clientMap.get(inv.clientId) })),
          total: overdueInvoices.reduce((s, i) => s + i.amountDue, 0),
          count: overdueInvoices.length,
        });
      }

      case 'expenses': {
        const filter: Record<string, unknown> = {
          businessId: bId,
          isActive: true,
          expenseDate: { $gte: startDate, $lte: endDate },
        };

        const [byCategory, byMonth, total] = await Promise.all([
          db.collection('expenses').aggregate([
            { $match: filter },
            { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
            { $sort: { total: -1 } },
          ]).toArray(),
          db.collection('expenses').aggregate([
            { $match: filter },
            {
              $group: {
                _id: { year: { $year: '$expenseDate' }, month: { $month: '$expenseDate' } },
                total: { $sum: '$amount' },
                count: { $sum: 1 },
              },
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
          ]).toArray(),
          db.collection('expenses').aggregate([
            { $match: filter },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
          ]).toArray(),
        ]);

        return createSuccessResponse({
          byCategory,
          byMonth: byMonth.map(m => ({
            period: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
            total: m.total,
            count: m.count,
          })),
          summary: total[0] || { total: 0, count: 0 },
        });
      }

      case 'profit': {
        const [revenue, expenses] = await Promise.all([
          db.collection('payments').aggregate([
            { $match: { businessId: bId, status: 'SUCCESS', createdAt: { $gte: startDate, $lte: endDate } } },
            {
              $group: {
                _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                revenue: { $sum: '$amount' },
              },
            },
          ]).toArray(),
          db.collection('expenses').aggregate([
            { $match: { businessId: bId, isActive: true, expenseDate: { $gte: startDate, $lte: endDate } } },
            {
              $group: {
                _id: { year: { $year: '$expenseDate' }, month: { $month: '$expenseDate' } },
                expenses: { $sum: '$amount' },
              },
            },
          ]).toArray(),
        ]);

        const periodMap = new Map<string, { revenue: number; expenses: number; profit: number }>();
        revenue.forEach(r => {
          const period = `${r._id.year}-${String(r._id.month).padStart(2, '0')}`;
          periodMap.set(period, { revenue: r.revenue, expenses: 0, profit: r.revenue });
        });
        expenses.forEach(e => {
          const period = `${e._id.year}-${String(e._id.month).padStart(2, '0')}`;
          const existing = periodMap.get(period) || { revenue: 0, expenses: 0, profit: 0 };
          periodMap.set(period, { ...existing, expenses: e.expenses, profit: existing.revenue - e.expenses });
        });

        const byMonth = Array.from(periodMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([period, data]) => ({ period, ...data }));

        const totalRevenue = byMonth.reduce((s, m) => s + m.revenue, 0);
        const totalExpenses = byMonth.reduce((s, m) => s + m.expenses, 0);

        return createSuccessResponse({
          byMonth,
          summary: { totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses },
        });
      }

      case 'gst': {
        const invoices = await db.collection('invoices').aggregate([
          { $match: { businessId: bId, createdAt: { $gte: startDate, $lte: endDate }, status: { $ne: 'CANCELLED' } } },
          {
            $group: {
              _id: null,
              totalCgst: { $sum: '$cgstAmount' },
              totalSgst: { $sum: '$sgstAmount' },
              totalIgst: { $sum: '$igstAmount' },
              totalTax: { $sum: '$totalTax' },
              totalTaxable: { $sum: '$taxableAmount' },
              count: { $sum: 1 },
            },
          },
        ]).toArray();

        return createSuccessResponse({ gstSummary: invoices[0] || { totalCgst: 0, totalSgst: 0, totalIgst: 0, totalTax: 0 } });
      }

      default:
        return createErrorResponse({ message: 'Invalid report type' });
    }
  } catch (err) {
    return createErrorResponse(err);
  }
}
