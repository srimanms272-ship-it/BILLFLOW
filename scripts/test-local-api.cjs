// Test the database and auth directly in Node.js
const { MongoClient, ObjectId } = require('mongodb');

const url = 'mongodb+srv://srimanms272_db_user:deFqz5OwbP2cUnnQ@cluster0.llhe8pa.mongodb.net/billing_system?retryWrites=true&w=majority';

async function testLocalDB() {
  console.log('Testing local connection to MongoDB Atlas...');
  const client = new MongoClient(url);
  try {
    await client.connect();
    console.log('✓ Successfully connected to MongoDB Atlas locally');
    const db = client.db('billing_system');

    // Check collections
    const collections = await db.listCollections().toArray();
    console.log('Collections in billing_system:', collections.map(c => c.name));

    // Check users
    const users = await db.collection('user').find({}).toArray();
    console.log('Users count:', users.length);
    users.forEach(u => console.log(` - User: ${u.email} (role: ${u.role}, businessId: ${u.businessId})`));

    // Check businesses
    const businesses = await db.collection('businesses').find({}).toArray();
    console.log('Businesses count:', businesses.length);
    businesses.forEach(b => console.log(` - Business: ${b.name} (_id: ${b._id})`));

    // Check clients
    const clients = await db.collection('clients').find({}).toArray();
    console.log('Clients count:', clients.length);
    clients.slice(0, 5).forEach(c => console.log(` - Client: ${c.name} (${c.email}, businessId: ${c.businessId})`));

  } catch (err) {
    console.error('Error connecting locally:', err);
  } finally {
    await client.close();
  }
}

testLocalDB();
