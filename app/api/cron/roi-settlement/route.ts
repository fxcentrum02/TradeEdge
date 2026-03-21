// ===========================================
// ROI SETTLEMENT CRON JOB
// Runs daily at 04:30 UTC = 10:00 AM IST
// Configured in vercel.json
// ===========================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { processDailyRoiSettlement } from '@/lib/roi';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import { pusherServer } from '@/lib/pusher';
import type { ApiResponse } from '@/types';

interface CronSummary {
    processed: number;
    totalAmount: number;
    errors: { planId: string; error: string }[];
    expiredPlans: number;
    settlementTime: string;
}

/**
 * GET /api/cron/roi-settlement
 * - Called by Vercel Cron daily at 04:30 UTC (10:00 AM IST)
 * - Also callable manually with Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<CronSummary>>> {
    try {
        // Verify secret: support both Vercel cron header and manual Bearer token
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        const isVercelCron = request.headers.get('x-vercel-cron') === '1';
        const isManualWithSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

        if (!isVercelCron && !isManualWithSecret) {
            console.error('[cron] Unauthorized cron attempt');
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[cron] Starting daily ROI settlement at', new Date().toISOString());

        // Step 1: Expire completed plans (endDate < now)
        const db = await getDB();
        const now = new Date();

        // 1a. Find plans about to expire to identify affected users
        const expiringPlans = await db.collection(Collections.USER_PLANS)
            .find({ isActive: true, endDate: { $lte: now } })
            .project({ userId: 1 })
            .toArray();

        const userIdsToUpdate = Array.from(new Set(expiringPlans.map(p => p.userId.toString())));

        // 1b. Mark plans as inactive
        const expireResult = await db.collection(Collections.USER_PLANS).updateMany(
            { isActive: true, endDate: { $lte: now } },
            { $set: { isActive: false, updatedAt: now } }
        );
        console.log(`[cron] Expired ${expireResult.modifiedCount} completed plans across ${userIdsToUpdate.length} users`);

        // 1c. Update stats for all users who had plans expire (re-calculates tradePower and updates uplines)
        const usersToRefresh = new Set<string>(userIdsToUpdate);

        // Step 2: Process daily ROI for all remaining active plans
        const result = await processDailyRoiSettlement();

        // Accumulate affected users for batch stats update
        result.affectedUserIds.forEach(id => usersToRefresh.add(id));

        console.log(`[cron] ROI settlement logic complete. Refreshing stats for ${usersToRefresh.size} users.`);

        // Step 3: Refresh all affected user stats in one batch (Deduplicated)
        const { refreshUserStatsBatch } = await import('@/lib/referral');
        await refreshUserStatsBatch(usersToRefresh);

        console.log('[cron] ROI settlement and stats refresh completed:', {
            processed: result.processed,
            totalAmount: result.totalAmount,
            expiredPlans: expireResult.modifiedCount
        });

        // Notify admins and users of the settlement
        await pusherServer.trigger('admin-notifications', 'cron-event', {
            type: 'ROI_SETTLEMENT',
            message: `ROI Settled: ${result.processed} plans, +$${result.totalAmount.toFixed(2)} USDT`,
            timestamp: now.toISOString()
        });

        // Let all users know global cron finished (some frontend hooks can refetch data based on this)
        await pusherServer.trigger('global-events', 'roi-settled', { timestamp: now.toISOString() });

        return NextResponse.json({
            success: true,
            data: {
                ...result,
                expiredPlans: expireResult.modifiedCount,
                settlementTime: now.toISOString(),
            },
            message: `Settled ${result.processed} plans | +$${result.totalAmount.toFixed(2)} USDT | ${expireResult.modifiedCount} plans expired`,
        });

    } catch (error) {
        console.error('[cron] ROI settlement error:', error);
        return NextResponse.json({ success: false, error: 'Settlement failed: ' + String(error) }, { status: 500 });
    }
}
