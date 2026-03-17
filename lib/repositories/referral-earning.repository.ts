// ===========================================
// REFERRAL EARNING REPOSITORY
// ===========================================

import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { Collections } from '../db/collections';
import type { ReferralEarningDocument } from '../db/types';

export async function createReferralEarning(
    earningData: Omit<ReferralEarningDocument, '_id' | 'createdAt'>
) {
    const db = await getDB();

    const earning: Omit<ReferralEarningDocument, '_id'> = {
        ...earningData,
        isFirstPurchaseBonus: earningData.isFirstPurchaseBonus ?? false,
        createdAt: new Date(),
    };

    const result = await db.collection<ReferralEarningDocument>(Collections.REFERRAL_EARNINGS).insertOne(earning as ReferralEarningDocument);
    return db.collection<ReferralEarningDocument>(Collections.REFERRAL_EARNINGS).findOne({ _id: result.insertedId });
}

export async function findReferralEarningsByUserId(userId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return db.collection<ReferralEarningDocument>(Collections.REFERRAL_EARNINGS)
        .find({ userId: _userId })
        .sort({ createdAt: -1 })
        .toArray();
}

export async function getReferralEarningsByTier(userId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await db.collection<ReferralEarningDocument>(Collections.REFERRAL_EARNINGS)
        .aggregate([
            { $match: { userId: _userId } },
            {
                $group: {
                    _id: { tier: '$tier', fromUserId: '$fromUserId' },
                    totalAmount: { $sum: '$amount' },
                },
            },
            {
                $group: {
                    _id: '$_id.tier',
                    userCount: { $sum: 1 },
                    totalEarnings: { $sum: '$totalAmount' },
                    users: { $push: '$_id.fromUserId' },
                },
            },
            { $sort: { _id: 1 } },
        ])
        .toArray();

    return result;
}

export async function getTotalReferralEarnings(userId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await db.collection<ReferralEarningDocument>(Collections.REFERRAL_EARNINGS)
        .aggregate([
            { $match: { userId: _userId } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .toArray();

    return result.length > 0 ? result[0].total : 0;
}

/**
 * Get total earnings a specific referred user (fromUserId) generated for a referrer (userId).
 */
export async function getEarningsFromUser(userId: string | ObjectId, fromUserId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const _fromUserId = typeof fromUserId === 'string' ? new ObjectId(fromUserId) : fromUserId;

    const result = await db.collection<ReferralEarningDocument>(Collections.REFERRAL_EARNINGS)
        .aggregate([
            { $match: { userId: _userId, fromUserId: _fromUserId } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .toArray();

    return result.length > 0 ? result[0].total : 0;
}

/**
 * Get referral earnings aggregated by tier within a specific date range.
 */
export async function getReferralEarningsByTierAndDateRange(
    userId: string | ObjectId,
    startDate: Date,
    endDate: Date
) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await db.collection<ReferralEarningDocument>(Collections.REFERRAL_EARNINGS)
        .aggregate([
            {
                $match: {
                    userId: _userId,
                    createdAt: {
                        $gte: startDate,
                        $lte: endDate
                    }
                }
            },
            {
                $group: {
                    _id: '$tier',
                    totalEarnings: { $sum: '$amount' },
                    userCount: { $addToSet: '$fromUserId' }
                }
            },
            {
                $project: {
                    tier: '$_id',
                    totalEarnings: 1,
                    userCount: { $size: '$userCount' },
                    _id: 0
                }
            },
            { $sort: { tier: 1 } }
        ])
        .toArray();

    return result;
}
