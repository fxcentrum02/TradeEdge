// ===========================================
// REINVEST API — Exchange wallet balance to Compounding Power
// POST /api/wallet/reinvest
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import { debitWallet } from '@/lib/repositories/wallet.repository';
import { findPlanForAmount } from '@/lib/repositories/plan.repository';
import { createUserPlan } from '@/lib/repositories/user-plan.repository';
import { updateUserStatsRecursively } from '@/lib/referral';
import { PLAN_CONFIG } from '@/lib/constants';
import { remoteLog } from '@/lib/logger';
import type { ApiResponse } from '@/types';

/**
 * POST /api/wallet/reinvest
 * Body: { amount: number }
 *
 * - Debits main wallet
 * - Creates UserPlan with isReinvest: true
 * - Updates tradePower
 * - Does NOT distribute referral commissions
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const session = await getTelegramUserFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { amount } = body;

        // Validate amount
        if (!amount || typeof amount !== 'number' || isNaN(amount)) {
            return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
        }

        if (amount < PLAN_CONFIG.MIN_INVESTMENT) {
            return NextResponse.json(
                { success: false, error: `Minimum reinvestment is ${PLAN_CONFIG.MIN_INVESTMENT} USDT` },
                { status: 400 }
            );
        }

        // Find matching plan tier
        const plan = await findPlanForAmount(amount);
        if (!plan) {
            return NextResponse.json(
                { success: false, error: 'No investment tier found for this amount.' },
                { status: 400 }
            );
        }

        // Debit main wallet
        const debitResult = await debitWallet(
            session.userId,
            amount,
            'REINVEST',
            `Reinvest ${amount} USDT to Compounding Power`
        );

        if (!debitResult.success) {
            return NextResponse.json({ success: false, error: debitResult.error || 'Insufficient balance' }, { status: 400 });
        }

        // Calculate duration
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + plan.duration);

        // Create UserPlan with isReinvest: true
        const userPlan = await createUserPlan({
            userId: new ObjectId(session.userId),
            planId: plan._id,
            amount,
            startDate,
            endDate,
            isActive: true,
            isReinvest: true, // No referral commissions
            totalRoiPaid: 0,
        });

        if (!userPlan) {
            return NextResponse.json({ success: false, error: 'Failed to create plan' }, { status: 500 });
        }

        // Update stats for the user and their entire upline chain (to sync tradePower)
        try {
            await updateUserStatsRecursively(session.userId);
        } catch (error) {
            remoteLog('Recursive stats update failed (reinvest)', { error: String(error) }, 'WARN');
        }

        remoteLog('Reinvest success', {
            userId: session.userId,
            amount,
            planTier: plan.name,
            userPlanId: userPlan._id.toString(),
        });

        return NextResponse.json({
            success: true,
            data: {
                userPlanId: userPlan._id.toString(),
                amount,
                planTier: plan.name,
                dailyRoi: plan.dailyRoi,
                endDate,
                newBalance: debitResult.newBalance,
            },
            message: `Successfully reinvested ${amount} USDT. Compounding power activated for ${plan.duration} days.`,
        }, { status: 201 });

    } catch (error) {
        console.error('[reinvest] Error:', error);
        remoteLog('Reinvest error', { error: String(error) }, 'ERROR');
        return NextResponse.json({ success: false, error: 'Failed to process reinvestment' }, { status: 500 });
    }
}
