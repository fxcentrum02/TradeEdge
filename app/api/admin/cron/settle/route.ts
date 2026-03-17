// ===========================================
// ADMIN CRON TRIGGER API
// POST /api/admin/cron/settle — manually trigger ROI settlement
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { processDailyRoiSettlement } from '@/lib/roi';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import type { ApiResponse } from '@/types';

/**
 * POST /api/admin/cron/settle — manually trigger the daily ROI settlement
 * This allows admins to trigger it from the admin panel without needing CRON_SECRET.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        console.log('[admin/cron] Manual ROI settlement triggered by admin:', session.adminId);

        // Step 1: Expire completed plans
        const db = await getDB();
        const now = new Date();
        const expireResult = await db.collection(Collections.USER_PLANS).updateMany(
            { isActive: true, endDate: { $lte: now } },
            { $set: { isActive: false, updatedAt: now } }
        );

        // Step 2: Process daily ROI
        const result = await processDailyRoiSettlement();

        return NextResponse.json({
            success: true,
            data: {
                ...result,
                expiredPlans: expireResult.modifiedCount,
                settlementTime: now.toISOString(),
                triggeredBy: session.adminId,
            },
            message: `Settled ${result.processed} plans | +$${result.totalAmount.toFixed(2)} USDT | ${expireResult.modifiedCount} plans expired`,
        });

    } catch (error) {
        console.error('[admin/cron] Error:', error);
        return NextResponse.json({ success: false, error: 'Settlement failed: ' + String(error) }, { status: 500 });
    }
}
