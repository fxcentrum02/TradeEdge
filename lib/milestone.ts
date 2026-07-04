// ===========================================
// REFERRAL MILESTONE BONUS — CORE ALGORITHM
// ===========================================
//
// 40 / 30 / 30 Rule (per milestone):
//
//   For each milestone threshold T (e.g. 5000 USDT):
//   - Compute "leg volume" for every direct referral of the user:
//       legVolume = directReferral.tradePower + SUM(tradePower of all their descendants)
//   - Sort legs descending by legVolume
//   - Leg A (largest leg)  >= T * 0.40
//   - Leg B (2nd largest)  >= T * 0.30
//   - Leg C (rest combined) >= T * 0.30
//   - If all three pass AND milestone not yet awarded => credit referral wallet + log award
//
// Idempotency: guaranteed by unique DB index on (userId, milestoneThreshold).

import { ObjectId } from 'mongodb';
import { getDB } from './db';
import { Collections } from './db/collections';
import { MILESTONE_BONUSES, MILESTONE_SPLIT } from './constants';
import { findDirectReferrals } from './repositories/user.repository';
import { creditReferralWallet } from './repositories/referral-wallet.repository';
import { createMilestoneAward, getAwardedMilestoneThresholds } from './repositories/milestone.repository';
import type { TransactionDocument } from './db/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LegVolume {
    userId: string;
    firstName: string | null;
    telegramUsername: string | null;
    personalTradePower: number;
    downlineTradePower: number;
    totalLegVolume: number;
}

export interface MilestoneCheckResult {
    threshold: number;
    reward: number;
    legA: number;
    legB: number;
    legC: number;
    legARequired: number;
    legBRequired: number;
    legCRequired: number;
    passed: boolean;
    alreadyAwarded: boolean;
    newlyAwarded: boolean;
}

export interface MilestoneProcessResult {
    userId: string;
    milestoneResults: MilestoneCheckResult[];
    newlyAwardedCount: number;
    totalRewarded: number;
}

// ---------------------------------------------------------------------------
// Core Helper: Compute total leg volume for a single direct referral
// using $graphLookup to traverse unlimited depth
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Get sorted leg volumes for all direct referrals of a user
// - Uses a single $graphLookup to fetch the entire descendants tree
//   and computes sub-tree volumes in-memory.
// ---------------------------------------------------------------------------

export async function getDirectLegVolumes(userId: string | ObjectId): Promise<LegVolume[]> {
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const db = await getDB();

    const aggregateResult = await db.collection(Collections.USERS).aggregate([
        { $match: { _id: _userId } },
        {
            $graphLookup: {
                from: Collections.USERS,
                startWith: '$_id',
                connectFromField: '_id',
                connectToField: 'referredById',
                as: 'descendants',
                maxDepth: 50,
            }
        },
        {
            $project: {
                'descendants._id': 1,
                'descendants.referredById': 1,
                'descendants.tradePower': 1,
                'descendants.firstName': 1,
                'descendants.telegramUsername': 1,
            }
        }
    ]).toArray();

    if (aggregateResult.length === 0 || !aggregateResult[0].descendants || aggregateResult[0].descendants.length === 0) {
        return [];
    }

    const descendants = aggregateResult[0].descendants as {
        _id: ObjectId;
        referredById?: ObjectId | null;
        tradePower?: number;
        firstName?: string;
        telegramUsername?: string;
    }[];

    const nodeMap = new Map<string, typeof descendants[0]>();
    const childrenMap = new Map<string, string[]>();

    for (const d of descendants) {
        const sid = d._id.toString();
        nodeMap.set(sid, d);
        
        if (d.referredById) {
            const pid = d.referredById.toString();
            if (!childrenMap.has(pid)) {
                childrenMap.set(pid, []);
            }
            childrenMap.get(pid)!.push(sid);
        }
    }

    const memo = new Map<string, number>();
    const getSubTreeSum = (uidStr: string): number => {
        if (memo.has(uidStr)) return memo.get(uidStr)!;
        const node = nodeMap.get(uidStr);
        if (!node) return 0;

        let sum = node.tradePower || 0;
        const children = childrenMap.get(uidStr) || [];
        for (const cid of children) {
            sum += getSubTreeSum(cid);
        }
        memo.set(uidStr, sum);
        return sum;
    };

    const directReferralIds = childrenMap.get(_userId.toString()) || [];
    const legVolumes: LegVolume[] = directReferralIds.map(rid => {
        const ref = nodeMap.get(rid)!;
        const totalLegVolume = getSubTreeSum(rid);
        return {
            userId: rid,
            firstName: ref.firstName || null,
            telegramUsername: ref.telegramUsername || null,
            personalTradePower: ref.tradePower || 0,
            downlineTradePower: Math.max(0, totalLegVolume - (ref.tradePower || 0)),
            totalLegVolume,
        };
    });

    return legVolumes.sort((a, b) => b.totalLegVolume - a.totalLegVolume);
}

// ---------------------------------------------------------------------------
// 40/30/30 Eligibility Check (pure, no DB writes)
// ---------------------------------------------------------------------------

export function check403030(
    threshold: number,
    sortedLegs: LegVolume[]
): { legA: number; legB: number; legC: number; passed: boolean } {
    const legARequired = threshold * MILESTONE_SPLIT.LEG_A_PCT;
    const legBRequired = threshold * MILESTONE_SPLIT.LEG_B_PCT;
    const legCRequired = threshold * MILESTONE_SPLIT.LEG_C_PCT;

    const legA = sortedLegs[0]?.totalLegVolume ?? 0;
    const legB = sortedLegs[1]?.totalLegVolume ?? 0;
    const legC = sortedLegs.slice(2).reduce((sum, l) => sum + l.totalLegVolume, 0);

    const passed = legA >= legARequired && legB >= legBRequired && legC >= legCRequired;

    return { legA, legB, legC, passed };
}

// ---------------------------------------------------------------------------
// Main: Check and award all eligible milestones for one user
// ---------------------------------------------------------------------------

export async function checkAndAwardMilestones(
    userId: string | ObjectId
): Promise<MilestoneProcessResult> {
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const userIdStr = _userId.toString();

    // 1. Get already-awarded milestones (O(1) per check after this)
    const awardedThresholds = await getAwardedMilestoneThresholds(_userId);

    // 2. Compute leg volumes (single pass — reused across all milestone checks)
    const sortedLegs = await getDirectLegVolumes(_userId);

    const milestoneResults: MilestoneCheckResult[] = [];
    let newlyAwardedCount = 0;
    let totalRewarded = 0;

    // 3. Check each milestone independently
    for (const milestone of MILESTONE_BONUSES) {
        const alreadyAwarded = awardedThresholds.has(milestone.threshold);

        const { legA, legB, legC, passed } = check403030(milestone.threshold, sortedLegs);

        const legARequired = milestone.threshold * MILESTONE_SPLIT.LEG_A_PCT;
        const legBRequired = milestone.threshold * MILESTONE_SPLIT.LEG_B_PCT;
        const legCRequired = milestone.threshold * MILESTONE_SPLIT.LEG_C_PCT;

        let newlyAwarded = false;

        if (passed && !alreadyAwarded) {
            // 4. Award: credit referral wallet + create award record (atomic idempotency via unique index)
            const now = new Date();

            const awarded = await createMilestoneAward({
                userId: _userId,
                milestoneThreshold: milestone.threshold,
                rewardAmount: milestone.reward,
                awardedAt: now,
                snapshotLegA: legA,
                snapshotLegB: legB,
                snapshotLegC: legC,
            });

            if (awarded) {
                // Credit the referral wallet with dedicated MILESTONE_BONUS transaction
                await creditReferralWallet(
                    _userId,
                    milestone.reward,
                    `Milestone Reward: ${milestone.threshold.toLocaleString()} USDT threshold`,
                    'MILESTONE_BONUS',
                    awarded._id.toString(),
                    {
                        milestoneThreshold: milestone.threshold,
                        legA: legA.toFixed(2),
                        legB: legB.toFixed(2),
                        legC: legC.toFixed(2),
                    }
                );

                newlyAwarded = true;
                newlyAwardedCount++;
                totalRewarded += milestone.reward;

                // Mark as awarded in our in-memory set so subsequent milestones in this run
                // don't re-check (not needed for correctness but avoids extra DB reads)
                awardedThresholds.add(milestone.threshold);

                console.log(`[milestone] ✅ User ${userIdStr} awarded ${milestone.reward} USDT for ${milestone.threshold} milestone`);
            }
        }

        milestoneResults.push({
            threshold: milestone.threshold,
            reward: milestone.reward,
            legA,
            legB,
            legC,
            legARequired,
            legBRequired,
            legCRequired,
            passed,
            alreadyAwarded,
            newlyAwarded,
        });
    }

    return {
        userId: userIdStr,
        milestoneResults,
        newlyAwardedCount,
        totalRewarded,
    };
}

// ---------------------------------------------------------------------------
// Batch processor: Check all active users (called by the cron)
// - Highly optimized: Runs exactly 2 read queries for the entire database tree
//   and executes downstream volume math in O(N) memory calculations.
// ---------------------------------------------------------------------------

export async function processMilestoneBonusBatch(): Promise<{
    totalUsers: number;
    totalNewAwards: number;
    totalUSDT: number;
    errors: { userId: string; error: string }[];
}> {
    const db = await getDB();

    // 1. Fetch all active users with minimal fields
    const users = await db.collection(Collections.USERS).find(
        { isDeleted: { $ne: true } },
        {
            projection: {
                _id: 1,
                referredById: 1,
                tradePower: 1,
                firstName: 1,
                telegramUsername: 1,
                directReferralCount: 1,
            }
        }
    ).toArray();

    console.log(`[milestone-cron] Found ${users.length} total active users to parse`);

    // 2. Fetch all milestone awards to check alreadyAwarded
    const allAwards = await db.collection(Collections.MILESTONE_AWARDS).find({}).toArray();
    // Build set of userId_threshold strings
    const awardedSet = new Set<string>(
        allAwards.map(a => `${a.userId.toString()}_${a.milestoneThreshold}`)
    );

    // 3. Build maps for in-memory graph traversal
    const nodeMap = new Map<string, typeof users[0]>();
    const childrenMap = new Map<string, string[]>();

    for (const u of users) {
        const sid = u._id.toString();
        nodeMap.set(sid, u);
        if (u.referredById) {
            const pid = u.referredById.toString();
            if (!childrenMap.has(pid)) {
                childrenMap.set(pid, []);
            }
            childrenMap.get(pid)!.push(sid);
        }
    }

    // 4. Memoized sub-tree sum calculation
    const memoSubTreeSum = new Map<string, number>();
    const getSubTreeSum = (uidStr: string): number => {
        if (memoSubTreeSum.has(uidStr)) return memoSubTreeSum.get(uidStr)!;
        const node = nodeMap.get(uidStr);
        if (!node) return 0;

        let sum = node.tradePower || 0;
        const children = childrenMap.get(uidStr) || [];
        for (const cid of children) {
            sum += getSubTreeSum(cid);
        }
        memoSubTreeSum.set(uidStr, sum);
        return sum;
    };

    // Calculate sub-tree sum for everyone
    for (const u of users) {
        getSubTreeSum(u._id.toString());
    }

    let totalNewAwards = 0;
    let totalUSDT = 0;
    const errors: { userId: string; error: string }[] = [];

    // Filter users eligible for milestone checks (directReferralCount > 1)
    const eligibleUsers = users.filter(u => u.directReferralCount > 1);
    console.log(`[milestone-cron] Checking ${eligibleUsers.length} users with at least 2 legs`);

    // 5. Check and award milestones
    for (const u of eligibleUsers) {
        const userIdStr = u._id.toString();
        const directIds = childrenMap.get(userIdStr) || [];
        
        // Calculate sorted legs for this user
        const legVolumes: LegVolume[] = directIds.map(rid => {
            const ref = nodeMap.get(rid)!;
            const totalLegVolume = memoSubTreeSum.get(rid) || 0;
            return {
                userId: rid,
                firstName: ref.firstName || null,
                telegramUsername: ref.telegramUsername || null,
                personalTradePower: ref.tradePower || 0,
                downlineTradePower: Math.max(0, totalLegVolume - (ref.tradePower || 0)),
                totalLegVolume,
            };
        }).sort((a, b) => b.totalLegVolume - a.totalLegVolume);

        for (const milestone of MILESTONE_BONUSES) {
            const alreadyAwarded = awardedSet.has(`${userIdStr}_${milestone.threshold}`);
            if (alreadyAwarded) continue;

            const { legA, legB, legC, passed } = check403030(milestone.threshold, legVolumes);

            if (passed) {
                try {
                    const now = new Date();
                    const awarded = await createMilestoneAward({
                        userId: u._id,
                        milestoneThreshold: milestone.threshold,
                        rewardAmount: milestone.reward,
                        awardedAt: now,
                        snapshotLegA: legA,
                        snapshotLegB: legB,
                        snapshotLegC: legC,
                    });

                    if (awarded) {
                        // Credit the referral wallet
                        await creditReferralWallet(
                            u._id,
                            milestone.reward,
                            `Milestone Bonus: ${milestone.threshold.toLocaleString()} USDT threshold reached`
                        );

                        // Log dedicated MILESTONE_BONUS transaction for audit trail
                        const wallet = await db.collection(Collections.REFERRAL_WALLETS).findOne({ userId: u._id });
                        const balanceAfter = wallet?.balance ?? milestone.reward;

                        const tx: Omit<TransactionDocument, '_id'> = {
                            userId: u._id,
                            type: 'MILESTONE_BONUS',
                            amount: milestone.reward,
                            balanceAfter,
                            description: `Milestone Reward: ${milestone.threshold.toLocaleString()} USDT threshold`,
                            reference: awarded._id.toString(),
                            metadata: {
                                milestoneThreshold: milestone.threshold,
                                legA: legA.toFixed(2),
                                legB: legB.toFixed(2),
                                legC: legC.toFixed(2),
                            },
                            createdAt: now,
                        };

                        await db.collection(Collections.TRANSACTIONS).insertOne(tx as TransactionDocument);

                        totalNewAwards++;
                        totalUSDT += milestone.reward;
                        
                        // Mark in-memory as awarded to prevent double checks
                        awardedSet.add(`${userIdStr}_${milestone.threshold}`);

                        console.log(`[milestone-cron] ✅ User ${userIdStr} awarded ${milestone.reward} USDT for ${milestone.threshold} milestone`);
                    }
                } catch (err) {
                    console.error(`[milestone-cron] Error awarding user ${userIdStr}:`, err);
                    errors.push({ userId: userIdStr, error: String(err) });
                }
            }
        }
    }

    return {
        totalUsers: eligibleUsers.length,
        totalNewAwards,
        totalUSDT,
        errors,
    };
}
