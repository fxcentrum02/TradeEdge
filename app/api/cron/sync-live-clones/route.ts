import { NextRequest, NextResponse } from 'next/server';
import { getDB, getPaidDB, getFreeDB } from '@/lib/db';
import { remoteLog } from '@/lib/logger';
import type { ApiResponse } from '@/types';

export const dynamic = 'force-dynamic';

function getNormalizedHost(uri: string): string {
    if (!uri) return '';
    try {
        // Extract the host part: between '@' and first of '/', '?', '#', or end of string
        const match = uri.match(/@([^/?#\s]+)/);
        return match ? match[1].trim().toLowerCase() : '';
    } catch {
        return '';
    }
}

/**
 * GET /api/cron/sync-live-clones
 * Syncs the active database (DATABASE_URL) to the inactive live clone.
 * This runs hourly to maintain synchronization between paid and free databases.
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    try {
        // Skip execution on Vercel Preview environment to isolate production databases
        if (process.env.VERCEL_ENV === 'preview') {
            console.log('[Clone Sync] Skipping execution on Vercel Preview environment.');
            return NextResponse.json({ success: true, message: 'Skipped on preview environment' });
        }

        // Verify secret: support both Vercel cron header and manual Bearer token
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        const isVercelCron = request.headers.get('x-vercel-cron') === '1';
        const isManualWithSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

        if (!isVercelCron && !isManualWithSecret) {
            console.error('[Clone Sync] Unauthorized cron attempt');
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const activeUri = process.env.DATABASE_URL!;
        const paidUri = process.env.PRIMARY_PAID_DATABASE_URL || process.env.PAID_DATABASE_URL;
        const freeUri = process.env.FREE_TEST_DATABASE_URL || process.env.FREE_TEST_DB_URL;

        if (!paidUri || !freeUri) {
            console.error('[Clone Sync] Paid/Free DB URLs not configured in env');
            return NextResponse.json({ success: false, error: 'Paid/Free DB URLs not configured' }, { status: 500 });
        }

        const activeHost = getNormalizedHost(activeUri);
        const paidHost = getNormalizedHost(paidUri);
        const freeHost = getNormalizedHost(freeUri);

        if (!activeHost) {
            console.error('[Clone Sync] Active database host is invalid');
            return NextResponse.json({ success: false, error: 'Active database host is invalid' }, { status: 400 });
        }

        let targetDb = null;
        let targetLabel = '';
        let targetUri = '';

        if (activeHost === freeHost) {
            // Active is Free DB, target is Paid DB
            targetDb = await getPaidDB();
            targetLabel = 'Primary Paid DB';
            targetUri = paidUri;
        } else if (activeHost === paidHost) {
            // Active is Paid DB, target is Free DB
            targetDb = await getFreeDB();
            targetLabel = 'Free Test DB';
            targetUri = freeUri;
        } else {
            // Active matches neither - abort to avoid overwriting production DBs
            console.error(`[Clone Sync] Active host (${activeHost}) matches neither Free host (${freeHost}) nor Paid host (${paidHost}). Sync aborted for safety.`);
            return NextResponse.json({ success: false, error: 'Database host mismatch. Sync aborted for safety.' }, { status: 400 });
        }

        // Safety Guard: Abort if target host matches active host
        if (getNormalizedHost(targetUri) === activeHost) {
            console.error(`[Clone Sync] Target host matches active host (${activeHost}). Preventing self-overwrite.`);
            return NextResponse.json({ success: false, error: 'Target database matches active database. Sync aborted.' }, { status: 400 });
        }

        if (!targetDb) {
            console.error(`[Clone Sync] Failed to connect to target DB (${targetLabel})`);
            return NextResponse.json({ success: false, error: `Failed to connect to target DB (${targetLabel})` }, { status: 500 });
        }

        const sourceDb = await getDB();
        const collections = await sourceDb.listCollections().toArray();
        const collectionsToSync = collections
            .map(c => c.name)
            .filter(name => !name.startsWith('system.'));

        const results: any = {};
        const startTime = Date.now();

        console.log(`[Clone Sync] Starting hourly clone sync from active DB to ${targetLabel}...`);

        for (const collectionName of collectionsToSync) {
            try {
                // Fetch all documents from source
                const data = await sourceDb.collection(collectionName).find({}).toArray();
                
                if (data.length > 0) {
                    const tempCollectionName = `${collectionName}_temp`;
                    
                    // Clean up any leftover temp collection
                    await targetDb.collection(tempCollectionName).drop().catch(() => {});
                    
                    // Sync target with source data using temp collection
                    await targetDb.collection(tempCollectionName).insertMany(data);
                    
                    // Atomically rename temp collection to live collection (overwriting it)
                    await targetDb.collection(tempCollectionName).rename(collectionName, { dropTarget: true });
                } else {
                    // If source is empty, empty the target collection
                    await targetDb.collection(collectionName).deleteMany({});
                }
                results[collectionName] = data.length;
            } catch (err) {
                console.error(`[Clone Sync] Failed to sync collection ${collectionName}:`, err);
                results[collectionName] = { error: String(err) };
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const totalDocs = Object.values(results).reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0);

        remoteLog(`Database clone sync to ${targetLabel} completed`, { durationSeconds: duration, totalDocuments: totalDocs });

        return NextResponse.json({
            success: true,
            data: {
                target: targetLabel,
                results,
                durationSeconds: duration,
                totalDocuments: totalDocs
            }
        });

    } catch (error) {
        console.error('[Clone Sync] Critical Error:', error);
        remoteLog('Database clone sync failed', { error: String(error) }, 'ERROR');
        return NextResponse.json({ success: false, error: 'Clone sync failed' }, { status: 500 });
    }
}
