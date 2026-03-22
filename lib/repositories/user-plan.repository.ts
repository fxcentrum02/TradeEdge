// ===========================================
// USER PLAN REPOSITORY
// ===========================================

import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { Collections } from '../db/collections';
import type { UserPlanDocument } from '../db/types';

export async function findUserPlanById(id: string | ObjectId) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;
    return db.collection<UserPlanDocument>(Collections.USER_PLANS).findOne({ _id });
}

export async function findUserPlansByUserId(userId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return db.collection<UserPlanDocument>(Collections.USER_PLANS)
        .find({ userId: _userId })
        .sort({ createdAt: -1 })
        .toArray();
}

export async function findActiveUserPlans(userId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const now = new Date();

    return db.collection<UserPlanDocument>(Collections.USER_PLANS)
        .find({
            userId: _userId,
            isActive: true,
            isDeleted: { $ne: true },
            endDate: { $gt: now }
        })
        .toArray();
}

export async function findAllActivePlans() {
    const db = await getDB();
    const now = new Date();

    return db.collection<UserPlanDocument>(Collections.USER_PLANS)
        .find({
            isActive: true,
            isDeleted: { $ne: true },
            endDate: { $gt: now },
        })
        .toArray();
}

export async function findPlansEligibleForRoi() {
    const db = await getDB();
    const now = new Date();
    
    // Shift the current time by 4 hours 30 minutes backwards
    // so that 04:30 UTC essentially becomes 00:00 UTC of the "settlement day"
    const shifted = new Date(now.getTime() - (4 * 60 + 30) * 60 * 1000);
    // Get the start of this nominal "settlement day" at 00:00 UTC
    const todaySettlementStart = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
    
    // The actual real-world time that this settlement cycle started (04:30 UTC today)
    // We use this to compare against lastRoiDate in the database because 
    // lastRoiDate maps to the real-world time the claim was made
    const currentSettlementThreshold = new Date(todaySettlementStart.getTime() + (4 * 60 + 30) * 60 * 1000);

    return db.collection<UserPlanDocument>(Collections.USER_PLANS)
        .find({
            isActive: true,
            isDeleted: { $ne: true },
            endDate: { $gt: now },
            $or: [
                { lastRoiDate: { $exists: false } },
                { lastRoiDate: { $lt: currentSettlementThreshold } },
            ],
        })
        .toArray();
}

export async function createUserPlan(planData: Omit<UserPlanDocument, '_id' | 'createdAt' | 'updatedAt'>) {
    const db = await getDB();
    const now = new Date();

    const userPlan: Omit<UserPlanDocument, '_id'> = {
        ...planData,
        createdAt: now,
        updatedAt: now,
    };

    const result = await db.collection<UserPlanDocument>(Collections.USER_PLANS).insertOne(userPlan as UserPlanDocument);
    return db.collection<UserPlanDocument>(Collections.USER_PLANS).findOne({ _id: result.insertedId });
}

export async function updateUserPlan(id: string | ObjectId, updates: Partial<UserPlanDocument>) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await db.collection<UserPlanDocument>(Collections.USER_PLANS).findOneAndUpdate(
        { _id },
        {
            $set: {
                ...updates,
                updatedAt: new Date(),
            },
        },
        { returnDocument: 'after' }
    );

    return result;
}

export async function deactivateUserPlan(id: string | ObjectId) {
    return updateUserPlan(id, { isActive: false });
}

export async function updateRoiPaid(id: string | ObjectId, amount: number) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;
    const now = new Date();

    await db.collection<UserPlanDocument>(Collections.USER_PLANS).updateOne(
        { _id },
        {
            $inc: { totalRoiPaid: amount },
            $set: { lastRoiDate: now, updatedAt: now },
        }
    );
}

/**
 * Atomically marks a plan as processed for today.
 * Returns the document if it was successfully claimed, otherwise null.
 */
export async function atomicClaimRoi(id: string | ObjectId, today: Date) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;
    const now = new Date();

    return db.collection<UserPlanDocument>(Collections.USER_PLANS).findOneAndUpdate(
        { 
            _id, 
            isActive: true,
            $or: [
                { lastRoiDate: { $exists: false } },
                { lastRoiDate: { $lt: today } }
            ]
        },
        {
            $set: { lastRoiDate: now, updatedAt: now }
        },
        { returnDocument: 'after' }
    );
}

/**
 * Just increments the totalRoiPaid without touching lastRoiDate.
 */
export async function incrementRoiPaid(id: string | ObjectId, amount: number) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;

    await db.collection<UserPlanDocument>(Collections.USER_PLANS).updateOne(
        { _id },
        {
            $inc: { totalRoiPaid: amount },
            $set: { updatedAt: new Date() },
        }
    );
}

export async function countActivePlansByUserId(userId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const now = new Date();

    return db.collection<UserPlanDocument>(Collections.USER_PLANS).countDocuments({
        userId: _userId,
        isActive: true,
        endDate: { $gt: now },
    });
}

export async function getTotalInvestedAmount(userId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await db.collection<UserPlanDocument>(Collections.USER_PLANS)
        .aggregate([
            { $match: { userId: _userId } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .toArray();

    return result.length > 0 ? result[0].total : 0;
}

export async function getTotalActiveAmount(userId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const now = new Date();

    const result = await db.collection<UserPlanDocument>(Collections.USER_PLANS)
        .aggregate([
            {
                $match: {
                    userId: _userId,
                    isActive: true,
                    endDate: { $gt: now }
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .toArray();

    return result.length > 0 ? result[0].total : 0;
}
