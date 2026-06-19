// ===========================================
// DATABASE CLIENTS (MONGODB NATIVE DRIVER)
// ===========================================

import { MongoClient, Db } from 'mongodb';

const MONGODB_URI = process.env.DATABASE_URL!;
const MONGODB_DB = process.env.MONGODB_DB_NAME || 'TradeEdge';
const BACKUP_MONGODB_URI = process.env.BACKUP_DATABASE_URL;
const BACKUP_MONGODB_DB = process.env.BACKUP_MONGODB_DB_NAME || MONGODB_DB;

if (!MONGODB_URI) {
    throw new Error('[DB] DATABASE_URL environment variable is not defined!');
}

let globalWithMongo = global as typeof globalThis & {
    _mongoClient?: MongoClient;
    _mongoDb?: Db;
    _mongoBackupClient?: MongoClient;
    _mongoBackupDb?: Db;
    _mongoPaidClient?: MongoClient;
    _mongoPaidDb?: Db;
    _mongoFreeClient?: MongoClient;
    _mongoFreeDb?: Db;
};

export async function connectDB(): Promise<Db> {
    if (globalWithMongo._mongoDb && globalWithMongo._mongoClient) {
        return globalWithMongo._mongoDb;
    }

    console.log('[DB] Connecting to MongoDB...', MONGODB_URI.substring(0, 30) + '...');

    try {
        const client = await MongoClient.connect(MONGODB_URI, {
            maxPoolSize: 5,
            minPoolSize: 0,
            maxIdleTimeMS: 15000,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
        });

        const db = client.db(MONGODB_DB);

        // Verify connection
        await db.command({ ping: 1 });
        console.log('[DB] MongoDB connected successfully. DB:', MONGODB_DB);

        globalWithMongo._mongoClient = client;
        globalWithMongo._mongoDb = db;

        return db;
    } catch (error) {
        console.error('[DB] MongoDB connection FAILED:', error);
        globalWithMongo._mongoClient = undefined;
        globalWithMongo._mongoDb = undefined;
        throw error;
    }
}

export async function getDB(): Promise<Db> {
    return connectDB();
}

export async function getBackupDB(): Promise<Db | null> {
    if (!BACKUP_MONGODB_URI) return null;
    
    if (globalWithMongo._mongoBackupDb && globalWithMongo._mongoBackupClient) {
        return globalWithMongo._mongoBackupDb;
    }

    try {
        console.log('[DB] Connecting to BACKUP MongoDB...');
        const client = await MongoClient.connect(BACKUP_MONGODB_URI, {
            maxPoolSize: 3,
            minPoolSize: 0,
            maxIdleTimeMS: 15000,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
        });

        const db = client.db(BACKUP_MONGODB_DB);
        globalWithMongo._mongoBackupClient = client;
        globalWithMongo._mongoBackupDb = db;
        
        console.log('[DB] Backup MongoDB connected successfully. DB:', BACKUP_MONGODB_DB);
        return db;
    } catch (error) {
        console.error('[DB] Backup MongoDB connection FAILED:', error);
        return null;
    }
}

export async function getPaidDB(): Promise<Db | null> {
    const uri = process.env.PRIMARY_PAID_DATABASE_URL || process.env.PAID_DATABASE_URL;
    if (!uri) return null;
    if (globalWithMongo._mongoPaidDb && globalWithMongo._mongoPaidClient) return globalWithMongo._mongoPaidDb;
    try {
        const client = await MongoClient.connect(uri, {
            maxPoolSize: 3,
            minPoolSize: 0,
            maxIdleTimeMS: 15000,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
        });
        const db = client.db(process.env.MONGODB_DB_NAME || 'TradeEdge');
        globalWithMongo._mongoPaidClient = client;
        globalWithMongo._mongoPaidDb = db;
        return db;
    } catch (error) {
        console.error('[DB] Paid MongoDB connection FAILED:', error);
        return null;
    }
}

export async function getFreeDB(): Promise<Db | null> {
    const uri = process.env.FREE_TEST_DATABASE_URL || process.env.FREE_TEST_DB_URL;
    if (!uri) return null;
    if (globalWithMongo._mongoFreeDb && globalWithMongo._mongoFreeClient) return globalWithMongo._mongoFreeDb;
    try {
        const client = await MongoClient.connect(uri, {
            maxPoolSize: 3,
            minPoolSize: 0,
            maxIdleTimeMS: 15000,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
        });
        const db = client.db(process.env.MONGODB_DB_NAME || 'TradeEdge');
        globalWithMongo._mongoFreeClient = client;
        globalWithMongo._mongoFreeDb = db;
        return db;
    } catch (error) {
        console.error('[DB] Free MongoDB connection FAILED:', error);
        return null;
    }
}

export default { connectDB, getDB, getBackupDB, getPaidDB, getFreeDB };
