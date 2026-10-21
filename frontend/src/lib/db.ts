import { MongoClient, Db } from 'mongodb';

const MONGODB_URL = process.env.MONGODB_URL || '';

interface GlobalMongo {
  conn: { client: MongoClient; db: Db } | null;
  promise: Promise<{ client: MongoClient; db: Db }> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongo: GlobalMongo | undefined;
}

const cached: GlobalMongo = global._mongo ?? { conn: null, promise: null };
if (!global._mongo) {
  global._mongo = cached;
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  if (!MONGODB_URL) {
    throw new Error('Please define the MONGODB_URL environment variable');
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      maxPoolSize: 10,
      minPoolSize: 2,
      socketTimeoutMS: 30000,
      connectTimeoutMS: 30000,
    };

    cached.promise = MongoClient.connect(MONGODB_URL, opts).then((client) => {
      let dbName = 'billing_system';
      try {
        const parsed = new URL(MONGODB_URL);
        const path = parsed.pathname.replace(/^\//, '').split('/')[0];
        if (path) dbName = path;
      } catch {
        // Fallback to default database name
      }
      const db = client.db(dbName);
      return { client, db };
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}
