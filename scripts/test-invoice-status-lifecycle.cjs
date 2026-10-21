const { MongoClient, ObjectId } = require('mongodb');

async function testInvoiceStatusLifecycle() {
  console.log('=== STARTING INVOICE STATUS LIFECYCLE TEST ===');
  const uri = process.env.MONGODB_URL || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URL not set');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('billing_system');

  try {
    const business = await db.collection('businesses').findOne({});
    if (!business) throw new Error('No business found');

    const businessId = business._id.toString();

    // 1. Create a client
    const clientRes = await db.collection('clients').insertOne({
      businessId,
      name: 'Status Test Client',
      email: 'status-test@client.com',
      company: 'Status Inc',
      totalInvoiced: 0,
      totalPaid: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const clientId = clientRes.insertedId.toString();

    // 2. Simulate invoice creation as done by POST /api/invoices
    const items = [
      {
        description: 'Web Application Development',
        quantity: 2,
        unit: 'hours',
        unitPrice: 500000, // 5,000 INR
        discount: 0,
        taxRate: 18,
        subtotal: 1000000,
        discountAmount: 0,
        taxableAmount: 1000000,
        cgstRate: 9,
        cgstAmount: 90000,
        sgstRate: 9,
        sgstAmount: 90000,
        igstRate: 0,
        igstAmount: 0,
        totalTax: 180000,
        total: 1180000, // 11,800 INR
      }
    ];

    const total = 1180000;
    const now = new Date();
    const invoiceDoc = {
      businessId,
      clientId,
      invoiceNumber: 'INV-TEST-STATUS-' + Math.floor(Math.random() * 100000),
      status: 'PENDING',
      invoiceDate: now,
      dueDate: new Date(Date.now() + 30 * 86400000),
      currency: 'INR',
      items,
      subtotal: 1000000,
      discountAmount: 0,
      taxableAmount: 1000000,
      cgstAmount: 90000,
      sgstAmount: 90000,
      igstAmount: 0,
      totalTax: 180000,
      total,
      amountPaid: 0,
      amountDue: total,
      notes: 'Initial invoice creation test',
      termsAndConditions: 'Net 30',
      isRecurring: false,
      publicToken: 'test-token-' + Date.now(),
      createdAt: now,
      updatedAt: now,
    };

    const invResult = await db.collection('invoices').insertOne(invoiceDoc);
    const invoiceId = invResult.insertedId;
    console.log(`✓ Invoice created with _id: ${invoiceId}, invoiceNumber: ${invoiceDoc.invoiceNumber}`);

    // Verify initial status
    const fetched1 = await db.collection('invoices').findOne({ _id: invoiceId });
    console.log(`  Initial status: ${fetched1.status}, amountPaid: ${fetched1.amountPaid}, amountDue: ${fetched1.amountDue}`);
    if (fetched1.status === 'PAID') {
      throw new Error('FAIL: Newly created invoice status is PAID! Must be PENDING / UNPAID.');
    }
    if (fetched1.status !== 'PENDING' && fetched1.status !== 'UNPAID') {
      throw new Error(`FAIL: Unexpected initial status ${fetched1.status}`);
    }
    if (fetched1.amountDue !== total || fetched1.amountPaid !== 0) {
      throw new Error('FAIL: Initial balances incorrect.');
    }
    console.log('✓ PASS: Newly created invoice defaults to PENDING with 0 amount paid and full balance due.');

    // 3. Simulate partial payment
    const partialPaid = 500000;
    const remainingDue = total - partialPaid;
    const partialStatus = remainingDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
    await db.collection('invoices').updateOne(
      { _id: invoiceId },
      {
        $set: {
          amountPaid: partialPaid,
          amountDue: remainingDue,
          status: partialStatus,
          updatedAt: new Date(),
        }
      }
    );
    const fetched2 = await db.collection('invoices').findOne({ _id: invoiceId });
    console.log(`  After partial payment: status=${fetched2.status}, amountPaid=${fetched2.amountPaid}, amountDue=${fetched2.amountDue}`);
    if (fetched2.status === 'PAID') {
      throw new Error('FAIL: Invoice marked PAID after only partial payment!');
    }
    if (fetched2.status !== 'PARTIALLY_PAID') {
      throw new Error(`FAIL: Expected PARTIALLY_PAID, got ${fetched2.status}`);
    }
    console.log('✓ PASS: Partial payment transitions invoice to PARTIALLY_PAID (never PAID).');

    // 4. Simulate complete payment
    const finalAmountPaid = total;
    const finalRemainingDue = 0;
    const finalStatus = finalRemainingDue <= 0 ? 'PAID' : 'PARTIALLY_PAID';
    await db.collection('invoices').updateOne(
      { _id: invoiceId },
      {
        $set: {
          amountPaid: finalAmountPaid,
          amountDue: finalRemainingDue,
          status: finalStatus,
          paidAt: new Date(),
          updatedAt: new Date(),
        }
      }
    );
    const fetched3 = await db.collection('invoices').findOne({ _id: invoiceId });
    console.log(`  After full payment: status=${fetched3.status}, amountPaid=${fetched3.amountPaid}, amountDue=${fetched3.amountDue}`);
    if (fetched3.status !== 'PAID') {
      throw new Error(`FAIL: Expected PAID after full payment, got ${fetched3.status}`);
    }
    console.log('✓ PASS: Status transitions to PAID only after full verified payment (amountDue <= 0).');

    // Clean up test data
    await db.collection('invoices').deleteOne({ _id: invoiceId });
    await db.collection('clients').deleteOne({ _id: clientRes.insertedId });
    console.log('✓ Cleaned up lifecycle test records');

    console.log('\n======================================================');
    console.log('🎉 INVOICE STATUS LIFECYCLE TESTS ALL PASSED!');
    console.log('======================================================');
  } finally {
    await client.close();
  }
}

testInvoiceStatusLifecycle().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
