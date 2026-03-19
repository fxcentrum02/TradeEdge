// ===========================================
// REFERRAL SYSTEM LOGIC (MongoDB Native)
// ===========================================

import { ObjectId } from 'mongodb';
import { getDB } from './db';
import { Collections } from './db/collections';
import { REFERRAL_COMMISSIONS, getTierCommissionPercentage } from './constants';
import { findUserById, findDirectReferrals, getReferralTreeByTier, countAllDescendants } from './repositories/user.repository';
import { createReferralEarning, getReferralEarningsByTier, getTotalReferralEarnings, getEarningsFromUser } from './repositories/referral-earning.repository';
import { creditReferralWallet, findReferralWalletByUserId, getTotalReferralClaimed } from './repositories/referral-wallet.repository';
import { getTotalActiveAmount, countActivePlansByUserId, getTotalInvestedAmount } from './repositories/user-plan.repository';
import { getSettings } from './repositories/settings.repository';
import type { ReferralTier, DirectReferral, ReferralStats } from '@/types';
import type { ReferralEarningDocument, UserDocument } from './db/types';

/**
 * Calculate the total investment for unlocking tiers:
 * User's personal active investment + Direct referrals' total active investment.
 */
export async function getTierUnlockInvestment(userId: ObjectId): Promise<number> {
    const personalInvestment = await getTotalActiveAmount(userId);

    const directReferrals = await findDirectReferrals(userId);
    const directReferralIds = directReferrals.map(r => r._id);

    let directInvestment = 0;
    if (directReferralIds.length > 0) {
        const db = await getDB();
        const activePlans = await db.collection(Collections.USER_PLANS).aggregate([
            { $match: { userId: { $in: directReferralIds }, isActive: true, endDate: { $gt: new Date() } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]).toArray();
        directInvestment = activePlans.length > 0 ? activePlans[0].total : 0;
    }

    return personalInvestment + directInvestment;
}

/**
 * Check if a specific referral tier is unlocked for a user.
 */
export async function isTierUnlocked(userId: ObjectId, tier: number): Promise<boolean> {
    if (tier === 1) return true; // Tier 1 (Directs) is always unlocked
    const totalInvestment = await getTierUnlockInvestment(userId);
    const requiredInvestment = (tier - 1) * REFERRAL_COMMISSIONS.INVESTMENT_TO_UNLOCK_PER_TIER;
    return totalInvestment >= requiredInvestment;
}

/**
 * Distribute referral commissions based on ROI earned by a user.
 * Called daily during ROI settlement.
 */
export async function distributeRoiCommissions(
    fromUserId: ObjectId,
    roiAmount: number,
    sourceId: ObjectId
): Promise<{ tier: number; userId: string; amount: number }[]> {
    const distributions: { tier: number; userId: string; amount: number }[] = [];

    const subscriber = await findUserById(fromUserId);
    if (!subscriber?.referredById) {
        return distributions;
    }

    let currentReferrerId: ObjectId | undefined = subscriber.referredById || undefined;
    let tier = 1;

    while (currentReferrerId && tier <= REFERRAL_COMMISSIONS.MAX_TIER) {
        const referrer = await findUserById(currentReferrerId);
        if (!referrer) break;

        // Check if this tier is unlocked for the referrer
        const unlocked = await isTierUnlocked(referrer._id, tier);

        if (unlocked) {
            const percentage = getTierCommissionPercentage(tier);
            const commission = (roiAmount * percentage) / 100;

            if (commission > 0) {
                // Create referral earning record
                await createReferralEarning({
                    userId: referrer._id,
                    fromUserId,
                    tier,
                    amount: commission,
                    isFirstPurchaseBonus: false,
                    sourceType: 'roi_settlement',
                    sourceId,
                });

                // Credit REFERRAL wallet
                await creditReferralWallet(
                    referrer._id,
                    commission,
                    `Tier ${tier} referral commission from ROI settlement`
                );

                distributions.push({
                    tier,
                    userId: referrer._id.toString(),
                    amount: commission,
                });
            }
        }

        currentReferrerId = referrer.referredById || undefined;
        tier++;
    }

    return distributions;
}

/**
 * Predict exact referral earnings for the next settlement cycle based on currently active plans.
 */
export async function getEstimatedTomorrowReferralEarnings(userId: string | ObjectId): Promise<number> {
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const tierTree = await getReferralTreeByTier(_userId, REFERRAL_COMMISSIONS.MAX_TIER);
    const unlockInvestment = await getTierUnlockInvestment(_userId);
    
    let estimatedEarnings = 0;
    const db = await getDB();
    const now = new Date();

    for (let i = 1; i <= REFERRAL_COMMISSIONS.MAX_TIER; i++) {
        const treeData = tierTree.find(t => t.tier === i);
        if (!treeData || treeData.userIds.length === 0) continue;

        const isUnlocked = i === 1 || unlockInvestment >= ((i - 1) * REFERRAL_COMMISSIONS.INVESTMENT_TO_UNLOCK_PER_TIER);
        if (!isUnlocked) continue;

        const percentage = getTierCommissionPercentage(i);
        if (percentage <= 0) continue;

        // Fetch active plans and cross-reference planar daily ROI
        const activePlans = await db.collection(Collections.USER_PLANS).aggregate([
            { $match: { userId: { $in: treeData.userIds }, isActive: true, endDate: { $gt: now } } },
            { $lookup: { from: Collections.PLANS, localField: 'planId', foreignField: '_id', as: 'planData' } },
            { $unwind: '$planData' }
        ]).toArray();

        for (const up of activePlans) {
            const dailyRoiAmount = (up.amount * up.planData.dailyRoi) / 100;
            estimatedEarnings += (dailyRoiAmount * percentage) / 100;
        }
    }
    return estimatedEarnings;
}

/**
 * Distribute referral commissions when a user's MP purchase is approved.
 * [DEPRECATED] Now handled via ROI settlement.
 */
export async function distributeReferralCommissions(
    subscriberId: string | ObjectId,
    userPlanId: string | ObjectId,
    planAmount: number,
    isReinvest: boolean = false
): Promise<{ tier: number; userId: string; amount: number }[]> {
    return []; // No longer using purchase-based commissions
}

/**
 * Get user's referral statistics with 20-tier breakdown.
 */
export async function getReferralStats(userId: string | ObjectId): Promise<ReferralStats> {
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const user = await findUserById(_userId);

    if (!user) {
        throw new Error('User not found');
    }

    // 1. Get user counts at each tier
    const tierTree = await getReferralTreeByTier(_userId, REFERRAL_COMMISSIONS.MAX_TIER);

    // 2. Get earnings grouped by tier
    const tierEarnings = await getReferralEarningsByTier(_userId);

    // 3. Build the 20-tier summary (with aggregate investment)
    const db = await getDB();
    const tiers: ReferralTier[] = [];

    const unlockInvestment = await getTierUnlockInvestment(_userId);

    for (let i = 1; i <= REFERRAL_COMMISSIONS.MAX_TIER; i++) {
        const treeData = tierTree.find(t => t.tier === i);
        const earningsData = tierEarnings.find((t: any) => t._id === i);
        const userIds = treeData?.userIds || [];

        // Aggregate ALL investment (lifetime) for all users in this tier
        let totalInvested = 0;
        if (userIds.length > 0) {
            const investmentResult = await db.collection(Collections.USER_PLANS).aggregate([
                { $match: { userId: { $in: userIds } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]).toArray();
            totalInvested = investmentResult.length > 0 ? investmentResult[0].total : 0;
        }

        // Aggregate active users count
        let activeUserCount = 0;
        const now = new Date();
        if (userIds.length > 0) {
            const activeUserIds = await db.collection(Collections.USER_PLANS).distinct('userId', {
                userId: { $in: userIds },
                isActive: true,
                endDate: { $gt: now }
            });
            activeUserCount = activeUserIds.length;
        }

        const isUnlocked = i === 1 || unlockInvestment >= ((i - 1) * REFERRAL_COMMISSIONS.INVESTMENT_TO_UNLOCK_PER_TIER);

        tiers.push({
            tier: i,
            userCount: userIds.length,
            activeUserCount,
            totalInvested,
            totalEarnings: earningsData?.totalEarnings || 0,
            isUnlocked
        });
    }

    // 4. Build direct referrals list (Tier 1)
    const directReferralUsers = await findDirectReferrals(_userId);

    const directReferrals: DirectReferral[] = await Promise.all(
        directReferralUsers.map(async (refUser) => {
            const [planCount, earningsFromUser, lifetimeInvested] = await Promise.all([
                countActivePlansByUserId(refUser._id),
                getEarningsFromUser(_userId, refUser._id),
                getTotalInvestedAmount(refUser._id)
            ]);

            return {
                id: refUser._id.toString(),
                telegramUsername: refUser.telegramUsername || null,
                firstName: refUser.firstName || null,
                lastName: refUser.lastName || null,
                photoUrl: refUser.photoUrl || null,
                joinedAt: refUser.createdAt,
                isActive: refUser.isActive,
                planCount,
                tradePower: refUser.tradePower || 0,
                totalInvested: lifetimeInvested,
                earnings: earningsFromUser,
            };
        })
    );

    // 5. Build referral link
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'infinityy_global_bot';
    const miniAppName = process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME || 'infinity_global';

    const [totalEarnings, wallet, tradePower, settings, totalClaimed] = await Promise.all([
        getTotalReferralEarnings(_userId),
        findReferralWalletByUserId(_userId),
        getTotalActiveAmount(_userId),
        getSettings(),
        getTotalReferralClaimed(_userId)
    ]);
    const referralWalletBalance = wallet?.balance || 0;
    const referralClaimMultiplier = settings.referralClaimMultiplier || 1;

    const tier20TotalCount = tiers.reduce((sum, tier) => sum + tier.userCount, 0);

    // Calculate total downline mining power (sum of tradePower of all users in 20 tiers)
    let totalDownlineTradePower = 0;
    const allUserIdsIn20Tiers = tierTree.flatMap(t => t.userIds);
    if (allUserIdsIn20Tiers.length > 0) {
        const tpResult = await db.collection(Collections.USERS).aggregate([
            { $match: { _id: { $in: allUserIdsIn20Tiers } } },
            { $group: { _id: null, total: { $sum: '$tradePower' } } }
        ]).toArray();
        totalDownlineTradePower = tpResult.length > 0 ? tpResult[0].total : 0;
    }

    return {
        referralCode: user.referralCode,
        referralLink: `https://t.me/${botUsername}?start=${user.referralCode}`,
        telegramLink: `https://t.me/${botUsername}?start=${user.referralCode}`,
        tiers,
        directReferrals,
        totalReferrals: directReferrals.length,
        totalDownlineCount: user.totalDownlineCount || 0,
        totalDownlineTradePower,
        tier20TotalCount,
        totalEarnings,
        referralWalletBalance,
        totalClaimed,
        referralClaimMultiplier,
        tradePower,
    };
}

/**
 * Recursively update referral stats for a user and their entire upline chain (20 tiers).
 * Updates: directReferralCount, totalReferralCount, totalEarnings, tradePower.
 */
export async function updateUserStatsRecursively(userId: string | ObjectId, depth: number = 0): Promise<void> {
    // Safety: only go up 20 tiers from where we started
    if (depth > REFERRAL_COMMISSIONS.MAX_TIER) return;

    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const db = await getDB();

    // 1. Recalculate Stats for THIS user
    const [
        directCount,
        tierTree,
        totalDownline,
        totalEarnings,
        tradePower
    ] = await Promise.all([
        db.collection(Collections.USERS).countDocuments({ referredById: _userId }),
        getReferralTreeByTier(_userId, REFERRAL_COMMISSIONS.MAX_TIER),
        countAllDescendants(_userId),
        getTotalReferralEarnings(_userId),
        getTotalActiveAmount(_userId)
    ]);

    // totalReferralCount = sum of all user IDs in the 10-tier tree
    const totalCount = tierTree.reduce((sum: number, tierData) => sum + tierData.userIds.length, 0);

    // 2. Update the user document
    await db.collection(Collections.USERS).updateOne(
        { _id: _userId },
        {
            $set: {
                directReferralCount: directCount,
                totalReferralCount: totalCount,
                totalDownlineCount: totalDownline,
                totalEarnings: totalEarnings,
                tradePower: tradePower,
                updatedAt: new Date(),
            },
        }
    );

    // 3. Move up to the next parent
    const user = await db.collection(Collections.USERS).findOne({ _id: _userId }, { projection: { referredById: 1 } });
    if (user?.referredById) {
        await updateUserStatsRecursively(user.referredById, depth + 1);
    }
}
