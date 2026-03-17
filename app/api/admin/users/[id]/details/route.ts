// ===========================================
// ADMIN USER DETAILS API
// GET /api/admin/users/[id]/details
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import { findUserPlansByUserId } from '@/lib/repositories/user-plan.repository';
import { findReferralEarningsByUserId } from '@/lib/repositories/referral-earning.repository';
import { getTransactionHistory, findWalletByUserId } from '@/lib/repositories/wallet.repository';
import { findReferralWalletByUserId } from '@/lib/repositories/referral-wallet.repository';
import { ObjectId } from 'mongodb';
import type { ApiResponse } from '@/types';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const { id: userId } = await params;
        if (!userId || !ObjectId.isValid(userId)) {
            return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
        }

        const db = await getDB();
        const _userId = new ObjectId(userId);

        // 1. Get User Profile
        const user = await db.collection(Collections.USERS).findOne({ _id: _userId });
        if (!user) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }

        // 2. Get Wallets
        const wallet = await findWalletByUserId(_userId);
        const referralWallet = await findReferralWalletByUserId(_userId);

        // 3. Get Purchased Plans
        const userPlans = await db.collection(Collections.USER_PLANS).aggregate([
            { $match: { userId: _userId } },
            {
                $lookup: {
                    from: Collections.PLANS,
                    localField: 'planId',
                    foreignField: '_id',
                    as: 'planInfo'
                }
            },
            { $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true } },
            { $sort: { createdAt: -1 } }
        ]).toArray();

        // 4. Get Referral Earnings
        const referralEarnings = await db.collection(Collections.REFERRAL_EARNINGS).aggregate([
            { $match: { userId: _userId } },
            {
                $lookup: {
                    from: Collections.USERS,
                    localField: 'fromUserId',
                    foreignField: '_id',
                    as: 'fromUser'
                }
            },
            { $unwind: { path: '$fromUser', preserveNullAndEmptyArrays: true } },
            { $sort: { createdAt: -1 } },
            { $limit: 50 } // Limit for details view
        ]).toArray();

        // 5. Get Transaction History
        const transactionsResponse = await getTransactionHistory(_userId, 1, 50);

        // 6. Get ROI Details (from transactions of type ROI_EARNING)
        const roiHistory = await db.collection(Collections.TRANSACTIONS)
            .find({ userId: _userId, type: 'ROI_EARNING' })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();

        // 7. Get Direct Referrals (for initial tree)
        const directReferrals = await db.collection(Collections.USERS)
            .find({ referredById: _userId })
            .sort({ createdAt: -1 })
            .toArray();

        // 8. Calculate Analytics
        const [userPlansSummary] = await db.collection(Collections.USER_PLANS).aggregate([
            { $match: { userId: _userId } },
            {
                $group: {
                    _id: null,
                    totalInvested: { $sum: '$amount' },
                    totalDeposit: {
                        $sum: {
                            $cond: [{ $eq: ['$isReinvest', false] }, '$amount', 0]
                        }
                    },
                    totalReinvest: {
                        $sum: {
                            $cond: [{ $eq: ['$isReinvest', true] }, '$amount', 0]
                        }
                    },
                    totalRoiPaid: { $sum: '$totalRoiPaid' }
                }
            }
        ]).toArray();

        const [referralSummary] = await db.collection(Collections.REFERRAL_EARNINGS).aggregate([
            { $match: { userId: _userId } },
            { $group: { _id: null, totalEarned: { $sum: '$amount' } } }
        ]).toArray();

        const withdrawalSummary = await db.collection(Collections.WITHDRAWALS).aggregate([
            { $match: { userId: _userId } },
            {
                $group: {
                    _id: '$status',
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]).toArray();

        const analytics = {
            totalInvested: userPlansSummary?.totalInvested || 0,
            totalDeposit: userPlansSummary?.totalDeposit || 0,
            totalReinvest: userPlansSummary?.totalReinvest || 0,
            totalRoiEarned: userPlansSummary?.totalRoiPaid || 0,
            totalReferralEarned: referralSummary?.totalEarned || 0,
            totalWithdrawn: withdrawalSummary.find(w => w._id === 'COMPLETED')?.totalAmount || 0,
            pendingWithdrawals: withdrawalSummary.find(w => w._id === 'PENDING')?.totalAmount || 0,
        };

        // Format labels/names for UI
        const formattedUserPlans = userPlans.map(p => ({
            ...p,
            id: p._id.toString(),
            planName: p.planInfo?.name || 'Unknown Plan',
            dailyRoi: p.planInfo?.dailyRoi || 0,
        }));

        const formattedReferralEarnings = referralEarnings.map(e => ({
            ...e,
            id: e._id.toString(),
            fromUserName: e.fromUser?.firstName || e.fromUser?.telegramUsername || 'Unknown User',
        }));

        const formattedDirectReferrals = directReferrals.map(u => ({
            id: u._id.toString(),
            firstName: u.firstName || null,
            lastName: u.lastName || null,
            photoUrl: u.photoUrl || null,
            telegramUsername: u.telegramUsername || null,
            telegramId: u.telegramId,
            tradePower: u.tradePower || 0,
            directReferralCount: u.directReferralCount || 0,
            totalReferralCount: u.totalReferralCount || 0,
            joinedAt: u.createdAt.toISOString(),
        }));

        return NextResponse.json({
            success: true,
            data: {
                profile: {
                    ...user,
                    id: user._id.toString(),
                    walletBalance: wallet?.balance || 0,
                    referralWalletBalance: referralWallet?.balance || 0,
                },
                plans: formattedUserPlans,
                referralEarnings: formattedReferralEarnings,
                transactions: transactionsResponse.items.map(t => ({ ...t, id: t._id.toString() })),
                roiHistory: roiHistory.map(t => ({ ...t, id: t._id.toString() })),
                directReferrals: formattedDirectReferrals,
                analytics,
            }
        });

    } catch (error) {
        console.error('[user details api] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
