// ===========================================
// ADMIN DASHBOARD API - Returns full stats
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import type { ApiResponse } from '@/types';

/**
 * GET /api/admin/dashboard - Get admin dashboard stats (comprehensive)
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const session = await getAdminSessionFromRequest(request);

        if (!session) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const db = await getDB();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Run all counts in parallel
        const [
            totalUsers,
            activeUsers,
            todayNewUsers,
            todaySubscriptions,
            pendingTickets,
        ] = await Promise.all([
            db.collection(Collections.USERS).countDocuments({}),
            db.collection(Collections.USER_PLANS).distinct('userId', { isActive: true }).then(ids => ids.length),
            db.collection(Collections.USERS).countDocuments({ createdAt: { $gte: today } }),
            db.collection(Collections.USER_PLANS).countDocuments({ createdAt: { $gte: today } }),
            db.collection(Collections.PAYMENT_TICKETS).countDocuments({ status: 'PENDING' }),
        ]);

        // Aggregate monetary values in parallel
        const [
            subscriptionsAgg,
            withdrawalsAgg,
            pendingWithdrawalsAgg,
            earningsAgg,
            roiAgg,
            ticketAmountAgg,
        ] = await Promise.all([
            db.collection(Collections.USER_PLANS)
                .aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
            db.collection(Collections.WITHDRAWALS)
                .aggregate([{ $match: { status: 'COMPLETED' } }, { $group: { _id: null, total: { $sum: '$netAmount' } } }]).toArray(),
            db.collection(Collections.WITHDRAWALS)
                .aggregate([{ $match: { status: 'PENDING' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
            db.collection(Collections.TRANSACTIONS)
                .aggregate([{ $match: { type: 'REFERRAL_EARNING' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
            db.collection(Collections.TRANSACTIONS)
                .aggregate([{ $match: { type: 'ROI_EARNING' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
            db.collection(Collections.PAYMENT_TICKETS)
                .aggregate([{ $match: { status: 'PENDING' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
        ]);

        // Recent 6 deposit tickets (with user info)
        const recentTickets = await db.collection(Collections.PAYMENT_TICKETS)
            .aggregate([
                { $sort: { createdAt: -1 } },
                { $limit: 6 },
                {
                    $lookup: {
                        from: Collections.USERS,
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'userInfo',
                    }
                },
                { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
            ]).toArray();

        // Recent 6 signups
        const recentUsers = await db.collection(Collections.USERS)
            .find({})
            .sort({ createdAt: -1 })
            .limit(6)
            .toArray();

        return NextResponse.json({
            success: true,
            data: {
                totalUsers,
                activeUsers,
                todayNewUsers,
                todaySubscriptions,
                pendingTickets,
                totalInvested: subscriptionsAgg[0]?.total || 0,
                totalEarnings: earningsAgg[0]?.total || 0,
                roiPaidTotal: roiAgg[0]?.total || 0,
                totalWithdrawals: withdrawalsAgg[0]?.total || 0,
                pendingWithdrawals: pendingWithdrawalsAgg[0]?.total || 0,
                totalTicketAmount: ticketAmountAgg[0]?.total || 0,
                recentTickets: recentTickets.map(t => ({
                    _id: t._id.toString(),
                    amount: t.amount,
                    status: t.status,
                    createdAt: t.createdAt,
                    userName: t.userInfo?.firstName || t.userInfo?.telegramUsername || 'Unknown',
                })),
                recentUsers: recentUsers.map(u => ({
                    _id: u._id.toString(),
                    firstName: u.firstName,
                    telegramUsername: u.telegramUsername,
                    telegramId: u.telegramId,
                    createdAt: u.createdAt,
                })),
            },
        });

    } catch (error) {
        console.error('[admin/dashboard] error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get dashboard' }, { status: 500 });
    }
}
