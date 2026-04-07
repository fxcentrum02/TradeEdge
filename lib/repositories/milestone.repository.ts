// ===========================================
// MILESTONE AWARD REPOSITORY
// ===========================================

import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { Collections } from '../db/collections';
import type { MilestoneAwardDocument } from '../db/types';

/**
 * Find all milestone awards granted to a user, sorted ascending by threshold.
 */
export async function findAwardedMilestones(userId: string | ObjectId): Promise<MilestoneAwardDocument[]> {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return db.collection<MilestoneAwardDocument>(Collections.MILESTONE_AWARDS)
        .find({ userId: _userId })
        .sort({ milestoneThreshold: 1 })
        .toArray();
}

/**
 * Get a Set of thresholds already awarded to a user (fast O(1) lookup).
 */
export async function getAwardedMilestoneThresholds(userId: string | ObjectId): Promise<Set<number>> {
    const awards = await findAwardedMilestones(userId);
    return new Set(awards.map(a => a.milestoneThreshold));
}

/**
 * Create a new milestone award record.
 * 
 * The unique index on (userId, milestoneThreshold) ensures idempotency:
 * if the cron runs twice in one day a duplicate key error will be thrown
 * and caught by the caller — no double award occurs.
 * 
 * @returns The inserted document, or null if already exists (duplicate).
 */
export async function createMilestoneAward(
    data: Omit<MilestoneAwardDocument, '_id'>
): Promise<MilestoneAwardDocument | null> {
    const db = await getDB();

    try {
        const result = await db.collection<MilestoneAwardDocument>(Collections.MILESTONE_AWARDS)
            .insertOne(data as MilestoneAwardDocument);

        return db.collection<MilestoneAwardDocument>(Collections.MILESTONE_AWARDS)
            .findOne({ _id: result.insertedId });
    } catch (error: any) {
        // Duplicate key error code 11000 → milestone already awarded
        if (error?.code === 11000) {
            return null;
        }
        throw error;
    }
}

/**
 * Count total milestone awards across the entire platform (for admin dashboards).
 */
export async function countTotalMilestoneAwards(): Promise<number> {
    const db = await getDB();
    return db.collection(Collections.MILESTONE_AWARDS).countDocuments();
}

/**
 * Get total USDT distributed via milestone bonuses (for admin analytics).
 */
export async function getTotalMilestoneRewardsDistributed(): Promise<number> {
    const db = await getDB();
    const result = await db.collection<MilestoneAwardDocument>(Collections.MILESTONE_AWARDS)
        .aggregate([
            { $group: { _id: null, total: { $sum: '$rewardAmount' } } }
        ])
        .toArray();
    return result.length > 0 ? result[0].total : 0;
}
