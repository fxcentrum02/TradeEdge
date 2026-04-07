// ===========================================
// MILESTONE BONUS CRON JOB
// Runs daily at 18:30 UTC = 12:00 AM IST
// Configured in vercel.json
// ===========================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { processMilestoneBonusBatch } from '@/lib/milestone';
import { pusherServer } from '@/lib/pusher';
import type { ApiResponse } from '@/types';

interface MilestoneCronSummary {
    totalUsers: number;
    totalNewAwards: number;
    totalUSDT: number;
    errors: { userId: string; error: string }[];
    settlementTime: string;
}

/**
 * GET /api/cron/milestone-bonus
 * - Called by Vercel Cron daily at 18:30 UTC (12:00 AM IST)
 * - Also callable manually with Authorization: Bearer <CRON_SECRET>
 */
export async function GET(
    request: NextRequest
): Promise<NextResponse<ApiResponse<MilestoneCronSummary>>> {
    try {
        // Auth: accept Vercel Cron header OR manual Bearer token
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        const isVercelCron = request.headers.get('x-vercel-cron') === '1';
        const isManualWithSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

        if (!isVercelCron && !isManualWithSecret) {
            console.error('[milestone-cron] Unauthorized attempt');
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const now = new Date();
        console.log('[milestone-cron] Starting milestone bonus check at', now.toISOString());

        const result = await processMilestoneBonusBatch();

        console.log('[milestone-cron] Complete:', {
            totalUsers: result.totalUsers,
            newAwards: result.totalNewAwards,
            totalUSDT: result.totalUSDT,
            errors: result.errors.length,
        });

        // Notify admin channel
        if (result.totalNewAwards > 0) {
            await pusherServer.trigger('admin-notifications', 'cron-event', {
                type: 'MILESTONE_BONUS',
                message: `Milestone Bonuses: ${result.totalNewAwards} awarded | +$${result.totalUSDT.toLocaleString()} USDT`,
                timestamp: now.toISOString(),
            });
        }

        return NextResponse.json({
            success: true,
            data: {
                ...result,
                settlementTime: now.toISOString(),
            },
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
