// ===========================================
// USER TRANSACTIONS API
// GET /api/transactions
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import { ObjectId } from 'mongodb';
import type { ApiResponse, PaginatedResponse, Transaction } from '@/types';

/**
 * GET /api/transactions - Get user transaction history with pagination
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<PaginatedResponse<Transaction>>>> {
    try {
        const user = await getTelegramUserFromRequest(request);

        if (!user) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
        const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '20')));
        const type = searchParams.get('type');
        const search = searchParams.get('search');

        const skip = (page - 1) * limit;

        const db = await getDB();
        const userId = user._id;

        const query: any = { userId };
        if (type && type !== 'ALL') query.type = type;
        if (search) query.description = { $regex: search, $options: 'i' };

        const [transactions, total] = await Promise.all([
            db.collection(Collections.TRANSACTIONS)
                .find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection(Collections.TRANSACTIONS).countDocuments(query),
        ]);

        const formattedTransactions: Transaction[] = (transactions || []).map(t => ({
            id: t._id.toString(),
            userId: t.userId.toString(),
            type: t.type,
            amount: t.amount,
            balanceAfter: t.balanceAfter,
            description: t.description || null,
            reference: t.reference?.toString() || null,
            createdAt: t.createdAt,
        }));

        return NextResponse.json({
            success: true,
            data: {
                items: formattedTransactions,
                total: total || 0,
                page,
                limit,
                totalPages: Math.ceil((total || 0) / limit),
                hasMore: skip + limit < (total || 0),
            },
        });

    } catch (error) {
        console.error('[user transactions] error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch transactions' }, { status: 500 });
    }
}
