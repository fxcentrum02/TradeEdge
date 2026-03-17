// ===========================================
// WITHDRAWAL REPOSITORY
// ===========================================

import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { Collections } from '../db/collections';
import type { WithdrawalDocument, WithdrawalStatus } from '../db/types';

export async function findWithdrawalById(id: string | ObjectId) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;
    return db.collection<WithdrawalDocument>(Collections.WITHDRAWALS).findOne({ _id });
}

export async function findWithdrawalsByUserId(userId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return db.collection<WithdrawalDocument>(Collections.WITHDRAWALS)
        .find({ userId: _userId })
        .sort({ createdAt: -1 })
        .toArray();
}

export async function findWithdrawalsByStatus(status: WithdrawalStatus, page: number = 1, limit: number = 20) {
    const db = await getDB();
    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
        db.collection<WithdrawalDocument>(Collections.WITHDRAWALS)
            .find({ status })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        db.collection<WithdrawalDocument>(Collections.WITHDRAWALS).countDocuments({ status }),
    ]);

    return {
        items: withdrawals,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
    };
}

export async function findAllWithdrawals(page: number = 1, limit: number = 20) {
    const db = await getDB();
    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
        db.collection<WithdrawalDocument>(Collections.WITHDRAWALS)
            .find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        db.collection<WithdrawalDocument>(Collections.WITHDRAWALS).countDocuments({}),
    ]);

    return {
        items: withdrawals,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
    };
}

export async function createWithdrawal(
    withdrawalData: Omit<WithdrawalDocument, '_id' | 'createdAt' | 'updatedAt'>
) {
    const db = await getDB();
    const now = new Date();

    const withdrawal: Omit<WithdrawalDocument, '_id'> = {
        ...withdrawalData,
        createdAt: now,
        updatedAt: now,
    };

    const result = await db.collection<WithdrawalDocument>(Collections.WITHDRAWALS).insertOne(withdrawal as WithdrawalDocument);
    return db.collection<WithdrawalDocument>(Collections.WITHDRAWALS).findOne({ _id: result.insertedId });
}

export async function updateWithdrawal(id: string | ObjectId, updates: Partial<WithdrawalDocument>) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await db.collection<WithdrawalDocument>(Collections.WITHDRAWALS).findOneAndUpdate(
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

export async function approveWithdrawal(
    id: string | ObjectId,
    processedBy: ObjectId,
    txHash: string,
    adminNote?: string
) {
    return updateWithdrawal(id, {
        status: 'COMPLETED',
        processedBy,
        processedAt: new Date(),
        txHash,
        adminNote,
    });
}

export async function rejectWithdrawal(
    id: string | ObjectId,
    processedBy: ObjectId,
    adminNote: string
) {
    return updateWithdrawal(id, {
        status: 'REJECTED',
        processedBy,
        processedAt: new Date(),
        adminNote,
    });
}

export async function countPendingWithdrawals() {
    const db = await getDB();
    return db.collection<WithdrawalDocument>(Collections.WITHDRAWALS).countDocuments({
        status: 'PENDING',
    });
}
