// ===========================================
// USER REPOSITORY
// ===========================================

import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { Collections } from '../db/collections';
import type { UserDocument } from '../db/types';

export async function findUserById(id: string | ObjectId) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;
    return db.collection<UserDocument>(Collections.USERS).findOne({ _id });
}

export async function findUserByTelegramId(telegramId: string) {
    const db = await getDB();
    return db.collection<UserDocument>(Collections.USERS).findOne({ telegramId });
}

export async function findUserByReferralCode(referralCode: string) {
    const db = await getDB();
    return db.collection<UserDocument>(Collections.USERS).findOne({ referralCode });
}

export async function createUser(userData: Omit<UserDocument, '_id' | 'createdAt' | 'updatedAt'>) {
    const db = await getDB();
    const now = new Date();

    const user: Omit<UserDocument, '_id'> = {
        ...userData,
        createdAt: now,
        updatedAt: now,
    };

    const result = await db.collection<UserDocument>(Collections.USERS).insertOne(user as UserDocument);
    return db.collection<UserDocument>(Collections.USERS).findOne({ _id: result.insertedId });
}

export async function updateUser(id: string | ObjectId, updates: Partial<UserDocument>) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;

    // Safeguard: Never allow overriding referredById if it's already set in the database
    if (updates.referredById) {
        const currentUser = await findUserById(id);
        if (currentUser?.referredById) {
            delete updates.referredById;
        }
    }

    const result = await db.collection<UserDocument>(Collections.USERS).findOneAndUpdate(
        { _id },
        {
            $set: {
                ...updates,
                updatedAt: new Date()
            }
        },
        { returnDocument: 'after' }
    );

    return result;
}

export async function updateUserStats(
    userId: string | ObjectId,
    stats: {
        directReferralCount?: number;
        totalReferralCount?: number;
        totalEarnings?: number;
        tradePower?: number;
    }
) {
    const db = await getDB();
    const _id = typeof userId === 'string' ? new ObjectId(userId) : userId;

    await db.collection<UserDocument>(Collections.USERS).updateOne(
        { _id },
        { $set: { ...stats, updatedAt: new Date() } }
    );
}

export async function countDirectReferrals(userId: string | ObjectId) {
    const db = await getDB();
    const _id = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return db.collection<UserDocument>(Collections.USERS).countDocuments({
        referredById: _id,
    });
}

export async function findDirectReferrals(userId: string | ObjectId) {
    const db = await getDB();
    const _id = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return db.collection<UserDocument>(Collections.USERS)
        .find({ referredById: _id })
        .sort({ createdAt: -1 })
        .toArray();
}

/**
 * Count users at each referral tier (1-20) by walking the referral chain.
 * Returns an array of { tier, userIds } for each level.
 */
export async function getReferralTreeByTier(
    userId: string | ObjectId,
    maxTier: number = 20
): Promise<{ tier: number; userIds: ObjectId[] }[]> {
    const db = await getDB();
    const usersCol = db.collection<UserDocument>(Collections.USERS);
    const result: { tier: number; userIds: ObjectId[] }[] = [];

    // Start with the root user's direct referrals
    let currentParentIds: ObjectId[] = [typeof userId === 'string' ? new ObjectId(userId) : userId];

    for (let tier = 1; tier <= maxTier; tier++) {
        if (currentParentIds.length === 0) break;

        const usersAtTier = await usersCol
            .find({ referredById: { $in: currentParentIds } })
            .project({ _id: 1 })
            .toArray();

        const userIds = usersAtTier.map(u => u._id);
        result.push({ tier, userIds });

        // Next tier's parents are this tier's users
        currentParentIds = userIds;
    }

    return result;
}

/**
 * Get global hierarchy statistics for the platform (Counts and TP at each level).
 * Walks up to 20 tiers deep from all root users (those without a referrer).
 */
export async function getGlobalHierarchyStats(maxTier: number = 20) {
    const db = await getDB();
    const usersCol = db.collection<UserDocument>(Collections.USERS);
    const stats: { tier: number; count: number; totalTradePower: number }[] = [];

    // Level 0: Root users (not counted as a tier usually, but they are the parents)
    // The request mentions "from admin to all levels", so Tier 1 are direct referrals of someone.
    // We want to know how many users are at Tier 1, Tier 2... Tier 10 across the Whole system.

    // Tier 1 users are those who have referredById = SOMEONE
    // Tier 2 users are those who have referredById = SOMEONE_WHO_HAS_REFERRED_BY_ID = SOMEONE

    let currentParentIds: ObjectId[] = [];
    // Get all root users (those with no referrer)
    const roots = await usersCol.find({
        $or: [
            { referredById: { $exists: false } },
            { referredById: null }
        ]
    }).project({ _id: 1 }).toArray();
    currentParentIds = roots.map(u => u._id);

    for (let tier = 1; tier <= maxTier; tier++) {
        if (currentParentIds.length === 0) break;

        const usersAtTier = await usersCol
            .aggregate([
                { $match: { referredById: { $in: currentParentIds } } },
                {
                    $group: {
                        _id: null,
                        count: { $sum: 1 },
                        totalTradePower: { $sum: '$tradePower' },
                        userIds: { $push: '$_id' }
                    }
                }
            ])
            .toArray();

        if (usersAtTier.length === 0) {
            stats.push({ tier, count: 0, totalTradePower: 0 });
            currentParentIds = [];
        } else {
            const data = usersAtTier[0];
            stats.push({
                tier,
                count: data.count,
                totalTradePower: data.totalTradePower || 0
            });
            currentParentIds = data.userIds;
        }
    }

    return stats;
}

/**
 * Perform a recursive count of all descendants (downline) across all levels.
 * Uses MongoDB $graphLookup for efficiency.
 */
export async function countAllDescendants(userId: ObjectId): Promise<number> {
    const db = await getDB();
    const result = await db.collection(Collections.USERS).aggregate([
        { $match: { _id: userId } },
        {
            $graphLookup: {
                from: Collections.USERS,
                startWith: '$_id',
                connectFromField: '_id',
                connectToField: 'referredById',
                as: 'descendants',
                // depthField: 'depth' // optional
            }
        },
        {
            $project: {
                count: { $size: '$descendants' }
            }
        }
    ]).toArray();

    return result.length > 0 ? result[0].count : 0;
}

/**
 * Builds a nested tree of descendants for a specific user.
 */
export async function getDescendantsTree(
    userId: string | ObjectId,
    maxDepth: number = 3
): Promise<any[]> {
    const db = await getDB();
    const usersCol = db.collection<UserDocument>(Collections.USERS);
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    if (maxDepth <= 0) return [];

    const descendants = await usersCol
        .find({ referredById: _userId })
        .sort({ tradePower: -1 })
        .toArray();

    const tree = await Promise.all(
        descendants.map(async (user) => {
            return {
                id: user._id.toString(),
                telegramId: user.telegramId,
                telegramUsername: user.telegramUsername,
                firstName: user.firstName,
                lastName: user.lastName,
                photoUrl: user.photoUrl || null,
                tradePower: user.tradePower || 0,
                directReferralCount: user.directReferralCount || 0,
                totalReferralCount: user.totalReferralCount || 0,
                joinedAt: user.createdAt.toISOString(),
                children: await getDescendantsTree(user._id, maxDepth - 1)
            };
        })
    );

    return tree;
}
