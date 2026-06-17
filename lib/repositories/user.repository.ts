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
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Initialize result with empty arrays for all tiers up to maxTier
    const result: { tier: number; userIds: ObjectId[] }[] = [];
    for (let tier = 1; tier <= maxTier; tier++) {
        result.push({ tier, userIds: [] });
    }

    const aggResult = await usersCol.aggregate([
        { $match: { _id: _userId } },
        {
            $graphLookup: {
                from: Collections.USERS,
                startWith: '$_id',
                connectFromField: '_id',
                connectToField: 'referredById',
                maxDepth: maxTier - 1,
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

    if (aggResult.length > 0 && aggResult[0].descendants) {
        const descendants = aggResult[0].descendants as { _id: ObjectId; depth: number }[];
        for (const desc of descendants) {
            const tier = desc.depth + 1;
            if (tier >= 1 && tier <= maxTier) {
                result[tier - 1].userIds.push(desc._id);
            }
        }
    }

    return result;
}

/**
 * Get global hierarchy statistics for the platform (Counts and TP at each level).
 * Walks up to 20 tiers deep from all root users (those without a referrer).
 * Optimized to run in a single find projection query and execute level calculations in-memory.
 */
export async function getGlobalHierarchyStats(maxTier: number = 20) {
    const db = await getDB();
    const usersCol = db.collection<UserDocument>(Collections.USERS);

    // 1. Fetch all non-deleted users with just their referredById and tradePower
    const users = await usersCol.find(
        { isDeleted: { $ne: true } },
        { projection: { _id: 1, referredById: 1, tradePower: 1 } }
    ).toArray();

    // 2. Build map of user ID -> user details
    const userMap = new Map<string, { referredById?: ObjectId | null; tradePower: number; tier?: number }>();
    for (const u of users) {
        userMap.set(u._id.toString(), { referredById: u.referredById, tradePower: u.tradePower || 0 });
    }

    // 3. Recursive tier calculation helper
    const getTier = (uid: string): number => {
        const u = userMap.get(uid);
        if (!u) return -1;
        if (u.tier !== undefined) return u.tier;

        if (!u.referredById) {
            u.tier = 0; // Root user
            return 0;
        }

        const parentTier = getTier(u.referredById.toString());
        if (parentTier === -1) {
            u.tier = 0; // Treat as root
        } else {
            u.tier = parentTier + 1;
        }
        return u.tier;
    };

    // Calculate tier for every user
    for (const uid of userMap.keys()) {
        getTier(uid);
    }

    // 4. Group by tier in memory
    const tierStatsMap = new Map<number, { count: number; totalTradePower: number }>();
    for (let i = 1; i <= maxTier; i++) {
        tierStatsMap.set(i, { count: 0, totalTradePower: 0 });
    }

    for (const u of userMap.values()) {
        if (u.tier !== undefined && u.tier >= 1 && u.tier <= maxTier) {
            const stats = tierStatsMap.get(u.tier)!;
            stats.count++;
            stats.totalTradePower += u.tradePower;
        }
    }

    return Array.from(tierStatsMap.entries()).map(([tier, data]) => ({
        tier,
        count: data.count,
        totalTradePower: data.totalTradePower
    }));
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

export async function getDescendantsTree(
    userId: string | ObjectId,
    maxDepth: number = 3
): Promise<any[]> {
    const db = await getDB();
    const usersCol = db.collection<UserDocument>(Collections.USERS);
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    if (maxDepth <= 0) return [];

    // 1. Fetch all descendants up to maxDepth - 1 using graphLookup
    const aggregateResult = await usersCol.aggregate([
        { $match: { _id: _userId } },
        {
            $graphLookup: {
                from: Collections.USERS,
                startWith: '$_id',
                connectFromField: '_id',
                connectToField: 'referredById',
                as: 'descendants',
                maxDepth: maxDepth - 1,
                depthField: 'depth'
            }
        }
    ]).toArray();

    if (aggregateResult.length === 0) return [];

    const descendants: any[] = aggregateResult[0].descendants || [];
    
    // 2. Build a map of parentId -> children array
    const parentToChildrenMap = new Map<string, any[]>();
    for (const d of descendants) {
        const pid = d.referredById ? d.referredById.toString() : '';
        if (!parentToChildrenMap.has(pid)) {
            parentToChildrenMap.set(pid, []);
        }
        parentToChildrenMap.get(pid)!.push(d);
    }

    // Sort each children list by tradePower descending to keep consistent UI
    for (const [pid, list] of parentToChildrenMap.entries()) {
        list.sort((a, b) => (b.tradePower || 0) - (a.tradePower || 0));
    }

    // 3. Helper function to build the tree recursively from the memory map
    const buildNodeTree = (parentId: string, currentDepth: number): any[] => {
        if (currentDepth >= maxDepth) return [];
        const children = parentToChildrenMap.get(parentId) || [];
        return children.map(user => ({
            id: user._id.toString(),
            telegramId: user.telegramId,
            telegramUsername: user.telegramUsername || null,
            firstName: user.firstName || null,
            lastName: user.lastName || null,
            photoUrl: user.photoUrl || null,
            tradePower: user.tradePower || 0,
            directReferralCount: user.directReferralCount || 0,
            totalReferralCount: user.totalReferralCount || 0,
            joinedAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : new Date(user.createdAt).toISOString(),
            children: buildNodeTree(user._id.toString(), currentDepth + 1)
        }));
    };

    return buildNodeTree(_userId.toString(), 0);
}
