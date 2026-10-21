import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const results: Record<string, any> = {};

  // 1. Get outbound IP of the server
  try {
    const ipRes = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    const ipData = await ipRes.json();
    results.serverOutboundIp = ipData.ip;
  } catch (e: any) {
    results.serverOutboundIpError = e.message;
  }

  // 2. Read environment variables
  const url = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb+srv://srimanms272_db_user:deFqz5OwbP2cUnnQ@cluster0.llhe8pa.mongodb.net/billing_system?retryWrites=true&w=majority';
  
  // Mask password for display
  const maskedUrl = url.replace(/:([^:@]+)@/, ':***@');
  results.mongoUri = maskedUrl;
  results.nodeVersion = process.version;
  results.platform = process.platform;

  // 3. Test standard MongoClient connection
  try {
    const client = new MongoClient(url, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    const start = Date.now();
    await client.connect();
    const count = await client.db().collection('clients').countDocuments();
    await client.close();
    results.standardConnection = {
      success: true,
      durationMs: Date.now() - start,
      clientCount: count
    };
  } catch (err: any) {
    results.standardConnection = {
      success: false,
      name: err.name,
      message: err.message,
      code: err.code
    };
  }

  return NextResponse.json(results, { status: 200 });
}
