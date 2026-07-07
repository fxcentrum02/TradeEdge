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

// ========================================================
// SLOW QUERY MONITORING
// ========================================================
const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '100', 10);
const activeCommands = new Map<number, { commandName: string; collectionName: string; command: any; startTime: number }>();

function registerCommandMonitoring(client: MongoClient) {
    client.on('commandStarted', (event) => {
        const cmdName = event.commandName;
        if (['find', 'aggregate', 'update', 'delete', 'insert', 'findAndModify', 'count'].includes(cmdName)) {
            // Collection name is usually the value of the command name key
            const collName = String(event.command[cmdName] || 'unknown');
            activeCommands.set(event.requestId, {
                commandName: cmdName,
                collectionName: collName,
                command: event.command,
                startTime: Date.now(),
            });
        }
    });

    client.on('commandSucceeded', (event) => {
        const info = activeCommands.get(event.requestId);
        if (info) {
            activeCommands.delete(event.requestId);
            const duration = Date.now() - info.startTime;
            if (duration >= SLOW_QUERY_THRESHOLD_MS) {
                // Log query excluding internal details/passwords if present
                const queryLog = { ...info.command };
                // Redact sensitive fields if any exist
                if (queryLog.password) queryLog.password = '[REDACTED]';
                if (queryLog.hash) queryLog.hash = '[REDACTED]';
                
                console.warn(
                    `⚠️ [SLOW QUERY] ${info.commandName.toUpperCase()} on "${info.collectionName}" took ${duration}ms ` +
                    `(threshold: ${SLOW_QUERY_THRESHOLD_MS}ms). Command:`,
                    JSON.stringify(queryLog)
                );
            }
        }
    });

    client.on('commandFailed', (event) => {
        activeCommands.delete(event.requestId);
    });
}

let globalWithMongo = global as typeof globalThis & {
    _mongoClient?: MongoClient;
    _mongoDb?: Db;
    _mongoBackupClient?: MongoClient;
    _mongoBackupDb?: Db;
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
            monitorCommands: true,
        });

        const db = client.db(MONGODB_DB);

        // Verify connection
        await db.command({ ping: 1 });
        console.log('[DB] MongoDB connected successfully. DB:', MONGODB_DB);

        // Register slow query monitoring
        registerCommandMonitoring(client);

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

export default { connectDB, getDB, getBackupDB };
