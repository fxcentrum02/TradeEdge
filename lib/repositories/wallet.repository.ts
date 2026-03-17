// ===========================================
// WALLET REPOSITORY
// ===========================================

import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { Collections } from '../db/collections';
import type { WalletDocument, TransactionDocument, TransactionType } from '../db/types';

export async function findWalletByUserId(userId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return db.collection<WalletDocument>(Collections.WALLETS).findOne({ userId: _userId });
}

export async function createWallet(userId: string | ObjectId, initialBalance: number = 0) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const now = new Date();

    const wallet: Omit<WalletDocument, '_id'> = {
        userId: _userId,
        balance: initialBalance,
        createdAt: now,
        updatedAt: now,
    };

    const result = await db.collection<WalletDocument>(Collections.WALLETS).insertOne(wallet as WalletDocument);
    return db.collection<WalletDocument>(Collections.WALLETS).findOne({ _id: result.insertedId });
}

export async function getOrCreateWallet(userId: string | ObjectId) {
    let wallet = await findWalletByUserId(userId);

    if (!wallet) {
        wallet = await createWallet(userId);
    }

    return wallet;
}

export async function creditWallet(
    userId: string | ObjectId,
    amount: number,
    type: TransactionType,
    description?: string,
    reference?: string
): Promise<{ success: boolean; newBalance: number }> {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Atomic update: increment balance and update updatedAt
    const result = await db.collection<WalletDocument>(Collections.WALLETS).findOneAndUpdate(
        { userId: _userId },
        {
            $inc: { balance: amount },
            $set: { updatedAt: new Date() }
        },
        { upsert: true, returnDocument: 'after' }
    );

    const newBalance = result?.balance ?? amount;

    // Create transaction record
    const transaction: Omit<TransactionDocument, '_id'> = {
        userId: _userId,
        type,
        amount,
        balanceAfter: newBalance,
        description,
        reference,
        createdAt: new Date(),
    };

    await db.collection<TransactionDocument>(Collections.TRANSACTIONS).insertOne(transaction as TransactionDocument);

    return { success: true, newBalance };
}

export async function debitWallet(
    userId: string | ObjectId,
    amount: number,
    type: TransactionType,
    description?: string,
    reference?: string
): Promise<{ success: boolean; newBalance: number; error?: string }> {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Atomic update: decrement only if balance >= amount
    const result = await db.collection<WalletDocument>(Collections.WALLETS).findOneAndUpdate(
        { userId: _userId, balance: { $gte: amount } },
        {
            $inc: { balance: -amount },
            $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
    );

    if (!result) {
        // Find current balance for error response
        const wallet = await findWalletByUserId(_userId);
        return { 
            success: false, 
            newBalance: wallet?.balance ?? 0, 
            error: wallet ? 'Insufficient balance' : 'Wallet not found' 
        };
    }

    const newBalance = result.balance;

    // Create transaction record
    const transaction: Omit<TransactionDocument, '_id'> = {
        userId: _userId,
        type,
        amount: -amount,
        balanceAfter: newBalance,
        description,
        reference,
        createdAt: new Date(),
    };

    await db.collection<TransactionDocument>(Collections.TRANSACTIONS).insertOne(transaction as TransactionDocument);

    return { success: true, newBalance };
}

export async function logTransaction(
    userId: string | ObjectId,
    type: TransactionType,
    amount: number,
    description?: string,
    reference?: string
): Promise<{ success: boolean; balanceAfter: number }> {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const wallet = await findWalletByUserId(_userId);
    const balanceAfter = wallet?.balance ?? 0;

    // Create transaction record
    const transaction: Omit<TransactionDocument, '_id'> = {
        userId: _userId,
        type,
        amount,
        balanceAfter,
        description,
        reference,
        createdAt: new Date(),
    };

    await db.collection<TransactionDocument>(Collections.TRANSACTIONS).insertOne(transaction as TransactionDocument);

    return { success: true, balanceAfter };
}

export async function getTransactionHistory(
    userId: string | ObjectId,
    page: number = 1,
    limit: number = 20
) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
        db.collection<TransactionDocument>(Collections.TRANSACTIONS)
            .find({ userId: _userId })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        db.collection<TransactionDocument>(Collections.TRANSACTIONS).countDocuments({ userId: _userId }),
    ]);

    return {
        items: transactions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
    };
}
