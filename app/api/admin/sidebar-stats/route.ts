import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/session';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{ pendingTickets: number; pendingWithdrawals: number }>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const db = await getDB();

        const [pendingTickets, pendingWithdrawals] = await Promise.all([
            db.collection(Collections.PAYMENT_TICKETS).countDocuments({ status: 'PENDING' }),
            db.collection(Collections.WITHDRAWALS).countDocuments({ status: 'PENDING' })
        ]);

        return NextResponse.json({
            success: true,
            data: { pendingTickets, pendingWithdrawals }
        });
    } catch (error) {
        console.error('Failed to fetch sidebar stats:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch sidebar stats' },
            { status: 500 }
        );
    }
}
