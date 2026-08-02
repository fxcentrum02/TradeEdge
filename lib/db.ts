// ===========================================
// DATABASE CLIENTS (MONGODB NATIVE DRIVER)
// ===========================================

import { MongoClient, Db } from 'mongodb';

// URI constants are read lazily inside functions to support build-time importing

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

    const uri = process.env.DATABASE_URL;
    const dbName = process.env.MONGODB_DB_NAME || 'TradeEdge';

    if (!uri) {
        throw new Error('[DB] DATABASE_URL environment variable is not defined!');
    }

    console.log('[DB] Connecting to MongoDB...', uri.substring(0, 30) + '...');

    try {
        const client = await MongoClient.connect(uri, {
            maxPoolSize: 5,
            minPoolSize: 0,
            maxIdleTimeMS: 15000,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
            monitorCommands: true,
        });

        const db = client.db(dbName);

        // Verify connection
        await db.command({ ping: 1 });
        console.log('[DB] MongoDB connected successfully. DB:', dbName);

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
    const backupUri = process.env.BACKUP_DATABASE_URL;
    if (!backupUri) return null;

    if (globalWithMongo._mongoBackupDb && globalWithMongo._mongoBackupClient) {
        return globalWithMongo._mongoBackupDb;
    }

    const backupDbName = process.env.BACKUP_MONGODB_DB_NAME || process.env.MONGODB_DB_NAME || 'TradeEdge';

    try {
        console.log('[DB] Connecting to BACKUP MongoDB...');
        const client = await MongoClient.connect(backupUri, {
            maxPoolSize: 3,
            minPoolSize: 0,
            maxIdleTimeMS: 15000,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
        });

        const db = client.db(backupDbName);
        globalWithMongo._mongoBackupClient = client;
        globalWithMongo._mongoBackupDb = db;
        
        console.log('[DB] Backup MongoDB connected successfully. DB:', backupDbName);
        return db;
    } catch (error) {
        console.error('[DB] Backup MongoDB connection FAILED:', error);
        return null;
    }
}

export default { connectDB, getDB, getBackupDB };
