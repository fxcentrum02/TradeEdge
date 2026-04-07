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

async function getLegVolume(referralUserId: ObjectId): Promise<number> {
    const db = await getDB();

    const result = await db.collection(Collections.USERS).aggregate([
        { $match: { _id: referralUserId } },
        {
            $graphLookup: {
                from: Collections.USERS,
                startWith: '$_id',
                connectFromField: '_id',
                connectToField: 'referredById',
                as: 'descendants',
                maxDepth: 50,       // safety cap — unlimited practical depth
                depthField: 'depth',
            }
        },
        {
            $project: {
                _id: 1,
                tradePower: 1,
                downlinePower: {
                    $reduce: {
                        input: '$descendants',
                        initialValue: 0,
                        in: { $add: ['$$value', { $ifNull: ['$$this.tradePower', 0] }] }
                    }
                }
            }
        }
    ]).toArray();

    if (!result.length) return 0;

    const personal = result[0].tradePower || 0;
    const downline = result[0].downlinePower || 0;
    return personal + downline;
}

// ---------------------------------------------------------------------------
// Get sorted leg volumes for all direct referrals of a user
// ---------------------------------------------------------------------------

export async function getDirectLegVolumes(userId: string | ObjectId): Promise<LegVolume[]> {
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const directReferrals = await findDirectReferrals(_userId);
    if (directReferrals.length === 0) return [];

    const legVolumes: LegVolume[] = await Promise.all(
        directReferrals.map(async (ref) => {
            const totalLegVolume = await getLegVolume(ref._id);
            return {
                userId: ref._id.toString(),
                firstName: ref.firstName || null,
                telegramUsername: ref.telegramUsername || null,
                personalTradePower: ref.tradePower || 0,
                downlineTradePower: Math.max(0, totalLegVolume - (ref.tradePower || 0)),
                totalLegVolume,
            };
        })
    );

    // Sort descending by total leg volume
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
                // Credit the referral wallet
                await creditReferralWallet(
                    _userId,
                    milestone.reward,
                    `Milestone Bonus: ${milestone.threshold.toLocaleString()} USDT threshold reached`
                );

                // Log dedicated MILESTONE_BONUS transaction for audit trail
                const db = await getDB();
                const wallet = await db.collection(Collections.REFERRAL_WALLETS).findOne({ userId: _userId });
                const balanceAfter = wallet?.balance ?? milestone.reward;

                const tx: Omit<TransactionDocument, '_id'> = {
                    userId: _userId,
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
// ---------------------------------------------------------------------------

export async function processMilestoneBonusBatch(): Promise<{
    totalUsers: number;
    totalNewAwards: number;
    totalUSDT: number;
    errors: { userId: string; error: string }[];
}> {
    const db = await getDB();

    // Fetch all non-deleted active users who have at least one direct referral
    // We filter by directReferralCount > 0 to skip users who can never pass the 40/30/30
    const users = await db.collection(Collections.USERS)
        .find({
            isDeleted: { $ne: true },
            directReferralCount: { $gt: 1 },  // need at least 2 legs for a valid 40/30/30 (A + B minimum)
        })
        .project({ _id: 1 })
        .toArray();

    console.log(`[milestone-cron] Found ${users.length} eligible users to check`);

    let totalNewAwards = 0;
    let totalUSDT = 0;
    const errors: { userId: string; error: string }[] = [];

    // Process in chunks of 20 to avoid overwhelming DB connections
    const CHUNK_SIZE = 20;
    for (let i = 0; i < users.length; i += CHUNK_SIZE) {
        const chunk = users.slice(i, i + CHUNK_SIZE);

        const results = await Promise.allSettled(
            chunk.map(user => checkAndAwardMilestones(user._id))
        );

        results.forEach((result, idx) => {
            const userId = chunk[idx]._id.toString();
            if (result.status === 'fulfilled') {
                totalNewAwards += result.value.newlyAwardedCount;
                totalUSDT += result.value.totalRewarded;
            } else {
                console.error(`[milestone-cron] Error for user ${userId}:`, result.reason);
                errors.push({ userId, error: String(result.reason) });
            }
        });

        console.log(`[milestone-cron] Processed chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(users.length / CHUNK_SIZE)}`);
    }

    return {
        totalUsers: users.length,
        totalNewAwards,
        totalUSDT,
        errors,
    };
}
