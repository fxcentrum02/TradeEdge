// ===========================================
// ROI SETTLEMENT CRON JOB
// Runs daily at 04:30 UTC = 10:00 AM IST
// Configured in vercel.json
// ===========================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyCronAuth, executeRoiSettlementTask, type RoiSettlementTaskResult } from '@/lib/services/cron.service';
import type { ApiResponse } from '@/types';

/**
 * GET /api/cron/roi-settlement
 * - Callable manually or directly with Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<RoiSettlementTaskResult>>> {
    try {
        // Skip execution on Vercel Preview environment
        if (process.env.VERCEL_ENV === 'preview') {
            console.log('[cron] Skipping daily ROI settlement on Vercel Preview environment.');
            return NextResponse.json({ success: true, message: 'Skipped on preview environment' } as any);
        }

        // Verify authorization
        if (!verifyCronAuth(request)) {
            console.error('[cron] Unauthorized cron attempt');
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[cron] Starting daily ROI settlement via service...');
        const result = await executeRoiSettlementTask();

        return NextResponse.json({
            success: true,
            data: result,
            message: `Settled ${result.processed} plans | +$${result.totalAmount.toFixed(2)} USDT | ${result.expiredPlans} plans expired`,
        });

    } catch (error) {
        console.error('[cron] ROI settlement error:', error);
        return NextResponse.json({ success: false, error: 'Settlement failed: ' + String(error) }, { status: 500 });
    }
}
