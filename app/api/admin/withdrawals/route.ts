// ===========================================
// ADMIN WITHDRAWALS API (MongoDB Native)
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { creditWallet } from '@/lib/repositories/wallet.repository';
import type { ApiResponse, PaginatedResponse, Withdrawal } from '@/types';
import { findWithdrawalById, approveWithdrawal, rejectWithdrawal } from '@/lib/repositories/withdrawal.repository';
import type { WithdrawalStatus } from '@/lib/db/types';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';

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
        const skip = (page - 1) * limit;
        const status = searchParams.get('status') as WithdrawalStatus | null;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const amountMin = searchParams.get('amountMin');
        const amountMax = searchParams.get('amountMax');

        const db = await getDB();
        const matchStage: any = {};
        if (status) matchStage.status = status;
        if (startDate || endDate) {
            matchStage.createdAt = {};
            if (startDate) { const s = new Date(startDate); s.setHours(0, 0, 0, 0); matchStage.createdAt.$gte = s; }
            if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); matchStage.createdAt.$lte = e; }
        }
        if (amountMin) matchStage.amount = { ...matchStage.amount, $gte: parseFloat(amountMin) };
        if (amountMax) matchStage.amount = { ...matchStage.amount, $lte: parseFloat(amountMax) };

        const [withdrawals, total] = await Promise.all([
            db.collection(Collections.WITHDRAWALS)
                .aggregate([
                    { $match: matchStage },
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: Collections.USERS,
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'userInfo',
                        }
                    },
                    { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
                ]).toArray(),
            db.collection(Collections.WITHDRAWALS).countDocuments(matchStage),
        ]);

        // Convert to API format
        const items: Withdrawal[] = withdrawals.map(w => ({
            ...w,
            id: w._id.toString(),
            _id: w._id.toString(),
            userId: w.userId.toString(),
            processedBy: w.processedBy?.toString() ?? null,
            adminNote: w.adminNote ?? null,
            txHash: w.txHash ?? null,
            processedAt: w.processedAt ?? null,
            userName: w.userInfo?.firstName || w.userInfo?.telegramUsername || 'Unknown',
            telegramUsername: w.userInfo?.telegramUsername || null,
        } as any)); // Withdrawal type has id as string, DB has _id as ObjectId, the cast is safe here for API response

        return NextResponse.json({
            success: true,
            data: {
                items,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasMore: skip + limit < total,
            },
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
        const { withdrawalId, action, txHash, adminNote } = body;

        if (!withdrawalId || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 });
        }

        // 1. Atomic Lock: Transition from PENDING to PROCESSING
        // This prevents two admins from processing the same withdrawal simultaneously.
        const db = await getDB();
        const withdrawal = await db.collection(Collections.WITHDRAWALS).findOneAndUpdate(
            { _id: new ObjectId(withdrawalId), status: 'PENDING' },
            { $set: { status: 'PROCESSING', updatedAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!withdrawal) {
            // Check if it exists or was already processed
            const checkWithdrawal = await findWithdrawalById(withdrawalId);
            if (!checkWithdrawal) {
                return NextResponse.json({ success: false, error: 'Withdrawal not found' }, { status: 404 });
            }
            return NextResponse.json({
                success: false,
                error: `Withdrawal is already ${checkWithdrawal.status.toLowerCase()}`
            }, { status: 400 });
        }

        if (action === 'reject') {
            // Refund user
            await creditWallet(
                withdrawal.userId,
                withdrawal.amount,
                'ADMIN_CREDIT',
                'Withdrawal rejected - refund',
                withdrawalId
            );

            const updated = await rejectWithdrawal(
                withdrawalId,
                new ObjectId(session.adminId),
                adminNote || 'Rejected by admin'
            );

            return NextResponse.json({ success: true, data: updated as any, message: 'Withdrawal rejected' });
        }

        // Approve
        if (!txHash) {
            return NextResponse.json({ success: false, error: 'Transaction hash required for approval' }, { status: 400 });
        }

        const updated = await approveWithdrawal(
            withdrawalId,
            new ObjectId(session.adminId),
            txHash,
            adminNote
        );

        return NextResponse.json({ success: true, data: updated as any, message: 'Withdrawal approved' });

    } catch (error) {
        console.error('Admin withdrawal action error:', error);
        return NextResponse.json({ success: false, error: 'Failed to process withdrawal' }, { status: 500 });
    }
}
