import { getDb } from '@/lib/db';

async function safeCreateIndex(collection: any, spec: any, options: any = {}) {
  try {
    await collection.createIndex(spec, options);
  } catch (err: any) {
    if (err.code === 85 || err.code === 86 || err.codeName === 'IndexOptionsConflict' || err.codeName === 'IndexKeySpecsConflict') {
      try {
        if (options?.unique) {
          const indexName = options.name || Object.keys(spec).map(k => `${k}_${spec[k]}`).join('_');
          await collection.dropIndex(indexName);
          await collection.createIndex(spec, options);
        }
      } catch {
        // Retain existing index if drop/recreate fails
      }
    }
  }
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDb();

  // Create indexes for users
  const users = db.collection('user');
  await safeCreateIndex(users, { email: 1 }, { unique: true });
  await safeCreateIndex(users, { businessId: 1 });

  // Create indexes for businesses
  const businesses = db.collection('businesses');
  await safeCreateIndex(businesses, { ownerId: 1 });
  await safeCreateIndex(businesses, { email: 1 });

  // Create indexes for clients
  const clients = db.collection('clients');
  await safeCreateIndex(clients, { businessId: 1 });
  await safeCreateIndex(clients, { businessId: 1, email: 1 });
  await safeCreateIndex(clients, { businessId: 1, isActive: 1 });
  await safeCreateIndex(clients, { businessId: 1, name: 'text', email: 'text', company: 'text' });

  // Create indexes for invoices
  const invoices = db.collection('invoices');
  await safeCreateIndex(invoices, { businessId: 1 });
  await safeCreateIndex(invoices, { businessId: 1, invoiceNumber: 1 }, { unique: true });
  await safeCreateIndex(invoices, { businessId: 1, clientId: 1 });
  await safeCreateIndex(invoices, { businessId: 1, status: 1 });
  await safeCreateIndex(invoices, { businessId: 1, dueDate: 1 });
  await safeCreateIndex(invoices, { businessId: 1, createdAt: -1 });
  await safeCreateIndex(invoices, { publicToken: 1 }, { sparse: true });
  await safeCreateIndex(invoices, { businessId: 1, invoiceNumber: 'text' });

  // Create indexes for quotations
  const quotations = db.collection('quotations');
  await safeCreateIndex(quotations, { businessId: 1 });
  await safeCreateIndex(quotations, { businessId: 1, quotationNumber: 1 }, { unique: true });
  await safeCreateIndex(quotations, { businessId: 1, clientId: 1 });
  await safeCreateIndex(quotations, { businessId: 1, status: 1 });
  await safeCreateIndex(quotations, { publicToken: 1 }, { sparse: true });

  // Create indexes for payments
  const payments = db.collection('payments');
  await safeCreateIndex(payments, { businessId: 1 });
  await safeCreateIndex(payments, { businessId: 1, invoiceId: 1 });
  await safeCreateIndex(payments, { businessId: 1, clientId: 1 });
  await safeCreateIndex(payments, { gatewayOrderId: 1 }, { sparse: true });
  await safeCreateIndex(payments, { gatewayPaymentId: 1 }, { sparse: true, unique: true });
  await safeCreateIndex(payments, { receiptNumber: 1 }, { unique: true });
  await safeCreateIndex(payments, { businessId: 1, createdAt: -1 });

  // Create indexes for expenses
  const expenses = db.collection('expenses');
  await safeCreateIndex(expenses, { businessId: 1 });
  await safeCreateIndex(expenses, { businessId: 1, expenseDate: -1 });
  await safeCreateIndex(expenses, { businessId: 1, category: 1 });
  await safeCreateIndex(expenses, { businessId: 1, isActive: 1 });

  // Create indexes for notifications
  const notifications = db.collection('notifications');
  await safeCreateIndex(notifications, { userId: 1 });
  await safeCreateIndex(notifications, { userId: 1, isRead: 1 });
  await safeCreateIndex(notifications, { businessId: 1 });
  await safeCreateIndex(notifications, { createdAt: -1 });

  // Create indexes for invoice reminders
  const reminders = db.collection('invoiceReminders');
  await safeCreateIndex(reminders, { businessId: 1 });
  await safeCreateIndex(reminders, { invoiceId: 1 });
  await safeCreateIndex(reminders, { scheduledFor: 1, isSent: 1 });

  // Create indexes for audit logs
  const auditLogs = db.collection('auditLogs');
  await safeCreateIndex(auditLogs, { businessId: 1 });
  await safeCreateIndex(auditLogs, { userId: 1 });
  await safeCreateIndex(auditLogs, { createdAt: -1 });
  await safeCreateIndex(auditLogs, { businessId: 1, createdAt: -1 });

  // Create indexes for OTPs
  const otps = db.collection('otps');
  await safeCreateIndex(otps, { email: 1, purpose: 1 });
  await safeCreateIndex(otps, { expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

  // Create indexes for recurring invoices
  const recurring = db.collection('recurringInvoices');
  await safeCreateIndex(recurring, { businessId: 1 });
  await safeCreateIndex(recurring, { nextRunDate: 1, isActive: 1 });

  // Create indexes for team members
  const teamMembers = db.collection('teamMembers');
  await safeCreateIndex(teamMembers, { businessId: 1 });
  await safeCreateIndex(teamMembers, { businessId: 1, userId: 1 }, { unique: true });

  console.log('Database indexes initialized successfully');
}
