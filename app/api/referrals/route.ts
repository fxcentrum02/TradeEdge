// ===========================================
// REFERRALS API
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { getReferralStats } from '@/lib/referral';
import type { ApiResponse, ReferralStats } from '@/types';

/**
 * GET /api/referrals - Get user's referral stats with 20-tier breakdown
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<ReferralStats>>> {
    try {
        const user = await getTelegramUserFromRequest(request);

        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const stats = await getReferralStats(user._id);

        return NextResponse.json({ success: true, data: stats });

    } catch (error) {
        console.error('Referrals error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get referrals' }, { status: 500 });
    }
}
