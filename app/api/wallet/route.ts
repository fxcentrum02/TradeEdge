// ===========================================
// WALLET API
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { getWalletSummary } from '@/lib/wallet';
import { getSettings } from '@/lib/repositories/settings.repository';
import { findUserById } from '@/lib/repositories/user.repository';
import type { ApiResponse, WalletSummary } from '@/types';

/**
 * GET /api/wallet - Get wallet summary
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<WalletSummary>>> {
    try {
        const session = await getTelegramUserFromRequest(request);

        if (!session) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const summary = await getWalletSummary(session.userId);
        const settings = await getSettings();
        const user = await findUserById(session.userId);

        return NextResponse.json({
            success: true,
            data: {
                ...summary,
                withdrawalSettings: {
                    minWithdrawalAmount: settings.minWithdrawalAmount,
                    withdrawalFeeType: settings.withdrawalFeeType,
                    withdrawalFeeValue: settings.withdrawalFeeValue,
                    lastWithdrawalAddress: user?.lastWithdrawalAddress || '',
                    lastWithdrawalAt: user?.lastWithdrawalAt || null,
                }
            }
        } as any);

    } catch (error) {
        console.error('Wallet error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get wallet' }, { status: 500 });
    }
}
