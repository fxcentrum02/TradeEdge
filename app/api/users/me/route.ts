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

        // Fetch all active user plans
        const now = new Date();
        const activeUserPlans = await db.collection(Collections.USER_PLANS)
            .find({ userId: user._id, isActive: true, endDate: { $gt: now } })
            .toArray();

        // Get wallet summary
        const wallet = await getWalletSummary(user._id.toString());

        // Build per-plan ROI breakdown by joining with plan tier
        const activePlanDetails = await Promise.all(
            activeUserPlans.map(async (up) => {
                const plan = await db.collection(Collections.PLANS).findOne({ _id: new ObjectId(up.planId) });
                const dailyRoiAmount = plan ? (up.amount * plan.dailyRoi) / 100 : 0;

                // Calculate precise days left (fractional)
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
            })
        );

        // Calculate aggregated mining power (sum of active plan amounts)
        const tradePower = activeUserPlans.reduce((sum, p) => sum + p.amount, 0);

        // Update user.tradePower if it changed
        if (tradePower !== user.tradePower) {
            await db.collection(Collections.USERS).updateOne(
                { _id: user._id },
                { $set: { tradePower, updatedAt: new Date() } }
            );
        }

        // Total daily earnings across all active plans
        const totalDailyEarnings = activePlanDetails.reduce((sum, p) => sum + p.dailyRoiAmount, 0);

        // Get upline (referrer) info
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

        // Calculate total investment (all plans ever purchased)
        const allUserPlans = await db.collection(Collections.USER_PLANS)
            .find({ userId: user._id })
            .toArray();
        const totalInvestment = allUserPlans.reduce((sum, p) => sum + p.amount, 0);

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
            // New stats
            totalInvestment,
            netProfit: user.totalEarnings - totalInvestment,
            sparklineData,
        };

        return NextResponse.json({ success: true, data: dashboard as any });

    } catch (error) {
        console.error('[users/me] error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get profile' }, { status: 500 });
    }
}
