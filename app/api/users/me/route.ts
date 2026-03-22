// ===========================================
// USER PROFILE API - Returns dashboard data with per-plan ROI breakdown
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import { findUserById } from '@/lib/repositories/user.repository';
import { getWalletSummary } from '@/lib/wallet';
import type { ApiResponse, UserDashboard } from '@/types';
import { ObjectId } from 'mongodb';

/**
 * GET /api/users/me - Get current user profile with real dashboard data
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<UserDashboard & { activePlanDetails: any[] }>>> {
    const startTime = performance.now();
    try {
        const user = await getTelegramUserFromRequest(request);
        const userFetchTime = performance.now();

        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const db = await getDB();

        const now = new Date();
        const { findActivePlans } = await import('@/lib/repositories/plan.repository');
        const [activeUserPlans, allPlans] = await Promise.all([
            db.collection(Collections.USER_PLANS)
                .find({ userId: user._id, isActive: true, endDate: { $gt: now } })
                .toArray(),
            findActivePlans()
        ]);
        const plansFetchTime = performance.now();

        // Get wallet summary
        const wallet = await getWalletSummary(user._id.toString());
        const walletTime = performance.now();

        // Map plans for quick lookup to avoid N+1
        const plansMap = new Map(allPlans.map(p => [p._id.toString(), p]));

        // Build per-plan ROI breakdown using the map
        const activePlanDetails = activeUserPlans.map((up) => {
            const plan = plansMap.get(up.planId.toString());
            const dailyRoiAmount = plan ? (up.amount * plan.dailyRoi) / 100 : 0;

            const msLeft = up.endDate.getTime() - now.getTime();
            const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

            return {
                id: up._id.toString(),
                amount: up.amount,
                planName: plan?.name ?? 'Unknown Tier',
                dailyRoi: plan?.dailyRoi ?? 0,
                dailyRoiAmount,
                daysLeft,
                msLeft: Math.max(0, msLeft),
                endDate: up.endDate,
                startDate: up.startDate,
                totalRoiPaid: up.totalRoiPaid,
            };
        });

        // Calculate aggregated mining power
        const tradePower = activeUserPlans.reduce((sum, p) => sum + p.amount, 0);

        // Update user.tradePower if it changed
        if (tradePower !== user.tradePower) {
            await db.collection(Collections.USERS).updateOne(
                { _id: user._id },
                { $set: { tradePower, updatedAt: new Date() } }
            );
        }
        const tradePowerUpdateTime = performance.now();

        const totalDailyEarnings = activePlanDetails.reduce((sum, p) => sum + p.dailyRoiAmount, 0);

        // Get upline info
        let upline: { name: string; username: string | null } | null = null;
        if (user.referredById) {
            const referrer = await findUserById(user.referredById);
            if (referrer) {
                upline = {
                    name: referrer.firstName || referrer.telegramUsername || 'Unknown',
                    username: referrer.telegramUsername || null,
                };
            }
        }
        const uplineTime = performance.now();

        const totalInvestmentResult = await db.collection(Collections.USER_PLANS)
            .aggregate([
                { $match: { userId: user._id } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]).toArray();
        const totalInvestment = totalInvestmentResult[0]?.total || 0;
        const totalInvestmentTime = performance.now();

        // ROI Sparkline: last 7 days of ROI credits
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const recentRoi = await db.collection(Collections.TRANSACTIONS)
            .find({
                userId: user._id,
                type: 'ROI_EARNING',
                createdAt: { $gte: sevenDaysAgo }
            })
            .sort({ createdAt: 1 })
            .toArray();
        
        const sparklineFetchTime = performance.now();

        // Group by day
        const sparklineMap: Record<string, number> = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            sparklineMap[d.toISOString().split('T')[0]] = 0;
        }
        recentRoi.forEach(tx => {
            const day = tx.createdAt.toISOString().split('T')[0];
            if (sparklineMap[day] !== undefined) sparklineMap[day] += tx.amount;
        });
        const sparklineData = Object.entries(sparklineMap)
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Optional: include additional data for dashboard consolidation
        const includeExtra = request.nextUrl.searchParams.get('include') === 'dashboard';
        let additionalData: any = {};
        
        if (includeExtra) {
            const tickets = await db.collection(Collections.PAYMENT_TICKETS)
                .find({ userId: user._id, status: { $in: ['PENDING', 'PROCESSING'] } })
                .toArray();
            
            additionalData = {
                availablePlans: allPlans.map(p => ({
                    id: p._id.toString(),
                    name: p.name,
                    minAmount: p.minAmount,
                    maxAmount: p.maxAmount,
                    dailyRoi: p.dailyRoi,
                    duration: p.duration
                })),
                pendingTickets: tickets.map(t => ({
                    id: t._id.toString(),
                    amount: t.amount,
                    status: t.status,
                    planName: t.planName,
                    planDailyRoi: t.planDailyRoi,
                    createdAt: t.createdAt
                }))
            };
        }
        const extraDataTime = performance.now();

        const dashboard = {
            ...user,
            id: user._id.toString(),
            telegramUsername: user.telegramUsername ?? null,
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            photoUrl: user.photoUrl ?? null,
            referredById: user.referredById ? user.referredById.toString() : null,
            tradePower,
            walletBalance: wallet.balance,
            activePlans: activeUserPlans.length,
            pendingWithdrawals: wallet.pendingWithdrawals,
            activePlanDetails,
            totalDailyEarnings,
            upline,
            totalInvestment,
            netProfit: user.totalEarnings - totalInvestment,
            sparklineData,
            ...additionalData
        };

        const endTime = performance.now();
        console.log(`[PERF] /api/users/me total: ${(endTime - startTime).toFixed(2)}ms`);
        console.log(`[PERF] - userAuth+Fetch: ${(userFetchTime - startTime).toFixed(2)}ms`);
        console.log(`[PERF] - plansFetch: ${(plansFetchTime - userFetchTime).toFixed(2)}ms`);
        console.log(`[PERF] - walletCalc: ${(walletTime - plansFetchTime).toFixed(2)}ms`);
        console.log(`[PERF] - tradePowerUpdate: ${(tradePowerUpdateTime - walletTime).toFixed(2)}ms`);
        console.log(`[PERF] - uplineFetch: ${(uplineTime - tradePowerUpdateTime).toFixed(2)}ms`);
        console.log(`[PERF] - totalInvestmentCalc: ${(totalInvestmentTime - uplineTime).toFixed(2)}ms`);
        console.log(`[PERF] - sparklineFetch: ${(sparklineFetchTime - totalInvestmentTime).toFixed(2)}ms`);
        console.log(`[PERF] - extraDataFetch: ${(extraDataTime - sparklineFetchTime).toFixed(2)}ms`);
        console.log(`[PERF] - totalReturn: ${(endTime - extraDataTime).toFixed(2)}ms`);

        return NextResponse.json({ success: true, data: dashboard as any });

    } catch (error) {
        console.error('[users/me] error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get profile' }, { status: 500 });
    }
}
