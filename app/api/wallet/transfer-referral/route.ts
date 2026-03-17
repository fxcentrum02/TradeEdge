// ===========================================
// TRANSFER REFERRAL WALLET → MAIN WALLET
// POST /api/wallet/transfer-referral
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { transferToMainWallet } from '@/lib/repositories/referral-wallet.repository';
import type { ApiResponse } from '@/types';

/**
 * POST /api/wallet/transfer-referral
 * Transfers the full referral wallet balance to the main wallet.
 * Minimum balance required: 10 USDT.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const session = await getTelegramUserFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        let amount: number | undefined;
        try {
            const body = await request.json();
            amount = body.amount ? parseFloat(body.amount) : undefined;
        } catch (e) {
            // No body or invalid JSON is fine, just use undefined for full claim
        }

        const result = await transferToMainWallet(session.userId, amount);

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            data: { transferred: result.transferred },
            message: `Successfully transferred ${result.transferred.toFixed(2)} USDT to main wallet.`,
        });

    } catch (error) {
        console.error('[transfer-referral] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to transfer' }, { status: 500 });
    }
}
