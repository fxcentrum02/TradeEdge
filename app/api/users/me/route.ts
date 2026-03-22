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
    try {
        const session = await getTelegramUserFromRequest(request);

        if (!session) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const db = await getDB();
        const user = await findUserById(session.userId);

        if (!user) {
            return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
        }

        const now = new Date();
        const { findActivePlans } = await import('@/lib/repositories/plan.repository');
        const [activeUserPlans, allPlans] = await Promise.all([
            db.collection(Collections.USER_PLANS)
                .find({ userId: user._id, isActive: true, endDate: { $gt: now } })
                .toArray(),
            findActivePlans()
        ]);

        // Get wallet summary
        const wallet = await getWalletSummary(user._id.toString());

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

        // Optimized: Instead of fetching all again, we can just use totalInvestment if it's already on the user object
        // or just fetch it once.
        const totalInvestment = (await db.collection(Collections.USER_PLANS)
            .aggregate([
                { $match: { userId: user._id } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]).toArray())[0]?.total || 0;

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

        return NextResponse.json({ success: true, data: dashboard as any });

    } catch (error) {
        console.error('[users/me] error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get profile' }, { status: 500 });
    }
}
