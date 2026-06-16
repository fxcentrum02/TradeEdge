// ===========================================
// DATABASE RESTORE ENDPOINT
// GET /api/admin/restore?secret=<CRON_SECRET>
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getBackupDB } from '@/lib/db';
import { createIndexes } from '@/lib/db/indexes';
import { remoteLog } from '@/lib/logger';
import { pusherServer } from '@/lib/pusher';
import type { ApiResponse } from '@/types';
import { MongoClient } from 'mongodb';

const TARGET_DATABASE_URL = 'mongodb+srv://tradeedge321_db_user:5Lih1i7NGI1ycG5n@cluster0.2izsdza.mongodb.net/TradeEdge';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    let targetClient: MongoClient | null = null;
    try {
        // Authenticate request using cron secret query parameter or a hardcoded fallback
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        const cronSecret = process.env.CRON_SECRET;
        const fallbackSecret = 'f7a0c8b2d4e6f8a0c2e4f6a8b0c2d4e6f8a0c2e4f6a8b0c2d4e6f8a0c2e4f6a8';

        const isAuthorized = (cronSecret && secret === cronSecret) || (secret === fallbackSecret);

        if (!isAuthorized) {
            console.error('[Restore] Unauthorized attempt');
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Restore] Starting database restore...');
        const startTime = Date.now();

        // 1. Connect to both databases
        // Source DB is the backup database
        const sourceDb = await getBackupDB();
        
        // Target DB is the new main database (hardcoded to avoid affecting live Vercel config)
        console.log('[Restore] Connecting directly to target database...');
        targetClient = await MongoClient.connect(TARGET_DATABASE_URL, {
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,
        });
        const targetDb = targetClient.db('TradeEdge');

        if (!sourceDb) {
            console.error('[Restore] Backup database connection failed');
            return NextResponse.json({ success: false, error: 'Backup (Source) database connection failed' }, { status: 500 });
        }
        if (!targetDb) {
            console.error('[Restore] Main database connection failed');
            return NextResponse.json({ success: false, error: 'Main (Target) database connection failed' }, { status: 500 });
        }

        // 2. Fetch all collections from the backup database
        const collections = await sourceDb.listCollections().toArray();
        console.log(`[Restore] Found ${collections.length} collections in backup DB`);

        const results: Record<string, any> = {};

        for (const collInfo of collections) {
            const name = collInfo.name;
            // Skip system collections
            if (name.startsWith('system.')) continue;

            try {
                const sourceColl = sourceDb.collection(name);
                const targetColl = targetDb.collection(name);

                const count = await sourceColl.countDocuments();
                console.log(`[Restore] Collection "${name}" has ${count} documents`);

                if (count === 0) {
                    results[name] = { count: 0, status: 'skipped (empty)' };
                    continue;
                }

                // Delete any existing documents in the target collection
                await targetColl.deleteMany({});

                // Fetch documents from source
                const docs = await sourceColl.find({}).toArray();

                // Insert into target in chunks of 500 to prevent BSON limit issues
                const chunkSize = 500;
                let inserted = 0;
                for (let i = 0; i < docs.length; i += chunkSize) {
                    const chunk = docs.slice(i, i + chunkSize);
                    await targetColl.insertMany(chunk);
                    inserted += chunk.length;
                }

                results[name] = { count: inserted, status: 'copied' };
                console.log(`[Restore] Copied ${inserted} docs for collection "${name}"`);
            } catch (err: any) {
                console.error(`[Restore] Error migrating collection "${name}":`, err);
                results[name] = { error: String(err), status: 'failed' };
            }
        }

        // 3. Set up indexes on the target database
        console.log('[Restore] Creating indexes on target database...');
        const originalUrl = process.env.DATABASE_URL;
        try {
            process.env.DATABASE_URL = TARGET_DATABASE_URL;
            await createIndexes();
            console.log('[Restore] Indexes set up successfully');
        } catch (indexErr: any) {
            console.error('[Restore] Failed to set up indexes:', indexErr);
            results['_indexes'] = { error: String(indexErr), status: 'failed' };
        } finally {
            process.env.DATABASE_URL = originalUrl;
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const totalDocs = Object.values(results).reduce(
            (sum: number, val: any) => sum + (typeof val?.count === 'number' ? val.count : 0),
            0
        );

        console.log(`[Restore] Database restore completed in ${duration}s. Total documents: ${totalDocs}`);
        remoteLog('Database restore succeeded', { durationSeconds: duration, totalDocuments: totalDocs });

        // Notify admins via Pusher
        try {
            await pusherServer.trigger('admin-notifications', 'cron-event', {
                type: 'RESTORE',
                message: `Database Restore Completed: ${totalDocs} documents migrated in ${duration}s`,
                timestamp: new Date().toISOString()
            });
        } catch (pusherErr) {
            console.error('[Restore] Failed to send Pusher notification:', pusherErr);
        }

        return NextResponse.json({
            success: true,
            data: {
                results,
                durationSeconds: duration,
                totalDocuments: totalDocs
            },
            message: `Successfully migrated ${totalDocs} documents in ${duration}s.`
        });

    } catch (error: any) {
        console.error('[Restore] Unhandled error during restore:', error);
        remoteLog('Database restore failed', { error: String(error) }, 'ERROR');
        return NextResponse.json({ success: false, error: 'Database restore failed: ' + String(error) }, { status: 500 });
    } finally {
        if (targetClient) {
            await targetClient.close();
        }
    }
}
