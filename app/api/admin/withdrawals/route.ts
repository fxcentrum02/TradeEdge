// ===========================================
// ADMIN WITHDRAWALS API (MongoDB Native)
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { WithdrawalService } from '@/lib/services/withdrawal.service';
import type { ApiResponse, PaginatedResponse, Withdrawal } from '@/types';
import type { WithdrawalStatus } from '@/lib/db/types';

/**
 * GET /api/admin/withdrawals - Get all withdrawals with filters
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<PaginatedResponse<any>>>> {
    try {
        const session = await getAdminSessionFromRequest(request);

        if (!session) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const status = searchParams.get('status') as WithdrawalStatus | null;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const amountMin = searchParams.get('amountMin');
        const amountMax = searchParams.get('amountMax');
        const dateType = searchParams.get('dateType');

        const result = await WithdrawalService.adminGetWithdrawals({
            status,
            startDate,
            endDate,
            amountMin,
            amountMax,
            page,
            limit,
            dateType,
        });

        return NextResponse.json({
            success: true,
            data: result,
        });

    } catch (error) {
        console.error('Admin withdrawals error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get withdrawals' }, { status: 500 });
    }
}

/**
 * POST /api/admin/withdrawals - Approve or reject withdrawal
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Withdrawal>>> {
    try {
        const session = await getAdminSessionFromRequest(request);

        if (!session) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const body = await request.json();
        const { action, txHash, adminNote, withdrawalId } = body;

        const result = await WithdrawalService.adminProcessWithdrawal(
            withdrawalId,
            action,
            session.adminId,
            txHash,
            adminNote
        );

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: result.status || 400 }
            );
        }

        return NextResponse.json({
            success: true,
            data: result.data,
            message: `Withdrawal ${action}d`
        });

    } catch (error) {
        console.error('Admin withdrawal action error:', error);
        return NextResponse.json({ success: false, error: 'Failed to process withdrawal: ' + String(error) }, { status: 500 });
    }
}
