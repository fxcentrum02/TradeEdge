// ===========================================
// REFERRAL SYSTEM LOGIC (MongoDB Native)
// ===========================================

import { ObjectId } from 'mongodb';
import { getDB } from './db';
import { Collections } from './db/collections';
import { REFERRAL_COMMISSIONS, getTierCommissionPercentage } from './constants';
import { findUserById, findDirectReferrals, findDirectReferralIds, getReferralTreeByTier, countAllDescendants } from './repositories/user.repository';
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

    // Use lightweight projection — only need _id for $in filter
    const directReferralIds = await findDirectReferralIds(userId);

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
    const { distributions } = await distributeRoiCommissionsBatch([{ fromUserId, roiAmount, sourceId }]);
    
    // For backward compatibility, we still trigger recursive update here 
    // BUT in the optimized cron job we should use the batch version.
    if (distributions.length > 0) {
        await updateUserStatsRecursively(new ObjectId(distributions[0].userId));
    }

    return distributions;
}

/**
 * Optimized batch version of distributeRoiCommissions.
 * Does NOT update user stats; returns the affected referrers so they can be updated in bulk later.
 */
export async function distributeRoiCommissionsBatch(
    payouts: { fromUserId: ObjectId; roiAmount: number; sourceId: ObjectId }[]
): Promise<{ 
    distributions: { tier: number; userId: string; amount: number; sourceId: ObjectId; fromUserId: ObjectId }[], 
    affectedReferrers: Set<string> 
}> {
    const allDistributions: { tier: number; userId: string; amount: number; sourceId: ObjectId; fromUserId: ObjectId }[] = [];
    const affectedReferrers = new Set<string>();

    const db = await getDB();
    const now = new Date();

    // 1. Fetch all active users minimal projection
    const users = await db.collection(Collections.USERS).find(
        { isDeleted: { $ne: true } },
        { projection: { _id: 1, referredById: 1 } }
    ).toArray();

    // 2. Fetch all active plans
    const activePlans = await db.collection(Collections.USER_PLANS).find(
        { isActive: true, endDate: { $gt: now } },
        { projection: { userId: 1, amount: 1 } }
    ).toArray();

    // Build user mapping
    const userMap = new Map<string, { _id: ObjectId; referredById?: ObjectId | null }>();
    for (const u of users) {
        userMap.set(u._id.toString(), u);
    }

    // Build active investments map
    const userActiveInvestment = new Map<string, number>();
    for (const plan of activePlans) {
        const uid = plan.userId.toString();
        userActiveInvestment.set(uid, (userActiveInvestment.get(uid) || 0) + plan.amount);
    }

    // Build direct referrals investments map
    const directReferralsInvestment = new Map<string, number>();
    for (const u of users) {
        if (u.referredById) {
            const pid = u.referredById.toString();
            const childActive = userActiveInvestment.get(u._id.toString()) || 0;
            directReferralsInvestment.set(pid, (directReferralsInvestment.get(pid) || 0) + childActive);
        }
    }

    // In-memory tier unlock evaluator
    const isTierUnlockedInMemory = (userId: ObjectId, tier: number): boolean => {
        if (tier === 1) return true; // Tier 1 is always unlocked
        const uidStr = userId.toString();
        const personal = userActiveInvestment.get(uidStr) || 0;
        const direct = directReferralsInvestment.get(uidStr) || 0;
        const totalInvestment = personal + direct;
        const required = (tier - 1) * REFERRAL_COMMISSIONS.INVESTMENT_TO_UNLOCK_PER_TIER;
        return totalInvestment >= required;
    };

    // Process payouts entirely in memory
    for (const payout of payouts) {
        const { fromUserId, roiAmount, sourceId } = payout;
        const subscriber = userMap.get(fromUserId.toString());
        if (!subscriber?.referredById) continue;

        let currentReferrerId: ObjectId | undefined = subscriber.referredById;
        let tier = 1;

        while (currentReferrerId && tier <= REFERRAL_COMMISSIONS.MAX_TIER) {
            const referrer = userMap.get(currentReferrerId.toString());
            if (!referrer) break;

            const unlocked = isTierUnlockedInMemory(referrer._id, tier);

            if (unlocked) {
                const percentage = getTierCommissionPercentage(tier);
                const commission = (roiAmount * percentage) / 100;

                if (commission > 0) {
                    allDistributions.push({
                        tier,
                        userId: referrer._id.toString(),
                        fromUserId,
                        amount: commission,
                        sourceId,
                    });
                    affectedReferrers.add(referrer._id.toString());
                }
            }

            currentReferrerId = referrer.referredById || undefined;
            tier++;
        }
    }

    return { distributions: allDistributions, affectedReferrers };
}

/**
 * Predict exact referral earnings for the next settlement cycle based on currently active plans.
 */
export async function getEstimatedTomorrowReferralEarnings(userId: string | ObjectId): Promise<number> {
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const tierTree = await getReferralTreeByTier(_userId, REFERRAL_COMMISSIONS.MAX_TIER);
    
    const allUserIds = tierTree.flatMap(t => t.userIds);
    if (allUserIds.length === 0) return 0;

    const unlockInvestment = await getTierUnlockInvestment(_userId);
    const db = await getDB();
    const now = new Date();

    // Fetch all active user plans and join with plan definitions in one single query
    const activePlans = await db.collection(Collections.USER_PLANS).aggregate([
        { $match: { userId: { $in: allUserIds }, isActive: true, endDate: { $gt: now } } },
        { $lookup: { from: Collections.PLANS, localField: 'planId', foreignField: '_id', as: 'planData' } },
        { $unwind: '$planData' }
    ]).toArray();

    // Map user plans in memory
    const userPlansMap = new Map<string, typeof activePlans>();
    for (const plan of activePlans) {
        const uidStr = plan.userId.toString();
        if (!userPlansMap.has(uidStr)) {
            userPlansMap.set(uidStr, []);
        }
        userPlansMap.get(uidStr)!.push(plan);
    }

    let estimatedEarnings = 0;

    for (let i = 1; i <= REFERRAL_COMMISSIONS.MAX_TIER; i++) {
        const treeData = tierTree.find(t => t.tier === i);
        if (!treeData || treeData.userIds.length === 0) continue;

        const isUnlocked = i === 1 || unlockInvestment >= ((i - 1) * REFERRAL_COMMISSIONS.INVESTMENT_TO_UNLOCK_PER_TIER);
        if (!isUnlocked) continue;

        const percentage = getTierCommissionPercentage(i);
        if (percentage <= 0) continue;

        for (const uid of treeData.userIds) {
            const plans = userPlansMap.get(uid.toString()) || [];
            for (const up of plans) {
                const dailyRoiAmount = (up.amount * up.planData.dailyRoi) / 100;
                estimatedEarnings += (dailyRoiAmount * percentage) / 100;
            }
        }
    }
    return estimatedEarnings;
}

/**
 * Predict total global referral earnings for the entire system for tomorrow's settlement cycle.
 * Optimized to run in exactly 2 database queries: 1 for active plans join, 1 for users projection.
 */
export async function getGlobalEstimatedTomorrowReferralEarnings(): Promise<number> {
    const db = await getDB();
    const now = new Date();

    // 1. Fetch all active plans with their daily ROI
    const activePlans = await db.collection(Collections.USER_PLANS).aggregate([
        { $match: { isActive: true, endDate: { $gt: now } } },
        {
            $lookup: {
                from: Collections.PLANS,
                localField: 'planId',
                foreignField: '_id',
                as: 'planData'
            }
        },
        { $unwind: '$planData' },
        {
            $project: {
                userId: 1,
                amount: 1,
                dailyRoi: '$planData.dailyRoi'
            }
        }
    ]).toArray();

    if (activePlans.length === 0) return 0;

    // 2. Fetch all users minimal projection to build memory map
    const users = await db.collection(Collections.USERS).find(
        { isDeleted: { $ne: true } },
        { projection: { _id: 1, referredById: 1 } }
    ).toArray();

    // Map of userId (string) -> personal active investment (number)
    const userActiveInvestment = new Map<string, number>();
    for (const plan of activePlans) {
        const uid = plan.userId.toString();
        userActiveInvestment.set(uid, (userActiveInvestment.get(uid) || 0) + plan.amount);
    }

    // Map of userId (string) -> parentId (string)
    const parentMap = new Map<string, string>();
    // Map of userId (string) -> sum of direct referrals' active investments (number)
    const directReferralsInvestment = new Map<string, number>();

    for (const u of users) {
        const uid = u._id.toString();
        if (u.referredById) {
            const pid = u.referredById.toString();
            parentMap.set(uid, pid);
            
            const personalActive = userActiveInvestment.get(uid) || 0;
            directReferralsInvestment.set(pid, (directReferralsInvestment.get(pid) || 0) + personalActive);
        }
    }

    // Helper to check if a tier is unlocked for a user in memory
    const isTierUnlockedForUser = (uid: string, tier: number): boolean => {
        if (tier === 1) return true;
        const personal = userActiveInvestment.get(uid) || 0;
        const direct = directReferralsInvestment.get(uid) || 0;
        const totalInvestment = personal + direct;
        const required = (tier - 1) * REFERRAL_COMMISSIONS.INVESTMENT_TO_UNLOCK_PER_TIER;
        return totalInvestment >= required;
    };

    let totalPredictedReferral = 0;

    for (const plan of activePlans) {
        const dailyRoiAmount = (plan.amount * plan.dailyRoi) / 100;
        let currentUserId = plan.userId.toString();
        let tier = 1;

        while (tier <= REFERRAL_COMMISSIONS.MAX_TIER) {
            const referrerId = parentMap.get(currentUserId);
            if (!referrerId) break;

            if (isTierUnlockedForUser(referrerId, tier)) {
                const percentage = getTierCommissionPercentage(tier);
                const commission = (dailyRoiAmount * percentage) / 100;
                totalPredictedReferral += commission;
            }

            currentUserId = referrerId;
            tier++;
        }
    }

    return totalPredictedReferral;
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

    // 1. Run Block 1: Fetch all independent data simultaneously
    const [
        tierTree,
        tierEarnings,
        directReferralUsers,
        totalEarnings,
        wallet,
        tradePower,
        settings,
        totalClaimed
    ] = await Promise.all([
        getReferralTreeByTier(_userId, REFERRAL_COMMISSIONS.MAX_TIER),
        getReferralEarningsByTier(_userId),
        findDirectReferrals(_userId),
        getTotalReferralEarnings(_userId),
        findReferralWalletByUserId(_userId),
        getTotalActiveAmount(_userId),
        getSettings(),
        getTotalReferralClaimed(_userId)
    ]);

    const allUserIdsIn20Tiers = tierTree.flatMap(t => t.userIds);
    const directIds = directReferralUsers.map(r => r._id);
    const db = await getDB();
    const now = new Date();

    // 2. Run Block 2: Fetch all dependent aggregations simultaneously
    const [
        tierDataResults,
        directStats,
        earningsFromUsers,
        tpResult
    ] = await Promise.all([
        allUserIdsIn20Tiers.length > 0 ? db.collection(Collections.USER_PLANS).aggregate([
            { $match: { userId: { $in: allUserIdsIn20Tiers } } },
            {
                $facet: {
                    investmentByUser: [
                        { $group: { _id: '$userId', total: { $sum: '$amount' } } }
                    ],
                    activeByUser: [
                        { $match: { isActive: true, endDate: { $gt: now } } },
                        { $group: { _id: '$userId', count: { $sum: 1 } } }
                    ]
                }
            }
        ]).toArray() : Promise.resolve([{ investmentByUser: [], activeByUser: [] }]),
        directIds.length > 0 ? db.collection(Collections.USER_PLANS).aggregate([
            { $match: { userId: { $in: directIds } } },
            {
                $group: {
                    _id: '$userId',
                    totalInvested: { $sum: '$amount' },
                    activeInvestment: {
                        $sum: {
                            $cond: [
                                { $and: [ { $eq: ['$isActive', true] }, { $gt: ['$endDate', now] } ] },
                                '$amount',
                                0
                            ]
                        }
                    },
                    activeCount: {
                        $sum: {
                            $cond: [
                                { $and: [ { $eq: ['$isActive', true] }, { $gt: ['$endDate', now] } ] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]).toArray() : Promise.resolve([]),
        db.collection(Collections.REFERRAL_EARNINGS).aggregate([
            { $match: { userId: _userId, fromUserId: { $in: directIds } } },
            { $group: { _id: '$fromUserId', total: { $sum: '$amount' } } }
        ]).toArray(),
        allUserIdsIn20Tiers.length > 0 ? db.collection(Collections.USERS).aggregate([
            { $match: { _id: { $in: allUserIdsIn20Tiers } } },
            { $group: { _id: null, total: { $sum: '$tradePower' } } }
        ]).toArray() : Promise.resolve([])
    ]);

    const facet = tierDataResults[0];
    const userInvestmentMap = new Map<string, number>(facet.investmentByUser.map((r: any) => [r._id.toString(), r.total]));
    const userActiveMap = new Set(facet.activeByUser.map((r: any) => r._id.toString()));

    const activeCountsMap = new Map<string, number>();
    const lifetimeMap = new Map<string, number>();
    let directActiveInvestment = 0;

    for (const row of directStats) {
        const sid = row._id.toString();
        activeCountsMap.set(sid, row.activeCount);
        lifetimeMap.set(sid, row.totalInvested);
        directActiveInvestment += row.activeInvestment;
    }

    const unlockInvestment = tradePower + directActiveInvestment;

    const tiers: ReferralTier[] = [];
    for (let i = 1; i <= REFERRAL_COMMISSIONS.MAX_TIER; i++) {
        const treeData = tierTree.find(t => t.tier === i);
        const earningsData = tierEarnings.find((t: any) => t._id === i);
        const userIds = treeData?.userIds || [];

        let totalInvested = 0;
        let activeUserCount = 0;

        userIds.forEach(uid => {
            const sid = uid.toString();
            totalInvested += (userInvestmentMap.get(sid) as number) || 0;
            if (userActiveMap.has(sid)) activeUserCount++;
        });

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

    const earningsMap = new Map(earningsFromUsers.map((r: any) => [r._id.toString(), r.total]));

    const directReferrals: DirectReferral[] = directReferralUsers.map((refUser) => {
        const sid = refUser._id.toString();
        return {
            id: sid,
            telegramUsername: refUser.telegramUsername || null,
            firstName: refUser.firstName || null,
            lastName: refUser.lastName || null,
            photoUrl: refUser.photoUrl || null,
            joinedAt: refUser.createdAt,
            isActive: refUser.isActive,
            planCount: activeCountsMap.get(sid) || 0,
            tradePower: refUser.tradePower || 0,
            totalInvested: lifetimeMap.get(sid) || 0,
            earnings: earningsMap.get(sid) || 0,
        };
    });

    // Build referral link
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'infinityy_global_bot';
    const referralWalletBalance = wallet?.balance || 0;
    const referralClaimMultiplier = settings.referralClaimMultiplier || 1;

    const tier20TotalCount = tiers.reduce((sum, tier) => sum + tier.userCount, 0);
    const totalDownlineTradePower = tpResult.length > 0 ? tpResult[0].total : 0;

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
        minReferralWithdrawalAmount: settings.minReferralWithdrawalAmount || 10,
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
    
    await recalculateAndSaveUserStats(_userId);

    // 3. Move up to the next parent
    const db = await getDB();
    const user = await db.collection(Collections.USERS).findOne({ _id: _userId }, { projection: { referredById: 1 } });
    if (user?.referredById) {
        await updateUserStatsRecursively(user.referredById, depth + 1);
    }
}

/**
 * Recalculate and update stats for a batch of users and their upline chains.
 * Deduplicates users to avoid redundant calculations.
 */
export async function refreshUserStatsBatch(userIds: Set<string | ObjectId>): Promise<void> {
    const db = await getDB();
    const allAffected = new Set<string>();

    // 1. Fetch all user linkages in a single query to walk the tree in memory
    const users = await db.collection(Collections.USERS).find(
        {},
        { projection: { _id: 1, referredById: 1 } }
    ).toArray();

    // 2. Build parent map
    const parentMap = new Map<string, string>();
    for (const u of users) {
        if (u.referredById) {
            parentMap.set(u._id.toString(), u.referredById.toString());
        }
    }

    // 3. Traverse parent chains in memory
    for (const id of userIds) {
        let currentIdStr = id.toString();
        let depth = 0;
        while (currentIdStr && depth <= REFERRAL_COMMISSIONS.MAX_TIER) {
            if (allAffected.has(currentIdStr)) break;
            allAffected.add(currentIdStr);
            currentIdStr = parentMap.get(currentIdStr) || '';
            depth++;
        }
    }

    if (allAffected.size === 0) return;
    console.log(`[Stats] Batch refreshing ${allAffected.size} unique users`);

    // Process in sequential chunks to keep memory/connections stable
    // We don't want too much parallelism here as EACH refresh is heavy
    const userArray = Array.from(allAffected);
    for (let i = 0; i < userArray.length; i += 5) {
        const chunk = userArray.slice(i, i + 5);
        await Promise.all(chunk.map(uid => recalculateAndSaveUserStats(new ObjectId(uid))));
    }
    console.log(`[Stats] Batch refresh complete`);
}

/**
 * Internal helper to recalculate stats for ONE user and save to DB.
 */
async function recalculateAndSaveUserStats(userId: ObjectId): Promise<void> {
    const db = await getDB();
    
    // 1. Fetch descendants in a single unified graphLookup to calculate counts in memory
    const descendantsResult = await db.collection(Collections.USERS).aggregate([
        { $match: { _id: userId } },
        {
            $graphLookup: {
                from: Collections.USERS,
                startWith: '$_id',
                connectFromField: '_id',
                connectToField: 'referredById',
                depthField: 'depth',
                as: 'descendants'
            }
        },
        {
            $project: {
                _id: 0,
                'descendants._id': 1,
                'descendants.depth': 1
            }
        }
    ]).toArray();

    const descendants = (descendantsResult[0]?.descendants || []) as { _id: ObjectId; depth: number }[];
    const directCount = descendants.filter(d => d.depth === 0).length;
    const totalDownline = descendants.length;
    const totalCount = descendants.filter(d => d.depth < REFERRAL_COMMISSIONS.MAX_TIER).length;

    // 2. Fetch earnings and active trade power
    const [totalEarnings, tradePower] = await Promise.all([
        getTotalReferralEarnings(userId),
        getTotalActiveAmount(userId)
    ]);

    // 3. Update the user document
    await db.collection(Collections.USERS).updateOne(
        { _id: userId },
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
}
