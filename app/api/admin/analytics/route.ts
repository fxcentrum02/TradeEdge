// ===========================================
// ADMIN ANALYTICS API — Full financial insights
// GET /api/admin/analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const db = await getDB();
        const url = new URL(request.url);
        const startDateStr = url.searchParams.get('startDate');
        const endDateStr = url.searchParams.get('endDate');

        // Build date filter
        const dateFilter: any = {};
        if (startDateStr) {
            const start = new Date(startDateStr);
            start.setHours(0, 0, 0, 0);
            dateFilter.$gte = start;
        }
        if (endDateStr) {
            const end = new Date(endDateStr);
            end.setHours(23, 59, 59, 999);
            dateFilter.$lte = end;
        }
        const hasDateFilter = Object.keys(dateFilter).length > 0;
        const createdAtMatch = hasDateFilter ? { createdAt: dateFilter } : {};

        const minAmountStr = url.searchParams.get('minAmount');
        const minAmount = minAmountStr ? parseFloat(minAmountStr) : null;
        const amountMatch = minAmount !== null ? { amount: { $gte: minAmount } } : {};
        const netAmountMatch = minAmount !== null ? { netAmount: { $gte: minAmount } } : {};
        const transactionAmountMatch = minAmount !== null ? { amount: { $gte: minAmount } } : {};

        // === TODAY / TOMORROW boundaries ===
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setHours(23, 59, 59, 999);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        const tomorrowEnd = new Date(tomorrowStart);
        tomorrowEnd.setHours(23, 59, 59, 999);

        // Run all aggregations in parallel
        const [
            // Card data
            roiPaidAgg,
            referralEarningsAgg,
            withdrawalsPaidAgg,
            pendingWithdrawalsAgg,
            reinvestedAgg,
            totalActivePlans,
            plansEndingToday,
            // Tomorrow settlement: aggregate active plans joined with plans
            tomorrowSettlementAgg,
            // Chart data: daily breakdown of ROI, referral earnings, withdrawals, deposits
            dailyRoiChart,
            dailyWithdrawalsChart,
            dailyDepositsChart,
            // Recent settlements table
            recentRoiTransactions,
            // Tomorrow's settlements table
            tomorrowPlans,
            // Total Withdrawal Fees (Completed)
            withdrawalFeesAgg,
        ] = await Promise.all([
            // ROI Paid in date range
            db.collection(Collections.TRANSACTIONS).aggregate([
                { $match: { type: 'ROI_EARNING', ...createdAtMatch, ...transactionAmountMatch } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]).toArray(),

            // Referral Earnings Paid in date range
            db.collection(Collections.TRANSACTIONS).aggregate([
                { $match: { type: { $in: ['REFERRAL_EARNING', 'REFERRAL_TRANSFER'] }, ...createdAtMatch, ...transactionAmountMatch } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]).toArray(),

            // Withdrawals Paid in date range
            db.collection(Collections.WITHDRAWALS).aggregate([
                { $match: { status: 'COMPLETED', ...createdAtMatch, ...netAmountMatch } },
                { $group: { _id: null, total: { $sum: '$netAmount' }, count: { $sum: 1 } } },
            ]).toArray(),

            // Pending Withdrawals (current, not date-filtered)
            db.collection(Collections.WITHDRAWALS).aggregate([
                { $match: { status: 'PENDING' } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]).toArray(),

            // Reinvested Amount in date range
            db.collection(Collections.TRANSACTIONS).aggregate([
                { $match: { type: 'REINVEST', ...createdAtMatch, ...transactionAmountMatch } },
                { $group: { _id: null, total: { $sum: { $abs: '$amount' } }, count: { $sum: 1 } } },
            ]).toArray(),

            // Total Active Plans
            db.collection(Collections.USER_PLANS).countDocuments({ isActive: true }),

            // Plans Ending Today
            db.collection(Collections.USER_PLANS).countDocuments({
                isActive: true,
                endDate: { $gte: todayStart, $lte: todayEnd },
            }),

            // Tomorrow's Settlement Amount
            db.collection(Collections.USER_PLANS).aggregate([
                {
                    $match: {
                        isActive: true,
                        endDate: { $gt: tomorrowStart },
                    },
                },
                {
                    $lookup: {
                        from: Collections.PLANS,
                        localField: 'planId',
                        foreignField: '_id',
                        as: 'planInfo',
                    },
                },
                { $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: {
                                $multiply: ['$amount', { $divide: [{ $ifNull: ['$planInfo.dailyRoi', 0] }, 100] }],
                            },
                        },
                        count: { $sum: 1 },
                    },
                },
            ]).toArray(),

            // Daily ROI Chart (last 30 days or date range)
            db.collection(Collections.TRANSACTIONS).aggregate([
                {
                    $match: {
                        type: 'ROI_EARNING',
                        ...(hasDateFilter ? createdAtMatch : { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } }),
                    },
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        total: { $sum: '$amount' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]).toArray(),

            // Daily Withdrawals Chart
            db.collection(Collections.WITHDRAWALS).aggregate([
                {
                    $match: {
                        status: 'COMPLETED',
                        ...(hasDateFilter ? createdAtMatch : { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } }),
                    },
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        total: { $sum: '$netAmount' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]).toArray(),

            // Daily Deposits Chart
            db.collection(Collections.PAYMENT_TICKETS).aggregate([
                {
                    $match: {
                        status: 'APPROVED',
                        ...(hasDateFilter ? createdAtMatch : { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } }),
                    },
                },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                        total: { $sum: '$amount' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { _id: 1 } },
            ]).toArray(),

            // Recent ROI Transactions (last 20)
            db.collection(Collections.TRANSACTIONS).aggregate([
                { $match: { type: 'ROI_EARNING' } },
                { $sort: { createdAt: -1 } },
                { $limit: 20 },
                {
                    $lookup: {
                        from: Collections.USERS,
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'userInfo',
                    },
                },
                { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
            ]).toArray(),

            // Tomorrow's Settlements (active plans that will get ROI tomorrow)
            db.collection(Collections.USER_PLANS).aggregate([
                {
                    $match: {
                        isActive: true,
                        endDate: { $gt: tomorrowStart },
                    },
                },
                { $sort: { amount: -1 } },
                { $limit: 50 },
                {
                    $lookup: {
                        from: Collections.USERS,
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'userInfo',
                    },
                },
                { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: Collections.PLANS,
                        localField: 'planId',
                        foreignField: '_id',
                        as: 'planInfo',
                    },
                },
                { $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true } },
            ]).toArray(),

            // Withdrawal Fees Paid in date range
            db.collection(Collections.WITHDRAWALS).aggregate([
                { $match: { status: 'COMPLETED', ...createdAtMatch } },
                { $group: { _id: null, total: { $sum: '$fee' }, count: { $sum: 1 } } },
            ]).toArray(),
        ]);

        // Settlement Monitor: Check if latest 04:30 UTC settlement ran
        const settlementTarget = new Date();
        settlementTarget.setUTCHours(4, 30, 0, 0);
        if (now < settlementTarget) {
            settlementTarget.setUTCDate(settlementTarget.getUTCDate() - 1);
        }

        const latestSettlementTx = await db.collection(Collections.TRANSACTIONS).findOne(
            { type: 'ROI_EARNING', createdAt: { $gte: settlementTarget } },
            { sort: { createdAt: -1 } }
        );

        const settlementStatus = {
            isSuccess: !!latestSettlementTx,
            lastRun: latestSettlementTx?.createdAt || null,
            targetTime: settlementTarget,
        };

        // Merge chart data into unified daily series
        const allDates = new Set<string>();
        dailyRoiChart.forEach((d: any) => allDates.add(d._id));
        dailyWithdrawalsChart.forEach((d: any) => allDates.add(d._id));
        dailyDepositsChart.forEach((d: any) => allDates.add(d._id));

        const roiMap = new Map(dailyRoiChart.map((d: any) => [d._id, d.total]));
        const wdMap = new Map(dailyWithdrawalsChart.map((d: any) => [d._id, d.total]));
        const dpMap = new Map(dailyDepositsChart.map((d: any) => [d._id, d.total]));

        const chartData = Array.from(allDates).sort().map(date => ({
            date,
            roi: roiMap.get(date) || 0,
            withdrawals: wdMap.get(date) || 0,
            deposits: dpMap.get(date) || 0,
        }));

        return NextResponse.json({
            success: true,
            data: {
                settlementStatus,
                cards: {
                    tomorrowSettlement: tomorrowSettlementAgg[0]?.total || 0,
                    tomorrowSettlementCount: tomorrowSettlementAgg[0]?.count || 0,
                    plansEndingToday,
                    totalActivePlans,
                    roiPaid: roiPaidAgg[0]?.total || 0,
                    roiPaidCount: roiPaidAgg[0]?.count || 0,
                    referralEarnings: referralEarningsAgg[0]?.total || 0,
                    referralEarningsCount: referralEarningsAgg[0]?.count || 0,
                    withdrawalsPaid: withdrawalsPaidAgg[0]?.total || 0,
                    withdrawalsPaidCount: withdrawalsPaidAgg[0]?.count || 0,
                    totalWithdrawalFees: withdrawalFeesAgg[0]?.total || 0,
                    totalWithdrawalFeesCount: withdrawalFeesAgg[0]?.count || 0,
                    pendingWithdrawals: pendingWithdrawalsAgg[0]?.total || 0,
                    pendingWithdrawalsCount: pendingWithdrawalsAgg[0]?.count || 0,
                    reinvested: reinvestedAgg[0]?.total || 0,
                    reinvestedCount: reinvestedAgg[0]?.count || 0,
                },
                chartData,
                recentSettlements: recentRoiTransactions.map((t: any) => ({
                    _id: t._id.toString(),
                    amount: t.amount,
                    description: t.description,
                    createdAt: t.createdAt,
                    userName: t.userInfo?.firstName || t.userInfo?.telegramUsername || 'Unknown',
                    telegramUsername: t.userInfo?.telegramUsername || null,
                })),
                tomorrowSettlements: tomorrowPlans.map((p: any) => ({
                    _id: p._id.toString(),
                    amount: p.amount,
                    dailyRoi: p.planInfo?.dailyRoi || 0,
                    roiAmount: (p.amount * (p.planInfo?.dailyRoi || 0)) / 100,
                    planName: p.planInfo?.name || 'Unknown',
                    endDate: p.endDate,
                    userName: p.userInfo?.firstName || p.userInfo?.telegramUsername || 'Unknown',
                    telegramUsername: p.userInfo?.telegramUsername || null,
                })),
            },
        });

    } catch (error) {
        console.error('[admin/analytics] error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get analytics' }, { status: 500 });
    }
}
