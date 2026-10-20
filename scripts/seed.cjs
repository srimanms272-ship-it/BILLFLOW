const fs = require('fs');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const { betterAuth } = require('better-auth');
const { mongodbAdapter } = require('better-auth/adapters/mongodb');

const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/billing_system';
const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || 'your-super-secret-key-change-this-in-production-minimum-32-chars';

async function seed() {
  console.log('Connecting to MongoDB at:', MONGODB_URL);
  const client = new MongoClient(MONGODB_URL);
  let dbName = 'billing_system';
  try {
    const parsed = new URL(MONGODB_URL);
    const path = parsed.pathname.replace(/^\//, '').split('/')[0];
    if (path) dbName = path;
  } catch {}
  const db = client.db(dbName);

  console.log('Dropping existing data for clean seed...');
  const collections = ['businesses', 'clients', 'invoices', 'payments', 'expenses', 'quotations', 'notifications', 'auditLogs', 'counters', 'user', 'session', 'account', 'verification'];
  for (const colName of collections) {
    try {
      await db.collection(colName).drop();
    } catch {
      // Ignore if doesn't exist
    }
  }

  // Create indexes
  console.log('Creating database indexes...');
  await db.collection('invoices').createIndex({ businessId: 1, invoiceNumber: 1 });
  await db.collection('invoices').createIndex({ clientId: 1 });
  await db.collection('invoices').createIndex({ status: 1 });
  await db.collection('clients').createIndex({ businessId: 1 });
  await db.collection('clients').createIndex({ userId: 1 });
  await db.collection('payments').createIndex({ businessId: 1 });
  await db.collection('payments').createIndex({ invoiceId: 1 });
  await db.collection('payments').createIndex({ gatewayPaymentId: 1 });
  await db.collection('expenses').createIndex({ businessId: 1, date: -1 });
  await db.collection('quotations').createIndex({ businessId: 1, quotationNumber: 1 });
  await db.collection('notifications').createIndex({ userId: 1, isRead: 1 });
  await db.collection('auditLogs').createIndex({ businessId: 1, createdAt: -1 });

  const now = new Date();
  const businessId = new ObjectId().toString();

  // 1. Business
  console.log('Seeding primary business entity...');
  const business = {
    _id: new ObjectId(businessId),
    name: 'Apex Infotech Solutions Pvt Ltd',
    email: 'billing@apexinfotech.com',
    phone: '+91 98765 43210',
    website: 'https://apexinfotech.com',
    gstin: '27AABCU9603R1ZM',
    pan: 'AABCU9603R',
    address: {
      line1: 'Suite 401, Cyber City Tech Park',
      line2: 'Bandra-Kurla Complex',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400051',
      country: 'India',
    },
    bankDetails: {
      bankName: 'HDFC Bank',
      accountNumber: '50200012345678',
      ifsc: 'HDFC0000240',
      accountName: 'Apex Infotech Solutions Pvt Ltd',
      upiId: 'apexinfotech@hdfcbank',
    },
    settings: {
      currency: 'INR',
      invoicePrefix: 'INV-',
      quotationPrefix: 'QTN-',
      receiptPrefix: 'RCP-',
      invoiceStartNumber: 1001,
      paymentTermsDays: 15,
      defaultTaxRate: 18,
      defaultNotes: 'Thank you for your business. For queries, contact billing@apexinfotech.com',
      defaultTerms: 'Payment is due within 15 days of invoice date. Late payments may attract 1.5% interest per month.',
    },
    createdAt: now,
    updatedAt: now,
  };
  await db.collection('businesses').insertOne(business);

  // 2. Initialize Better Auth for real hashed user creation
  console.log('Seeding system users via Better Auth...');
  const auth = betterAuth({
    database: mongodbAdapter(db),
    secret: BETTER_AUTH_SECRET,
    baseURL: 'http://localhost:3000',
    emailAndPassword: { enabled: true },
  });

  const adminSignup = await auth.api.signUpEmail({
    body: {
      email: 'admin@billflow.io',
      password: 'Password123!',
      name: 'Aditya Sharma (Admin)',
    },
  });
  const adminId = adminSignup.user.id;

  const accountantSignup = await auth.api.signUpEmail({
    body: {
      email: 'accountant@billflow.io',
      password: 'Password123!',
      name: 'Priya Verma (Accountant)',
    },
  });
  const accountantId = accountantSignup.user.id;

  const clientSignup = await auth.api.signUpEmail({
    body: {
      email: 'client@acme.com',
      password: 'Password123!',
      name: 'Vikram Patel (Client)',
    },
  });
  const clientUserId = clientSignup.user.id;

  // Update user roles and associate business
  await db.collection('user').updateOne(
    { email: 'admin@billflow.io' },
    { $set: { role: 'ADMIN', businessId, emailVerified: true, phone: '+91 98765 43210' } }
  );
  await db.collection('user').updateOne(
    { email: 'accountant@billflow.io' },
    { $set: { role: 'ACCOUNTANT', businessId, emailVerified: true, phone: '+91 98765 43211' } }
  );
  await db.collection('user').updateOne(
    { email: 'client@acme.com' },
    { $set: { role: 'CLIENT', emailVerified: true, phone: '+91 98200 11223' } }
  );

  // 3. Clients
  console.log('Seeding enterprise clients...');
  const client1Id = new ObjectId().toString();
  const client2Id = new ObjectId().toString();
  const client3Id = new ObjectId().toString();
  const client4Id = new ObjectId().toString();

  const clientsData = [
    {
      _id: new ObjectId(client1Id),
      businessId,
      userId: clientUserId,
      name: 'Vikram Patel',
      company: 'Acme Technologies Ltd',
      email: 'client@acme.com',
      phone: '+91 98200 11223',
      gstin: '27AAACA1234B1Z5',
      billingAddress: {
        line1: 'Tower B, Tech Park, Andheri East',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400069',
        country: 'India',
      },
      currency: 'INR',
      paymentTerms: 15,
      totalInvoiced: 23600000,
      totalPaid: 23600000,
      isActive: true,
      createdAt: new Date(now.getTime() - 90 * 86400000),
      updatedAt: now,
    },
    {
      _id: new ObjectId(client2Id),
      businessId,
      name: 'Ananya Roy',
      company: 'Starlight Digital Labs',
      email: 'ananya@starlightlabs.io',
      phone: '+91 98111 22334',
      gstin: '29AABCS5678C1Z2',
      billingAddress: {
        line1: 'Indiranagar 100ft Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038',
        country: 'India',
      },
      currency: 'INR',
      paymentTerms: 30,
      totalInvoiced: 41300000,
      totalPaid: 20000000,
      isActive: true,
      createdAt: new Date(now.getTime() - 60 * 86400000),
      updatedAt: now,
    },
    {
      _id: new ObjectId(client3Id),
      businessId,
      name: 'Rajesh Kumar',
      company: 'Zenith Logistics & Supply',
      email: 'rajesh@zenithlogistics.in',
      phone: '+91 98444 33221',
      gstin: '07AABCZ9876D1Z4',
      billingAddress: {
        line1: 'Connaught Place, Inner Circle',
        city: 'New Delhi',
        state: 'Delhi',
        pincode: '110001',
        country: 'India',
      },
      currency: 'INR',
      paymentTerms: 15,
      totalInvoiced: 17700000,
      totalPaid: 0,
      isActive: true,
      createdAt: new Date(now.getTime() - 40 * 86400000),
      updatedAt: now,
    },
    {
      _id: new ObjectId(client4Id),
      businessId,
      name: 'Sunita Rao',
      company: 'Quantum Retail Innovations',
      email: 'sunita@quantumretail.com',
      phone: '+91 98888 77665',
      gstin: '36AAACQ4321E1Z8',
      billingAddress: {
        line1: 'Hitec City, Madhapur',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500081',
        country: 'India',
      },
      currency: 'INR',
      paymentTerms: 15,
      totalInvoiced: 11800000,
      totalPaid: 0,
      isActive: true,
      createdAt: new Date(now.getTime() - 20 * 86400000),
      updatedAt: now,
    },
  ];
  await db.collection('clients').insertMany(clientsData);

  // 4. Invoices
  console.log('Seeding commercial invoices across all workflow states...');
  const inv1Id = new ObjectId().toString();
  const inv2Id = new ObjectId().toString();
  const inv3Id = new ObjectId().toString();
  const inv4Id = new ObjectId().toString();
  const inv5Id = new ObjectId().toString();

  const invoicesData = [
    // Invoice 1: PAID (Acme Corp)
    {
      _id: new ObjectId(inv1Id),
      businessId,
      clientId: client1Id,
      invoiceNumber: 'INV-1001',
      status: 'PAID',
      invoiceDate: new Date(now.getTime() - 45 * 86400000).toISOString().split('T')[0],
      dueDate: new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0],
      currency: 'INR',
      items: [
        {
          description: 'Full Stack Enterprise SaaS Web Application Development',
          quantity: 1,
          unit: 'Project',
          unitPrice: 15000000, // 1,50,000 INR in paise
          discount: 0,
          taxRate: 18,
          taxType: 'GST',
          taxAmount: 2700000,
          total: 17700000,
        },
        {
          description: 'DevOps, CI/CD Pipeline & Cloud Architecture Setup',
          quantity: 1,
          unit: 'Service',
          unitPrice: 5000000, // 50,000 INR
          discount: 0,
          taxRate: 18,
          taxType: 'GST',
          taxAmount: 900000,
          total: 5900000,
        },
      ],
      subtotal: 20000000,
      discountAmount: 0,
      taxBreakup: {
        cgst: 1800000, // 9%
        sgst: 1800000, // 9%
        igst: 0,
        totalTax: 3600000,
      },
      totalTax: 3600000,
      total: 23600000, // ₹2,36,000.00
      amountPaid: 23600000,
      amountDue: 0,
      notes: 'Payment received with thanks. Milestone 1 completely delivered.',
      termsAndConditions: 'Warranty period of 90 days from the completion date.',
      paidAt: new Date(now.getTime() - 29 * 86400000),
      createdBy: adminId,
      createdAt: new Date(now.getTime() - 45 * 86400000),
      updatedAt: new Date(now.getTime() - 29 * 86400000),
    },

    // Invoice 2: PARTIALLY_PAID (Starlight Digital)
    {
      _id: new ObjectId(inv2Id),
      businessId,
      clientId: client2Id,
      invoiceNumber: 'INV-1002',
      status: 'PARTIALLY_PAID',
      invoiceDate: new Date(now.getTime() - 25 * 86400000).toISOString().split('T')[0],
      dueDate: new Date(now.getTime() + 5 * 86400000).toISOString().split('T')[0],
      currency: 'INR',
      items: [
        {
          description: 'AI-Powered Analytics Dashboard & Reporting Module',
          quantity: 1,
          unit: 'Module',
          unitPrice: 35000000, // 3,50,000 INR
          discount: 0,
          taxRate: 18,
          taxType: 'GST',
          taxAmount: 6300000,
          total: 41300000,
        },
      ],
      subtotal: 35000000,
      discountAmount: 0,
      taxBreakup: {
        cgst: 0,
        sgst: 0,
        igst: 6300000, // Inter-state (MH to KA)
        totalTax: 6300000,
      },
      totalTax: 6300000,
      total: 41300000, // ₹4,13,000.00
      amountPaid: 20000000, // ₹2,00,000.00 paid
      amountDue: 21300000,  // ₹2,13,000.00 due
      notes: '50% advance received. Balance due upon sprint 4 UAT approval.',
      termsAndConditions: 'Deliverables provided subject to acceptance criteria in Master Agreement.',
      createdBy: adminId,
      createdAt: new Date(now.getTime() - 25 * 86400000),
      updatedAt: new Date(now.getTime() - 20 * 86400000),
    },

    // Invoice 3: OVERDUE (Zenith Logistics)
    {
      _id: new ObjectId(inv3Id),
      businessId,
      clientId: client3Id,
      invoiceNumber: 'INV-1003',
      status: 'OVERDUE',
      invoiceDate: new Date(now.getTime() - 35 * 86400000).toISOString().split('T')[0],
      dueDate: new Date(now.getTime() - 5 * 86400000).toISOString().split('T')[0],
      currency: 'INR',
      items: [
        {
          description: 'Custom Warehouse Inventory & Tracking System',
          quantity: 1,
          unit: 'Phase 1',
          unitPrice: 15000000,
          discount: 0,
          taxRate: 18,
          taxType: 'GST',
          taxAmount: 2700000,
          total: 17700000,
        },
      ],
      subtotal: 15000000,
      discountAmount: 0,
      taxBreakup: {
        cgst: 0,
        sgst: 0,
        igst: 2700000,
        totalTax: 2700000,
      },
      totalTax: 2700000,
      total: 17700000, // ₹1,77,000.00
      amountPaid: 0,
      amountDue: 17700000,
      notes: 'Payment is overdue. Please settle at the earliest.',
      termsAndConditions: 'Overdue invoices incur 1.5% interest per month.',
      createdBy: adminId,
      createdAt: new Date(now.getTime() - 35 * 86400000),
      updatedAt: now,
    },

    // Invoice 4: SENT / PENDING (Quantum Retail)
    {
      _id: new ObjectId(inv4Id),
      businessId,
      clientId: client4Id,
      invoiceNumber: 'INV-1004',
      status: 'SENT',
      invoiceDate: new Date(now.getTime() - 5 * 86400000).toISOString().split('T')[0],
      dueDate: new Date(now.getTime() + 10 * 86400000).toISOString().split('T')[0],
      currency: 'INR',
      items: [
        {
          description: 'Payment Gateway Integration & Automated Reconciliations',
          quantity: 1,
          unit: 'Milestone',
          unitPrice: 10000000,
          discount: 0,
          taxRate: 18,
          taxType: 'GST',
          taxAmount: 1800000,
          total: 11800000,
        },
      ],
      subtotal: 10000000,
      discountAmount: 0,
      taxBreakup: {
        cgst: 0,
        sgst: 0,
        igst: 1800000,
        totalTax: 1800000,
      },
      totalTax: 1800000,
      total: 11800000, // ₹1,18,000.00
      amountPaid: 0,
      amountDue: 11800000,
      notes: 'Invoice sent to accounts@quantumretail.com',
      termsAndConditions: 'Payment due in 15 days.',
      createdBy: adminId,
      createdAt: new Date(now.getTime() - 5 * 86400000),
      updatedAt: new Date(now.getTime() - 5 * 86400000),
    },

    // Invoice 5: DRAFT
    {
      _id: new ObjectId(inv5Id),
      businessId,
      clientId: client1Id,
      invoiceNumber: 'INV-1005',
      status: 'DRAFT',
      invoiceDate: now.toISOString().split('T')[0],
      dueDate: new Date(now.getTime() + 15 * 86400000).toISOString().split('T')[0],
      currency: 'INR',
      items: [
        {
          description: 'Monthly Cloud Infrastructure Maintenance & SLA Support',
          quantity: 1,
          unit: 'Month',
          unitPrice: 4000000, // ₹40,000
          discount: 0,
          taxRate: 18,
          taxType: 'GST',
          taxAmount: 720000,
          total: 4720000,
        },
      ],
      subtotal: 4000000,
      discountAmount: 0,
      taxBreakup: {
        cgst: 360000,
        sgst: 360000,
        igst: 0,
        totalTax: 720000,
      },
      totalTax: 720000,
      total: 4720000, // ₹47,200.00
      amountPaid: 0,
      amountDue: 4720000,
      notes: 'Draft ready for review before dispatch.',
      termsAndConditions: 'Payment due in 15 days.',
      createdBy: accountantId,
      createdAt: now,
      updatedAt: now,
    },
  ];
  await db.collection('invoices').insertMany(invoicesData);

  // 5. Payments
  console.log('Seeding transaction receipts and payments...');
  const paymentsData = [
    {
      businessId,
      clientId: client1Id,
      invoiceId: inv1Id,
      receiptNumber: 'RCP-1001',
      amount: 23600000,
      currency: 'INR',
      method: 'BANK_TRANSFER',
      status: 'SUCCESS',
      isManual: true,
      recordedBy: adminId,
      notes: 'NEFT Transfer Ref: HDFC9988776655. Confirmed by bank.',
      paidAt: new Date(now.getTime() - 29 * 86400000),
      createdAt: new Date(now.getTime() - 29 * 86400000),
      updatedAt: new Date(now.getTime() - 29 * 86400000),
    },
    {
      businessId,
      clientId: client2Id,
      invoiceId: inv2Id,
      receiptNumber: 'RCP-1002',
      amount: 20000000,
      currency: 'INR',
      method: 'RAZORPAY',
      status: 'SUCCESS',
      isManual: false,
      gatewayOrderId: 'order_LMN987654321',
      gatewayPaymentId: 'pay_KJH123456789',
      notes: 'Razorpay Online Checkout payment by client.',
      paidAt: new Date(now.getTime() - 20 * 86400000),
      createdAt: new Date(now.getTime() - 20 * 86400000),
      updatedAt: new Date(now.getTime() - 20 * 86400000),
    },
  ];
  await db.collection('payments').insertMany(paymentsData);

  // 6. Expenses
  console.log('Seeding operational expenses...');
  const expensesData = [
    {
      businessId,
      title: 'AWS Production Cloud Hosting (Mumbai Region)',
      category: 'Software & Infrastructure',
      amount: 3850000, // ₹38,500
      expenseDate: new Date(now.getTime() - 20 * 86400000),
      paymentMethod: 'CREDIT_CARD',
      vendor: 'Amazon Web Services India Pvt Ltd',
      notes: 'EC2, RDS Postgres, S3 and CloudFront usage for client instances.',
      isActive: true,
      currency: 'INR',
      createdBy: adminId,
      createdAt: new Date(now.getTime() - 20 * 86400000),
      updatedAt: new Date(now.getTime() - 20 * 86400000),
    },
    {
      businessId,
      title: 'WeWork Office Space Lease (BKC Mumbai)',
      category: 'Office & Facilities',
      amount: 8500000, // ₹85,000
      expenseDate: new Date(now.getTime() - 28 * 86400000),
      paymentMethod: 'BANK_TRANSFER',
      vendor: 'WeWork India',
      notes: '12 dedicated desks monthly lease.',
      isActive: true,
      currency: 'INR',
      createdBy: adminId,
      createdAt: new Date(now.getTime() - 28 * 86400000),
      updatedAt: new Date(now.getTime() - 28 * 86400000),
    },
    {
      businessId,
      title: 'Google Workspace & GitHub Enterprise Licenses',
      category: 'Software & Infrastructure',
      amount: 1420000, // ₹14,200
      expenseDate: new Date(now.getTime() - 15 * 86400000),
      paymentMethod: 'CREDIT_CARD',
      vendor: 'Google Cloud & GitHub',
      notes: 'Monthly developer tool seat subscriptions.',
      isActive: true,
      currency: 'INR',
      createdBy: accountantId,
      createdAt: new Date(now.getTime() - 15 * 86400000),
      updatedAt: new Date(now.getTime() - 15 * 86400000),
    },
    {
      businessId,
      title: 'Performance Marketing & LinkedIn B2B Campaigns',
      category: 'Marketing & Sales',
      amount: 2500000, // ₹25,000
      expenseDate: new Date(now.getTime() - 10 * 86400000),
      paymentMethod: 'CREDIT_CARD',
      vendor: 'LinkedIn Ads',
      notes: 'Q3 Enterprise Lead Generation Campaign.',
      isActive: true,
      currency: 'INR',
      createdBy: adminId,
      createdAt: new Date(now.getTime() - 10 * 86400000),
      updatedAt: new Date(now.getTime() - 10 * 86400000),
    },
  ];
  await db.collection('expenses').insertMany(expensesData);

  // 7. Quotations
  console.log('Seeding quotations...');
  const quotationsData = [
    {
      businessId,
      clientId: client2Id,
      quotationNumber: 'QTN-1001',
      status: 'ACCEPTED',
      quotationDate: new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0],
      validUntil: new Date(now.getTime() + 15 * 86400000).toISOString().split('T')[0],
      currency: 'INR',
      items: [
        {
          description: 'AI-Powered Analytics Dashboard & Reporting Module',
          quantity: 1,
          unit: 'Module',
          unitPrice: 35000000,
          discount: 0,
          taxRate: 18,
          taxAmount: 6300000,
          total: 41300000,
        },
      ],
      subtotal: 35000000,
      totalTax: 6300000,
      total: 41300000,
      notes: 'Quotation accepted by Ananya Roy on 5th September.',
      convertedToInvoiceId: inv2Id,
      convertedAt: new Date(now.getTime() - 25 * 86400000),
      createdBy: adminId,
      createdAt: new Date(now.getTime() - 30 * 86400000),
      updatedAt: new Date(now.getTime() - 25 * 86400000),
    },
    {
      businessId,
      clientId: client3Id,
      quotationNumber: 'QTN-1002',
      status: 'SENT',
      quotationDate: new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0],
      validUntil: new Date(now.getTime() + 23 * 86400000).toISOString().split('T')[0],
      currency: 'INR',
      items: [
        {
          description: 'Mobile Fleet Driver Companion Application (iOS & Android)',
          quantity: 1,
          unit: 'Application',
          unitPrice: 28000000, // ₹2,80,000
          discount: 5,
          taxRate: 18,
          taxAmount: 4788000,
          total: 31388000,
        },
      ],
      subtotal: 26600000,
      totalTax: 4788000,
      total: 31388000,
      notes: 'Pending procurement committee sign-off.',
      createdBy: adminId,
      createdAt: new Date(now.getTime() - 7 * 86400000),
      updatedAt: new Date(now.getTime() - 7 * 86400000),
    },
  ];
  await db.collection('quotations').insertMany(quotationsData);

  // 8. Notifications
  console.log('Seeding system notifications...');
  const notificationsData = [
    {
      userId: adminId,
      businessId,
      title: 'Payment Received',
      message: '₹2,00,000.00 received via Razorpay for INV-1002 from Starlight Digital Labs',
      category: 'PAYMENT',
      isRead: false,
      entityType: 'PAYMENT',
      entityId: inv2Id,
      actionUrl: `/admin/invoices/${inv2Id}`,
      createdAt: new Date(now.getTime() - 20 * 86400000),
    },
    {
      userId: adminId,
      businessId,
      title: 'Invoice Overdue Notice',
      message: 'Invoice INV-1003 for ₹1,77,000.00 (Zenith Logistics) is past due by 5 days.',
      category: 'INVOICE',
      isRead: false,
      entityType: 'INVOICE',
      entityId: inv3Id,
      actionUrl: `/admin/invoices/${inv3Id}`,
      createdAt: new Date(now.getTime() - 5 * 86400000),
    },
    {
      userId: adminId,
      businessId,
      title: 'Quotation Accepted',
      message: 'Quotation QTN-1001 was accepted by Starlight Digital Labs.',
      category: 'QUOTATION',
      isRead: true,
      entityType: 'QUOTATION',
      entityId: 'QTN-1001',
      actionUrl: '/admin/quotations',
      createdAt: new Date(now.getTime() - 25 * 86400000),
    },
  ];
  await db.collection('notifications').insertMany(notificationsData);

  // 9. Audit Logs
  console.log('Seeding security audit trail...');
  const auditLogsData = [
    {
      businessId,
      userId: adminId,
      action: 'INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId: inv1Id,
      metadata: { invoiceNumber: 'INV-1001', total: 23600000, client: 'Acme Technologies Ltd' },
      createdAt: new Date(now.getTime() - 45 * 86400000),
    },
    {
      businessId,
      userId: adminId,
      action: 'PAYMENT_VERIFIED',
      entityType: 'PAYMENT',
      entityId: 'RCP-1001',
      metadata: { receiptNumber: 'RCP-1001', amount: 23600000, method: 'BANK_TRANSFER' },
      createdAt: new Date(now.getTime() - 29 * 86400000),
    },
    {
      businessId,
      userId: adminId,
      action: 'INVOICE_CREATED',
      entityType: 'INVOICE',
      entityId: inv2Id,
      metadata: { invoiceNumber: 'INV-1002', total: 41300000, client: 'Starlight Digital Labs' },
      createdAt: new Date(now.getTime() - 25 * 86400000),
    },
    {
      businessId,
      userId: 'GATEWAY_WEBHOOK',
      action: 'PAYMENT_VERIFIED',
      entityType: 'PAYMENT',
      entityId: 'RCP-1002',
      metadata: { receiptNumber: 'RCP-1002', amount: 20000000, method: 'RAZORPAY' },
      createdAt: new Date(now.getTime() - 20 * 86400000),
    },
  ];
  await db.collection('auditLogs').insertMany(auditLogsData);

  // 10. Sequence Counters
  console.log('Initializing sequence counters...');
  await db.collection('counters').insertMany([
    { _id: `inv_${businessId}`, seq: 1005 },
    { _id: `qtn_${businessId}`, seq: 1002 },
    { _id: `rcp_${businessId}`, seq: 1002 },
  ]);

  console.log('\n======================================================');
  console.log('✅ DATABASE SEEDING COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
  console.log('Default Business: Apex Infotech Solutions Pvt Ltd');
  console.log('\nCredentials:');
  console.log('  Admin Account:');
  console.log('    Email:    admin@billflow.io');
  console.log('    Password: Password123!');
  console.log('  Accountant Account:');
  console.log('    Email:    accountant@billflow.io');
  console.log('    Password: Password123!');
  console.log('  Client Account:');
  console.log('    Email:    client@acme.com');
  console.log('    Password: Password123!');
  console.log('======================================================\n');

  await client.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed script error:', err);
  process.exit(1);
});
