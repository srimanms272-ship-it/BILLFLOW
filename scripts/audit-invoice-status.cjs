const { MongoClient } = require('mongodb');

async function auditInvoices() {
  const uri = process.env.MONGODB_URL || process.env.MONGODB_URI;
  if (!uri) {
    console.error('No MONGODB_URL found in environment.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('billing_system');
    const invoices = await db.collection('invoices').find({}).toArray();

    console.log(`Auditing ${invoices.length} invoices in MongoDB Atlas:`);
    let anomalousCount = 0;

    for (const inv of invoices) {
      console.log(`- Invoice ${inv.invoiceNumber || inv._id}: total=${inv.total}, amountPaid=${inv.amountPaid}, amountDue=${inv.amountDue}, status=${inv.status}`);

      if (inv.amountDue > 0 && inv.status === 'PAID') {
        anomalousCount++;
        const newStatus = (inv.amountPaid > 0) ? 'PARTIALLY_PAID' : 'PENDING';
        console.log(`  -> Correcting status from PAID to ${newStatus} because amountDue is ${inv.amountDue}`);
        await db.collection('invoices').updateOne(
          { _id: inv._id },
          { $set: { status: newStatus, updatedAt: new Date() } }
        );
      }
    }

    console.log(`\nAudit complete. Corrected ${anomalousCount} anomalous invoice(s).`);
  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await client.close();
  }
}

auditInvoices();
