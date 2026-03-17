// ===========================================
// DATABASE BACKUP CRON JOB
// POST /api/cron/backup
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getDB, getBackupDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import { pusherServer } from '@/lib/pusher';
import { remoteLog } from '@/lib/logger';
import type { ApiResponse } from '@/types';

/**
 * POST /api/cron/backup
 * Performs a full data copy from primary DB to backup DB.
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    try {
        // Auth check (same as ROI cron)
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        const isVercelCron = request.headers.get('x-vercel-cron') === '1';
        const isManualWithSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

        if (!isVercelCron && !isManualWithSecret) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const sourceDb = await getDB();
        const targetDb = await getBackupDB();

        if (!targetDb) {
            remoteLog('Backup failed: targetDb not configured or connection failed', {}, 'ERROR');
            return NextResponse.json({ success: false, error: 'Backup DB not configured' }, { status: 500 });
        }

        const collectionsToBackup = Object.values(Collections);
        const results: any = {};
        const startTime = Date.now();

        console.log(`[Backup] Starting backup of ${collectionsToBackup.length} collections...`);

        for (const collectionName of collectionsToBackup) {
            try {
                // Get data from source
                const data = await sourceDb.collection(collectionName).find({}).toArray();
                
                if (data.length > 0) {
                    // Clear existing data in target (Full sync)
                    await targetDb.collection(collectionName).deleteMany({});
                    // Insert new data
                    await targetDb.collection(collectionName).insertMany(data);
                }
                
                results[collectionName] = data.length;
            } catch (err) {
                console.error(`[Backup] Failed to backup collection ${collectionName}:`, err);
                results[collectionName] = { error: String(err) };
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const totalDocs = Object.values(results).reduce((sum: number, val: any) => sum + (typeof val === 'number' ? val : 0), 0);

        remoteLog('Database backup succeeded', { durationSeconds: duration, totalDocuments: totalDocs });

        // Notify admins
        await pusherServer.trigger('admin-notifications', 'cron-event', {
            type: 'BACKUP',
            message: `Backup Completed: ${totalDocs} documents synced in ${duration}s`,
            timestamp: new Date().toISOString()
        });

        return NextResponse.json({
            success: true,
            data: {
                results,
                durationSeconds: duration,
                totalDocuments: totalDocs
            }
        });

    } catch (error) {
        console.error('[Backup Cron] Error:', error);
        remoteLog('Database backup failed', { error: String(error) }, 'ERROR');
        return NextResponse.json({ success: false, error: 'Backup failed' }, { status: 500 });
    }
}
