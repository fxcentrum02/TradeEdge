// ===========================================
// WITHDRAWALS API (MongoDB Native)
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { WithdrawalService } from '@/lib/services/withdrawal.service';
import type { ApiResponse, PaginatedResponse, Withdrawal } from '@/types';

/**
 * GET /api/withdrawals - Get user's withdrawal history
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<PaginatedResponse<Withdrawal>>>> {
    try {
        const user = await getTelegramUserFromRequest(request);

        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        const result = await WithdrawalService.getUserWithdrawals(user._id.toString(), page, limit);

        return NextResponse.json({
            success: true,
            data: result,
        } as any);

    } catch (error) {
        console.error('Withdrawals error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get withdrawals' }, { status: 500 });
    }
}

/**
 * POST /api/withdrawals - Create withdrawal request
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Withdrawal>>> {
    try {
        const user = await getTelegramUserFromRequest(request);

        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { amount, walletAddress, network = 'BEP20' } = body;

        const serviceResult = await WithdrawalService.requestWithdrawal(user, amount, walletAddress, network);

        if (!serviceResult.success) {
            return NextResponse.json(
                { success: false, error: serviceResult.error },
                { status: serviceResult.status || 400 }
            );
        }

        return NextResponse.json({
            success: true,
            data: serviceResult.data,
            message: 'Withdrawal request submitted',
        }, { status: 201 });

    } catch (error) {
        console.error('Create withdrawal error:', error);
        return NextResponse.json({ success: false, error: 'Failed to create withdrawal' }, { status: 500 });
    }
}
