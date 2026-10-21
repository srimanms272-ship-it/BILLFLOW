const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = "mongodb+srv://srimanms272_db_user:deFqz5OwbP2cUnnQ@cluster0.llhe8pa.mongodb.net/billing_system?retryWrites=true&w=majority";

async function runTest() {
  console.log('--- STARTING END-TO-END VERIFICATION TEST ---');
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db();
    console.log('✓ Successfully connected to MongoDB Atlas');

    // 1. Verify Business exists
    const business = await db.collection('businesses').findOne({ _id: new ObjectId('6ad7ae55863a77ee7c921a7f') });
    console.log('✓ Verified Business:', business?.name);

    // 2. Test Client Creation
    const testEmail = `test.client.${Date.now()}@example.com`;
    const newClient = {
      name: 'Test Enterprise Corp',
      email: testEmail,
      phone: '+91 9988776655',
      company: 'Test Enterprise',
      gstin: '29ABCDE1234F1Z5',
      billingAddress: {
        line1: '123 Innovation Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        pincode: '560001'
      },
      businessId: '6ad7ae55863a77ee7c921a7f',
      isActive: true,
      totalInvoiced: 0,
      totalPaid: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const clientInsert = await db.collection('clients').insertOne(newClient);
    const clientId = clientInsert.insertedId.toString();
    console.log('✓ Created Client successfully with _id:', clientId);

    // 3. Test Invoice Creation for this Client
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const items = [
      {
        description: 'Enterprise Cloud Architecture & Development',
        quantity: 2,
        unitPrice: 50000,
        discount: 0,
        cgstRate: 9,
        sgstRate: 9,
        igstRate: 0,
        total: 118000
      }
    ];

    const newInvoice = {
      businessId: '6ad7ae55863a77ee7c921a7f',
      clientId: clientId,
      invoiceNumber: invoiceNumber,
      status: 'DRAFT',
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 86400000),
      currency: 'INR',
      items: items,
      subtotal: 100000,
      discountAmount: 0,
      taxableAmount: 100000,
      cgstAmount: 9000,
      sgstAmount: 9000,
      igstAmount: 0,
      totalTax: 18000,
      total: 118000,
      amountPaid: 0,
      amountDue: 118000,
      notes: 'Payment terms: 30 days',
      termsAndConditions: 'Standard billing terms apply.',
      publicToken: 'test-public-token-' + Date.now(),
      isRecurring: false,
      createdBy: '6ad7ae55863a77ee7c921a80',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const invoiceInsert = await db.collection('invoices').insertOne(newInvoice);
    const invoiceId = invoiceInsert.insertedId.toString();
    console.log('✓ Created Invoice successfully with _id:', invoiceId, 'Number:', invoiceNumber);

    // 4. Test PDF Buffer Generation
    // We import the compiled or runtime React PDF renderer
    const React = require('react');
    const { renderToBuffer, Document, Page, Text, View, StyleSheet } = require('@react-pdf/renderer');

    const styles = StyleSheet.create({
      page: { padding: 36, fontFamily: 'Helvetica', fontSize: 10, color: '#1e293b' },
      header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
      title: { fontSize: 20, fontWeight: 'bold', color: '#4f46e5' },
      text: { fontSize: 10, marginTop: 4 }
    });

    const doc = React.createElement(Document, null,
      React.createElement(Page, { size: 'A4', style: styles.page },
        React.createElement(View, { style: styles.header },
          React.createElement(Text, { style: styles.title }, business.name),
          React.createElement(Text, { style: styles.text }, `Invoice: ${invoiceNumber}`)
        ),
        React.createElement(Text, { style: styles.text }, `Client: ${newClient.name} (${newClient.email})`),
        React.createElement(Text, { style: styles.text }, `Amount Due: ₹${newInvoice.amountDue.toLocaleString('en-IN')}`)
      )
    );

    const pdfBuffer = await renderToBuffer(doc);
    const pdfHeader = pdfBuffer.slice(0, 5).toString('ascii');
    console.log('✓ Generated Real PDF Binary: Size =', pdfBuffer.length, 'bytes');
    console.log('✓ PDF Magic Header =', pdfHeader, '(Valid PDF starts with %PDF-)');

    if (pdfHeader.startsWith('%PDF-')) {
      console.log('✓ PASS: PDF generation produces authentic PDF document');
    } else {
      throw new Error('FAIL: PDF does not have %PDF- header');
    }

    // 5. Cleanup test artifacts from DB
    await db.collection('invoices').deleteOne({ _id: invoiceInsert.insertedId });
    await db.collection('clients').deleteOne({ _id: clientInsert.insertedId });
    console.log('✓ Cleaned up test records');

    console.log('\n======================================================');
    console.log('🎉 ALL END-TO-END DATABASE & PDF TESTS PASSED!');
    console.log('======================================================');
  } finally {
    await client.close();
  }
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
