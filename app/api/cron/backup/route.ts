// ===========================================
// DATABASE BACKUP CRON JOB
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth, executeDatabaseBackupTask, type DatabaseBackupTaskResult } from '@/lib/services/cron.service';
import type { ApiResponse } from '@/types';

/**
 * GET /api/cron/backup
 * - Performs a full data copy from primary DB to backup DB via service.
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<DatabaseBackupTaskResult>>> {
    try {
        // Skip execution on Vercel Preview environment
        if (process.env.VERCEL_ENV === 'preview') {
            console.log('[Backup] Skipping execution on Vercel Preview environment.');
            return NextResponse.json({ success: true, message: 'Skipped on preview environment' } as any);
        }

        // Verify authorization
        if (!verifyCronAuth(request)) {
            console.error('[Backup] Unauthorized cron attempt');
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Backup] Starting DB backup via service...');
        const result = await executeDatabaseBackupTask();

        return NextResponse.json({
            success: true,
            data: result,
            message: `Backup Completed: ${result.totalDocuments} documents synced in ${result.durationSeconds}s`
        });

    } catch (error) {
        console.error('[Backup Cron] Error:', error);
        return NextResponse.json({ success: false, error: 'Backup failed: ' + String(error) }, { status: 500 });
    }
}
