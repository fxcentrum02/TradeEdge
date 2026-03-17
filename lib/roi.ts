// ===========================================
// ROI SETTLEMENT LOGIC
// ===========================================

import { ObjectId } from 'mongodb';
import { calculateDailyRoi } from './constants';
import { findPlanById } from './repositories/plan.repository';
import { findPlansEligibleForRoi, updateRoiPaid } from './repositories/user-plan.repository';
import { creditWallet } from './repositories/wallet.repository';

export interface SettlementResult {
    processed: number;
    totalAmount: number;
    errors: { planId: string; error: string }[];
}

/**
 * Process daily ROI for all active plans
 * Called by cron job daily
 */
export async function processDailyRoiSettlement(): Promise<SettlementResult> {
    const result: SettlementResult = {
        processed: 0,
        totalAmount: 0,
        errors: [],
    };

    try {
        // Find all plans eligible for ROI credit today
        const eligiblePlans = await findPlansEligibleForRoi();

        console.log(`Found ${eligiblePlans.length} plans eligible for ROI settlement`);

        for (const userPlan of eligiblePlans) {
            try {
                await creditPlanRoi(userPlan._id);

                result.processed++;

                // Calculate the amount for logging
                const plan = await findPlanById(userPlan.planId);
                if (plan) {
                    const dailyRoi = calculateDailyRoi(userPlan.amount, plan.dailyRoi);
                    result.totalAmount += dailyRoi;
                }
            } catch (error) {
                console.error(`Error processing ROI for plan ${userPlan._id}:`, error);
                result.errors.push({
                    planId: userPlan._id.toString(),
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        console.log(`ROI Settlement Complete: ${result.processed} plans processed, total: $${result.totalAmount.toFixed(2)}`);
    } catch (error) {
        console.error('Error in daily ROI settlement:', error);
    }

    return result;
}

/**
 * Calculate and credit ROI for a single plan
 */
export async function creditPlanRoi(userPlanId: string | ObjectId): Promise<void> {
    const { findUserPlanById, atomicClaimRoi, incrementRoiPaid } = await import('./repositories/user-plan.repository');

    const _userPlanId = typeof userPlanId === 'string' ? new ObjectId(userPlanId) : userPlanId;
    const userPlan = await findUserPlanById(_userPlanId);

    if (!userPlan) {
        throw new Error('User plan not found');
    }

    if (!userPlan.isActive) {
        throw new Error('Plan is not active');
    }

    const now = new Date();
    if (now > userPlan.endDate) {
        throw new Error('Plan has expired');
    }

    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    
    // Calculate how many days we need to pay for
    // If lastRoiDate is missing, we start from the day after startDate
    const lastRoi = userPlan.lastRoiDate 
        ? new Date(userPlan.lastRoiDate) 
        : new Date(userPlan.startDate);
    
    // Normalize lastRoi to start of day UTC
    const lastRoiDay = new Date(Date.UTC(lastRoi.getUTCFullYear(), lastRoi.getUTCMonth(), lastRoi.getUTCDate()));
    
    // Calculate days difference
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysToPay = Math.floor((today.getTime() - lastRoiDay.getTime()) / msPerDay);

    if (daysToPay <= 0) {
        console.log(`[ROI] Plan ${_userPlanId} already processed for today. Skipping.`);
        return;
    }

    // ATOMIC CLAIM: Still use atomicClaimRoi to lock the plan for "today"
    const claimedPlan = await atomicClaimRoi(_userPlanId, today);

    if (!claimedPlan) {
        console.log(`[ROI] Plan ${_userPlanId} already processed for today. Skipping to prevent double-payout.`);
        return;
    }

    // Get plan details
    const plan = await findPlanById(userPlan.planId);
    if (!plan) {
        throw new Error('Plan not found');
    }

    // Calculate daily ROI
    const dailyRoiAmount = calculateDailyRoi(userPlan.amount, plan.dailyRoi);
    const totalCatchUpAmount = dailyRoiAmount * daysToPay;

    console.log(`[ROI] Catching up ${daysToPay} days for plan ${_userPlanId}. Total: ${totalCatchUpAmount}`);

    // Credit wallet
    await creditWallet(
        userPlan.userId,
        totalCatchUpAmount,
        'ROI_EARNING',
        `ROI for ${daysToPay} day(s) from ${plan.name} (Catch-up)`,
        _userPlanId.toString()
    );

    // Distribute referral commissions from this ROI (only if NOT a reinvestment)
    if (!userPlan.isReinvest) {
        try {
            const { distributeRoiCommissions, updateUserStatsRecursively } = await import('./referral');
            // We distribute commissions for the TOTAL amount credited
            const distributions = await distributeRoiCommissions(
                userPlan.userId,
                totalCatchUpAmount,
                _userPlanId
            );
            
            // If there were distributions, update the first referrer's stats recursively
            if (distributions.length > 0) {
                await updateUserStatsRecursively(distributions[0].userId);
            }
        } catch (refError) {
            console.error(`Error distributing referral commissions for plan ${_userPlanId}:`, refError);
        }
    }

    // Update plan's ROI tracking
    await incrementRoiPaid(_userPlanId, totalCatchUpAmount);

    console.log(`Credited ${totalCatchUpAmount} USDT ROI to user ${userPlan.userId} for plan ${_userPlanId} (${daysToPay} days)`);
}

/**
 * Check if plan is eligible for ROI credit today
 */
export function isEligibleForRoi(userPlan: any): boolean {
    const now = new Date();
    // UTC "today" at 00:00:00
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    // Check if plan is active
    if (!userPlan.isActive) return false;

    // Check if plan has expired
    if (now > userPlan.endDate) return false;

    // Check if ROI was already credited today (UTC)
    if (userPlan.lastRoiDate) {
        const lastRoiDay = new Date(Date.UTC(
            userPlan.lastRoiDate.getUTCFullYear(),
            userPlan.lastRoiDate.getUTCMonth(),
            userPlan.lastRoiDate.getUTCDate()
        ));

        if (lastRoiDay >= today) {
            return false; // Already credited today
        }
    }

    return true;
}
