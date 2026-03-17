// ===========================================
// DATABASE CLIENTS (MONGODB NATIVE DRIVER)
// ===========================================

import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.DATABASE_URL!;
const MONGODB_DB = process.env.MONGODB_DB_NAME || 'TradeEdge';
// const BACKUP_MONGODB_URI = process.env.BACKUP_DATABASE_URL;
// const BACKUP_MONGODB_DB = process.env.BACKUP_MONGODB_DB_NAME || MONGODB_DB;

if (!MONGODB_URI) {
    throw new Error('[DB] DATABASE_URL environment variable is not defined!');
}

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectDB(): Promise<Db> {
    if (cachedDb && cachedClient) {
        return cachedDb;
    }

    console.log('[DB] Connecting to MongoDB...', MONGODB_URI.substring(0, 30) + '...');

    try {
        const client = await MongoClient.connect(MONGODB_URI, {
            maxPoolSize: 10,
            minPoolSize: 2,
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
        });

        const db = client.db(MONGODB_DB);

        // Verify connection
        await db.command({ ping: 1 });
        console.log('[DB] MongoDB connected successfully. DB:', MONGODB_DB);

        cachedClient = client;
        cachedDb = db;

        return db;
    } catch (error) {
        console.error('[DB] MongoDB connection FAILED:', error);
        cachedClient = null;
        cachedDb = null;
        throw error;
    }
}

export async function getDB(): Promise<Db> {
    return connectDB();
}

let cachedBackupClient: MongoClient | null = null;
let cachedBackupDb: Db | null = null;

export async function getBackupDB(): Promise<Db | null> {
    return null;
    /*
    if (!BACKUP_MONGODB_URI) return null;
    
    if (cachedBackupDb && cachedBackupClient) {
        return cachedBackupDb;
    }

    try {
        const client = await MongoClient.connect(BACKUP_MONGODB_URI, {
            maxPoolSize: 5,
            serverSelectionTimeoutMS: 10000,
        });

        const db = client.db(BACKUP_MONGODB_DB);
        cachedBackupClient = client;
        cachedBackupDb = db;
        return db;
    } catch (error) {
        console.error('[DB] Backup MongoDB connection FAILED:', error);
        return null;
    }
    */
}

export default { connectDB, getDB, getBackupDB };
