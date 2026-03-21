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
 * This is the optimized BATCH version.
 */
async function processDailyRoiSettlementBatch(): Promise<SettlementResult & { affectedUserIds: Set<string> }> {
    const { getDB } = await import('./db');
    const { Collections } = await import('./db/collections');
    const db = await getDB();
    const now = new Date();

    const result: SettlementResult & { affectedUserIds: Set<string> } = {
        processed: 0,
        totalAmount: 0,
        errors: [],
        affectedUserIds: new Set<string>()
    };

    try {
        // 1. Fetch eligible plans joined with their plan definitions
        // Shift time back by 4h 30m to align with 04:30 UTC settlement cycle start
        const shifted = new Date(now.getTime() - (4 * 60 + 30) * 60 * 1000);
        const todaySettlementStart = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
        const currentSettlementThreshold = new Date(todaySettlementStart.getTime() + (4 * 60 + 30) * 60 * 1000);

        const eligiblePlans = await db.collection(Collections.USER_PLANS).aggregate([
            {
                $match: {
                    isActive: true,
                    endDate: { $gt: now },
                    $or: [
                        { lastRoiDate: { $exists: false } },
                        { lastRoiDate: { $lt: currentSettlementThreshold } },
                    ],
                }
            },
            {
                $lookup: {
                    from: Collections.PLANS,
                    localField: 'planId',
                    foreignField: '_id',
                    as: 'planData'
                }
            },
            { $unwind: '$planData' }
        ]).toArray();

        console.log(`[ROI] Found ${eligiblePlans.length} plans eligible for ROI settlement`);
        if (eligiblePlans.length === 0) return result;

        const payoutsToProcess: { fromUserId: ObjectId; roiAmount: number; sourceId: ObjectId }[] = [];
        const walletIncrements = new Map<string, number>(); 
        const planUpdates: any[] = [];
        const transactionLogs: any[] = [];

        for (const up of eligiblePlans) {
            try {
                const lastRoi = up.lastRoiDate ? new Date(up.lastRoiDate) : new Date(up.startDate);
                const shiftedLast = new Date(lastRoi.getTime() - (4 * 60 + 30) * 60 * 1000);
                const lastRoiSettlementStart = new Date(Date.UTC(shiftedLast.getUTCFullYear(), shiftedLast.getUTCMonth(), shiftedLast.getUTCDate()));

                const msPerDay = 1000 * 60 * 60 * 24;
                const daysToPay = Math.floor((todaySettlementStart.getTime() - lastRoiSettlementStart.getTime()) / msPerDay);

                if (daysToPay <= 0) continue;

                const dailyRoiAmount = calculateDailyRoi(up.amount, up.planData.dailyRoi);
                const totalCatchUpAmount = dailyRoiAmount * daysToPay;

                payoutsToProcess.push({
                    fromUserId: up.userId,
                    roiAmount: totalCatchUpAmount,
                    sourceId: up._id
                });

                const uid = up.userId.toString();
                walletIncrements.set(uid, (walletIncrements.get(uid) || 0) + totalCatchUpAmount);
                result.affectedUserIds.add(uid);

                planUpdates.push({
                    updateOne: {
                        filter: { _id: up._id },
                        update: {
                            $inc: { totalRoiPaid: totalCatchUpAmount },
                            $set: { lastRoiDate: now, updatedAt: now }
                        }
                    }
                });

                transactionLogs.push({
                    userId: up.userId,
                    type: 'ROI_EARNING' as const,
                    amount: totalCatchUpAmount,
                    description: `ROI for ${daysToPay} day(s) from ${up.planData.name}`,
                    reference: up._id.toString(),
                    createdAt: now
                });

                result.processed++;
                result.totalAmount += totalCatchUpAmount;
            } catch (error) {
                console.error(`Error calculating ROI for plan ${up._id}:`, error);
                result.errors.push({
                    planId: up._id.toString(),
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }

        if (payoutsToProcess.length === 0) return result;

        // 2. Handle Referral Commissions in Batch
        const { distributeRoiCommissionsBatch } = await import('./referral');
        const { distributions, affectedReferrers } = await distributeRoiCommissionsBatch(payoutsToProcess);

        const earningLogs: any[] = [];
        const refWalletIncrements = new Map<string, number>();

        for (const dist of distributions) {
            earningLogs.push({
                userId: new ObjectId(dist.userId),
                fromUserId: dist.fromUserId,
                tier: dist.tier,
                amount: dist.amount,
                isFirstPurchaseBonus: false,
                sourceType: 'roi_settlement',
                sourceId: dist.sourceId,
                createdAt: now
            });

            refWalletIncrements.set(dist.userId, (refWalletIncrements.get(dist.userId) || 0) + dist.amount);
            affectedReferrers.add(dist.userId);
            result.affectedUserIds.add(dist.userId);
        }

        // 3. Execute Bulk Database Operations
        const bulkOps: Promise<any>[] = [];

        if (walletIncrements.size > 0) {
            const walletBulk = Array.from(walletIncrements.entries()).map(([uid, amt]) => ({
                updateOne: {
                    filter: { userId: new ObjectId(uid) },
                    update: { 
                        $inc: { balance: amt }, 
                        $set: { updatedAt: now },
                        $setOnInsert: { createdAt: now } 
                    },
                    upsert: true
                }
            }));
            bulkOps.push(db.collection(Collections.WALLETS).bulkWrite(walletBulk));
        }

        if (refWalletIncrements.size > 0) {
            const refWalletBulk = Array.from(refWalletIncrements.entries()).map(([uid, amt]) => ({
                updateOne: {
                    filter: { userId: new ObjectId(uid) },
                    update: { 
                        $inc: { balance: amt }, 
                        $set: { updatedAt: now },
                        $setOnInsert: { createdAt: now } 
                    },
                    upsert: true
                }
            }));
            bulkOps.push(db.collection(Collections.REFERRAL_WALLETS).bulkWrite(refWalletBulk));
        }

        if (transactionLogs.length > 0) {
            bulkOps.push(db.collection(Collections.TRANSACTIONS).insertMany(transactionLogs));
        }
        if (earningLogs.length > 0) {
            bulkOps.push(db.collection(Collections.REFERRAL_EARNINGS).insertMany(earningLogs));
        }
        if (planUpdates.length > 0) {
            bulkOps.push(db.collection(Collections.USER_PLANS).bulkWrite(planUpdates));
        }

        await Promise.all(bulkOps);

        console.log(`ROI Settlement Complete: ${result.processed} plans processed, total: $${result.totalAmount.toFixed(2)}`);
    } catch (error) {
        console.error('Error in daily ROI settlement:', error);
    }

    return result;
}

/**
 * LEGACY VERSION: Process daily ROI one-by-one (Iterative)
 * Used as a fallback if batch processing is disabled.
 */
async function processDailyRoiSettlementLegacy(): Promise<SettlementResult & { affectedUserIds: Set<string> }> {
    const result: SettlementResult & { affectedUserIds: Set<string> } = {
        processed: 0,
        totalAmount: 0,
        errors: [],
        affectedUserIds: new Set<string>(),
    };

    try {
        const eligiblePlans = await findPlansEligibleForRoi();
        console.log(`[ROI-Legacy] Found ${eligiblePlans.length} plans eligible for ROI settlement`);

        for (const userPlan of eligiblePlans) {
            try {
                await creditPlanRoi(userPlan._id);
                result.processed++;
                result.affectedUserIds.add(userPlan.userId.toString());

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
    } catch (error) {
        console.error('Error in legacy daily ROI settlement:', error);
    }

    return result;
}

/**
 * Main entry point for ROI settlement. Handles the toggle between batch and legacy.
 * Default is Batch. Set DISABLE_BATCH_ROI=true to use legacy iterative logic.
 */
export async function processDailyRoiSettlement(): Promise<SettlementResult & { affectedUserIds: Set<string> }> {
    if (process.env.DISABLE_BATCH_ROI === 'true') {
        console.log('[ROI] Using LEGACY iterative settlement (DISABLE_BATCH_ROI is true)');
        return processDailyRoiSettlementLegacy();
    }
    return processDailyRoiSettlementBatch();
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

    // The system settles at 04:30 UTC (10:00 AM IST).
    // We want to calculate how many "settlement days" have passed.
    // To do this simply, we can shift time back by 4 hours and 30 minutes,
    // so that 04:30 UTC becomes 00:00 UTC of the nominal "settlement day".
    
    // Create a helper to get the "settlement day" start for any date
    const getSettlementDayStart = (date: Date) => {
        const shifted = new Date(date.getTime() - (4 * 60 + 30) * 60 * 1000);
        return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
    };

    const todaySettlementStart = getSettlementDayStart(now);
    
    // Calculate how many days we need to pay for
    // If lastRoiDate is missing, we start from the day after startDate
    const lastRoi = userPlan.lastRoiDate 
        ? new Date(userPlan.lastRoiDate) 
        : new Date(userPlan.startDate);
    
    const lastRoiSettlementStart = getSettlementDayStart(lastRoi);
    
    // Calculate days difference
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysToPay = Math.floor((todaySettlementStart.getTime() - lastRoiSettlementStart.getTime()) / msPerDay);

    if (daysToPay <= 0) {
        console.log(`[ROI] Plan ${_userPlanId} already processed for today. Skipping.`);
        return;
    }

    // ATOMIC CLAIM: Still use atomicClaimRoi to lock the plan for "today"
    // Since atomicClaimRoi expects the limit to compare against, we pass the real-world threshold 
    // which is the current real-world start of the settlement cycle (today at 04:30 UTC)
    const currentSettlementThreshold = new Date(todaySettlementStart.getTime() + (4 * 60 + 30) * 60 * 1000);
    const claimedPlan = await atomicClaimRoi(_userPlanId, currentSettlementThreshold);

    if (!claimedPlan) {
        console.log(`[ROI] Plan ${_userPlanId} już processed for today. Skipping to prevent double-payout.`);
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

    const getSettlementDayStart = (date: Date) => {
        const shifted = new Date(date.getTime() - (4 * 60 + 30) * 60 * 1000);
        return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
    };

    const todaySettlementStart = getSettlementDayStart(now);

    // Check if plan is active
    if (!userPlan.isActive) return false;

    // Check if plan has expired
    if (now > userPlan.endDate) return false;

    // Check if ROI was already credited today (Relative to 04:30 UTC boundary)
    if (userPlan.lastRoiDate) {
        const lastRoiSettlementStart = getSettlementDayStart(new Date(userPlan.lastRoiDate));

        if (lastRoiSettlementStart >= todaySettlementStart) {
            return false; // Already credited for this settlement cycle
        }
    }

    return true;
}
