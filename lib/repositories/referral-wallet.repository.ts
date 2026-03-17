// ===========================================
// REFERRAL WALLET REPOSITORY
// ===========================================

import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { Collections } from '../db/collections';
import type { ReferralWalletDocument, TransactionDocument } from '../db/types';
import { creditWallet } from './wallet.repository';

import { REFERRAL_COMMISSIONS } from '../constants';
import { getSettings } from './settings.repository';
import { getTotalActiveAmount } from './user-plan.repository';

const MIN_TRANSFER_AMOUNT = REFERRAL_COMMISSIONS.MIN_CLAIM_AMOUNT;
const TOLERANCE = 0.001; // For floating point precision

export async function findReferralWalletByUserId(userId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    return db.collection<ReferralWalletDocument>(Collections.REFERRAL_WALLETS).findOne({ userId: _userId });
}

export async function getOrCreateReferralWallet(userId: string | ObjectId) {
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;
    let wallet = await findReferralWalletByUserId(_userId);

    if (!wallet) {
        const db = await getDB();
        const now = new Date();

        const doc: Omit<ReferralWalletDocument, '_id'> = {
            userId: _userId,
            balance: 0,
            createdAt: now,
            updatedAt: now,
        };

        const result = await db.collection<ReferralWalletDocument>(Collections.REFERRAL_WALLETS)
            .insertOne(doc as ReferralWalletDocument);
        wallet = await db.collection<ReferralWalletDocument>(Collections.REFERRAL_WALLETS)
            .findOne({ _id: result.insertedId });
    }

    return wallet;
}

/**
 * Credit the referral wallet (when a referral commission is earned)
 */
export async function creditReferralWallet(
    userId: string | ObjectId,
    amount: number,
    description?: string
): Promise<{ success: boolean; newBalance: number }> {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // Use findOneAndUpdate with $inc for atomicity (vulnerable read-modify-write removed)
    const result = await db.collection<ReferralWalletDocument>(Collections.REFERRAL_WALLETS).findOneAndUpdate(
        { userId: _userId },
        {
            $inc: { balance: amount },
            $set: { updatedAt: new Date() }
        },
        { upsert: true, returnDocument: 'after' }
    );

    const newBalance = result?.balance ?? amount;

    // Log transaction (in main transactions collection for audit trail)
    const transaction: Omit<TransactionDocument, '_id'> = {
        userId: _userId,
        type: 'REFERRAL_EARNING',
        amount,
        balanceAfter: newBalance,
        description: description || 'Referral commission',
        metadata: { wallet: 'referral' },
        createdAt: new Date(),
    };

    await db.collection<TransactionDocument>(Collections.TRANSACTIONS)
        .insertOne(transaction as TransactionDocument);

    return { success: true, newBalance };
}

/**
 * Get the total amount a user has ever transferred from referral wallet to main wallet.
 */
export async function getTotalReferralClaimed(userId: string | ObjectId): Promise<number> {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const result = await db.collection<TransactionDocument>(Collections.TRANSACTIONS).aggregate([
        { $match: { userId: _userId, type: 'REFERRAL_TRANSFER' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();

    return result.length > 0 ? result[0].total : 0;
}

export async function transferToMainWallet(
    userId: string | ObjectId,
    requestedAmount?: number
): Promise<{ success: boolean; transferred: number; error?: string }> {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    // 1. Fetch current settings and user's wallet
    const [settings, refWallet] = await Promise.all([
        getSettings(),
        findReferralWalletByUserId(_userId)
    ]);

    if (!refWallet) {
        return { success: false, transferred: 0, error: 'Referral wallet not found' };
    }

    const currentBalance = refWallet.balance;

    if (currentBalance < (MIN_TRANSFER_AMOUNT - TOLERANCE)) {
        return {
            success: false,
            transferred: 0,
            error: `Minimum transfer amount is ${MIN_TRANSFER_AMOUNT} USDT. Current balance: ${currentBalance.toFixed(2)} USDT`
        };
    }

    // 2. Fetch User's total active Trade Power (Mining + Compounding)
    // Both are included in user-plan repository according to user requirement "ongoing tp in his account"
    const totalActiveTP = await getTotalActiveAmount(_userId);

    // 3. Fetch total already claimed
    const totalClaimed = await getTotalReferralClaimed(_userId);

    // 4. Calculate current claimable limit
    const multiplier = settings.referralClaimMultiplier || 1;
    const maxAllowedLifetime = totalActiveTP * multiplier;
    let currentlyAvailableToClaim = maxAllowedLifetime - totalClaimed;

    // Ensure it's not negative
    currentlyAvailableToClaim = Math.max(0, currentlyAvailableToClaim);

    if (currentlyAvailableToClaim < (MIN_TRANSFER_AMOUNT - TOLERANCE)) {
        return {
            success: false,
            transferred: 0,
            error: `Your referral claim is capped based on your active Trade Power (${totalActiveTP} USDT) x ${multiplier}. You have already claimed ${totalClaimed.toFixed(2)} USDT. You need more active Trade Power to claim further.`
        };
    }

    // 5. Determine transfer amount
    // If requestedAmount is provided, use it but cap it at current balance and available allowance
    // If not provided, use the full balance capped at available allowance
    let transferAmount = requestedAmount && requestedAmount > 0 
        ? Math.min(requestedAmount, currentBalance, currentlyAvailableToClaim)
        : Math.min(currentBalance, currentlyAvailableToClaim);

    if (requestedAmount && requestedAmount > currentlyAvailableToClaim) {
        return {
            success: false,
            transferred: 0,
            error: `The requested amount exceeds your current claimable limit of ${currentlyAvailableToClaim.toFixed(2)} USDT. This limit is based on your active Trade Power (${totalActiveTP} USDT) x ${multiplier}.`
        };
    }

    if (requestedAmount && requestedAmount < MIN_TRANSFER_AMOUNT) {
         return {
            success: false,
            transferred: 0,
            error: `Minimum transfer amount is ${MIN_TRANSFER_AMOUNT} USDT.`
        };
    }

    // 6. Use findOneAndUpdate to atomically debit the wallet
    const result = await db.collection<ReferralWalletDocument>(Collections.REFERRAL_WALLETS).findOneAndUpdate(
        { userId: _userId, balance: { $gte: transferAmount - TOLERANCE } },
        {
            $inc: {
                balance: -transferAmount,
            },
            $set: {
                updatedAt: new Date(),
            },
        },
        { returnDocument: 'after' }
    );

    if (!result) {
        return { success: false, transferred: 0, error: 'Transfer failed' };
    }
    console.log(`[transferToMainWallet] Transferring ${transferAmount} USDT for user ${_userId}`);

    // Credit main wallet
    await creditWallet(
        _userId,
        transferAmount,
        'REFERRAL_TRANSFER',
        `Transfer from referral wallet: ${transferAmount.toFixed(2)} USDT`
    );

    return { success: true, transferred: transferAmount };
}
