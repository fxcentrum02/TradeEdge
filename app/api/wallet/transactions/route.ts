// ===========================================
// TRANSACTIONS API
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { getTransactionHistory } from '@/lib/repositories/wallet.repository';
import type { ApiResponse, PaginatedResponse, Transaction } from '@/types';

/**
 * GET /api/wallet/transactions - Get transaction history
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<PaginatedResponse<Transaction>>>> {
    try {
        const user = await getTelegramUserFromRequest(request);

        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        const data = await getTransactionHistory(user._id.toString(), page, limit);

        return NextResponse.json({ success: true, data: data as any });

    } catch (error) {
        console.error('Transactions error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get transactions' }, { status: 500 });
    }
}
