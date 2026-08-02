// ===========================================
// MILESTONE BONUS CRON JOB
// ===========================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyCronAuth, executeMilestoneBonusTask, type MilestoneBonusTaskResult } from '@/lib/services/cron.service';
import type { ApiResponse } from '@/types';

/**
 * GET /api/cron/milestone-bonus
 * - Callable manually or directly with Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<MilestoneBonusTaskResult>>> {
    try {
        // Skip execution on Vercel Preview environment
        if (process.env.VERCEL_ENV === 'preview') {
            console.log('[milestone-cron] Skipping milestone bonus check on Vercel Preview environment.');
            return NextResponse.json({ success: true, message: 'Skipped on preview environment' } as any);
        }

        // Verify authorization
        if (!verifyCronAuth(request)) {
            console.error('[milestone-cron] Unauthorized attempt');
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[milestone-cron] Starting milestone bonus check via service...');
        const result = await executeMilestoneBonusTask();

        return NextResponse.json({
            success: true,
            data: result,
            message: `Checked ${result.totalUsers} users | ${result.totalNewAwards} new awards | +$${result.totalUSDT.toLocaleString()} USDT${result.errors.length > 0 ? ` | ${result.errors.length} errors` : ''}`,
        });
    } catch (error) {
        console.error('[milestone-cron] Fatal error:', error);
        return NextResponse.json(
            { success: false, error: 'Milestone bonus cron failed: ' + String(error) },
            { status: 500 }
        );
    }
}
