// ===========================================
// CONSOLIDATED DAILY MASTER CRON JOB
// Runs daily at 04:30 UTC = 10:00 AM IST
// Configured in vercel.json for Vercel Hobby Compliance
// ===========================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
    verifyCronAuth,
    executeRoiSettlementTask,
    executeMilestoneBonusTask,
    executeDatabaseBackupTask,
    type DailyCronSummary
} from '@/lib/services/cron.service';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<DailyCronSummary>>> {
    try {
        // Skip execution on Vercel Preview environment
        if (process.env.VERCEL_ENV === 'preview') {
            console.log('[cron-daily] Skipping daily execution on Vercel Preview environment.');
            return NextResponse.json({ success: true, message: 'Skipped on preview environment' } as any);
        }

        // Verify authorization
        if (!verifyCronAuth(request)) {
            console.error('[cron-daily] Unauthorized cron attempt');
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const now = new Date();
        console.log('[cron-daily] Starting consolidated daily execution at', now.toISOString());

        const summaryResults: DailyCronSummary = {
            executionTime: now.toISOString(),
            roiSettlement: { success: false },
            milestoneBonus: { success: false },
            databaseBackup: { success: false }
        };

        // STEP 1: ROI Settlement (Primary Task)
        try {
            console.log('[cron-daily] Step 1: Starting ROI settlement...');
            const roiData = await executeRoiSettlementTask();
            summaryResults.roiSettlement = {
                success: true,
                data: roiData,
                message: `Settled ${roiData.processed} plans | +$${roiData.totalAmount.toFixed(2)} USDT | ${roiData.expiredPlans} expired`
            };
            console.log('[cron-daily] Step 1 ROI Settlement succeeded:', summaryResults.roiSettlement);
        } catch (error) {
            console.error('[cron-daily] Step 1 ROI Settlement error:', error);
            summaryResults.roiSettlement = {
                success: false,
                error: String(error)
            };
        }

        // STEP 2: Milestone Bonus Check (Isolated Task)
        try {
            console.log('[cron-daily] Step 2: Starting Milestone Bonus check...');
            const milestoneData = await executeMilestoneBonusTask();
            summaryResults.milestoneBonus = {
                success: true,
                data: milestoneData,
                message: `Checked ${milestoneData.totalUsers} users | ${milestoneData.totalNewAwards} awards | +$${milestoneData.totalUSDT.toLocaleString()} USDT`
            };
            console.log('[cron-daily] Step 2 Milestone Bonus complete:', summaryResults.milestoneBonus);
        } catch (error) {
            console.error('[cron-daily] Step 2 Milestone Bonus error:', error);
            summaryResults.milestoneBonus = {
                success: false,
                error: String(error)
            };
        }

        // STEP 3: Database Backup (Isolated Task)
        try {
            console.log('[cron-daily] Step 3: Starting Database Backup...');
            const backupData = await executeDatabaseBackupTask();
            summaryResults.databaseBackup = {
                success: true,
                data: backupData,
                message: `Backup Completed: ${backupData.totalDocuments} docs in ${backupData.durationSeconds}s`
            };
            console.log('[cron-daily] Step 3 Database Backup complete:', summaryResults.databaseBackup);
        } catch (error) {
            console.error('[cron-daily] Step 3 Database Backup error:', error);
            summaryResults.databaseBackup = {
                success: false,
                error: String(error)
            };
        }

        const overallSuccess = summaryResults.roiSettlement.success;

        return NextResponse.json({
            success: overallSuccess,
            data: summaryResults,
            message: overallSuccess ? 'Daily consolidated cron completed successfully' : 'Daily cron completed with ROI errors'
        });

    } catch (error) {
        console.error('[cron-daily] Fatal error during consolidated cron:', error);
        return NextResponse.json({ success: false, error: 'Daily cron failed: ' + String(error) }, { status: 500 });
    }
}
