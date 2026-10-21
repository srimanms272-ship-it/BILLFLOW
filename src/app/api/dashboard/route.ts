import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, createErrorResponse, createSuccessResponse } from '@/lib/auth-utils';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin();
    const db = await getDb();
    const { searchParams } = new URL(request.url);

    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : new Date(new Date().getFullYear(), 0, 1); // Start of year
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : new Date();

    const bId = user.businessId;

    // Run all aggregations in parallel
    const [
      invoiceStats,
      paymentStats,
      expenseStats,
      clientCount,
      monthlyRevenue,
      recentInvoices,
      overdueInvoices,
      topClients,
    ] = await Promise.all([
      // Invoice stats
      db.collection('invoices').aggregate([
        { $match: { businessId: bId, createdAt: { $gte: startDate, $lte: endDate } } },
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

      // Payment stats
      db.collection('payments').aggregate([
        { $match: { businessId: bId, status: 'SUCCESS', createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]).toArray(),

      // Expense stats
      db.collection('expenses').aggregate([
        { $match: { businessId: bId, isActive: true, expenseDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]).toArray(),

      // Client count
      db.collection('clients').countDocuments({ businessId: bId, isActive: true }),

      // Monthly revenue (last 12 months)
      db.collection('payments').aggregate([
        {
          $match: {
            businessId: bId,
            status: 'SUCCESS',
            createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 11)) },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            revenue: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]).toArray(),

      // Recent invoices
      db.collection('invoices')
        .find({ businessId: bId })
        .sort({ createdAt: -1 })
        .limit(5)
        .toArray(),

      // Overdue invoices
      db.collection('invoices')
        .find({
          businessId: bId,
          status: { $in: ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE'] },
          dueDate: { $lt: new Date() },
        })
        .sort({ dueDate: 1 })
        .limit(10)
        .toArray(),

      // Top clients by revenue
      db.collection('payments').aggregate([
        { $match: { businessId: bId, status: 'SUCCESS', createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$clientId', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
        { $limit: 5 },
      ]).toArray(),
    ]);

    // Process invoice stats
    const statsMap = new Map(invoiceStats.map(s => [s._id, s]));
    const totalInvoiced = invoiceStats.reduce((sum, s) => sum + (s.total || 0), 0);
    const totalPaid = paymentStats[0]?.total || 0;
    const totalExpenses = expenseStats[0]?.total || 0;
    const totalOutstanding = invoiceStats
      .filter(s => ['SENT', 'VIEWED', 'PARTIALLY_PAID', 'OVERDUE', 'PENDING'].includes(s._id))
      .reduce((sum, s) => sum + (s.due || 0), 0);
    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + (inv.amountDue || 0), 0);

    // Enrich recent invoices with client names
    const clientIds = [...new Set([...recentInvoices, ...overdueInvoices].map(i => i.clientId))];
    const clients = await db.collection('clients')
      .find({ _id: { $in: clientIds.map(id => { try { return new ObjectId(id); } catch { return id; } }) } })
      .project({ _id: 1, name: 1, email: 1 })
      .toArray();
    const clientMap = new Map(clients.map(c => [c._id.toString(), c]));

    // Enrich top clients
    const topClientIds = topClients.map(tc => tc._id);
    const topClientDocs = await db.collection('clients')
      .find({ _id: { $in: topClientIds.map(id => { try { return new ObjectId(id); } catch { return id; } }) } })
      .project({ _id: 1, name: 1, company: 1 })
      .toArray();
    const topClientMap = new Map(topClientDocs.map(c => [c._id.toString(), c]));

    return createSuccessResponse({
      summary: {
        totalInvoiced,
        totalPaid,
        totalOutstanding,
        totalOverdue,
        totalExpenses,
        profit: totalPaid - totalExpenses,
        clientCount,
        invoiceCount: invoiceStats.reduce((sum, s) => sum + s.count, 0),
        paymentCount: paymentStats[0]?.count || 0,
      },
      invoicesByStatus: invoiceStats,
      monthlyRevenue: monthlyRevenue.map(m => ({
        month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
        revenue: m.revenue,
        count: m.count,
      })),
      recentInvoices: recentInvoices.map(inv => {
        const total = Number(inv.total || 0);
        const amountPaid = Number(inv.amountPaid || 0);
        const amountDue = Number(inv.amountDue ?? (total - amountPaid));
        const isPaid = (inv.status === 'PAID' || amountDue <= 0) && amountPaid >= total && total > 0;
        const normalizedStatus = isPaid
          ? 'PAID'
          : (amountDue > 0 && inv.status === 'PAID')
          ? (amountPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING')
          : (inv.status || 'PENDING');
        return {
          ...inv,
          status: normalizedStatus,
          client: clientMap.get(inv.clientId),
        };
      }),
      overdueInvoices: overdueInvoices.map(inv => ({
        ...inv,
        client: clientMap.get(inv.clientId),
      })),
      topClients: topClients.map(tc => ({
        ...topClientMap.get(tc._id),
        revenue: tc.total,
      })),
    });
  } catch (err) {
    return createErrorResponse(err);
  }
}
