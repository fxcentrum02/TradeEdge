// ===========================================
// WALLET OPERATIONS (MongoDB Native)
// ===========================================

import { ObjectId } from 'mongodb';
import { getDB } from './db';
import { Collections } from './db/collections';
import * as walletRepo from './repositories/wallet.repository';
import { findReferralWalletByUserId } from './repositories/referral-wallet.repository';

/**
 * Get or create wallet for a user
 */
export async function getOrCreateWallet(userId: string | ObjectId) {
    return walletRepo.getOrCreateWallet(userId);
}

/**
 * Get wallet summary including referral wallet balance
 */
export async function getWalletSummary(userId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    const wallet = await walletRepo.findWalletByUserId(_userId);
    const refWallet = await findReferralWalletByUserId(_userId);

    if (!wallet) {
        return {
            balance: 0,
            referralWalletBalance: refWallet?.balance || 0,
            totalEarnings: 0,
            totalReferralEarnings: 0,
            totalRoiEarnings: 0,
            totalWithdrawals: 0,
            pendingWithdrawals: 0,
        };
    }

    // Get aggregates from transactions using a single $facet aggregation for efficiency
    const results = await db.collection(Collections.TRANSACTIONS).aggregate([
        { $match: { userId: _userId } },
        { 
            $facet: {
                referralEarnings: [
                    { $match: { type: 'REFERRAL_EARNING' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ],
                roiEarnings: [
                    { $match: { type: 'ROI_EARNING' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ],
                withdrawals: [
                    { $match: { type: 'WITHDRAWAL' } },
                    { $group: { _id: null, total: { $sum: '$amount' } } }
                ]
            }
        }
    ]).toArray();

    // Pending withdrawals are from a different collection
    const pendingResult = await db.collection(Collections.WITHDRAWALS).aggregate([
        { $match: { userId: _userId, status: { $in: ['PENDING', 'PROCESSING'] } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]).toArray();

    const facet = results[0];
    const totalReferralEarnings = facet?.referralEarnings[0]?.total || 0;
    const totalRoiEarnings = facet?.roiEarnings[0]?.total || 0;
    const totalWithdrawals = Math.abs(facet?.withdrawals[0]?.total || 0);
    const pendingWithdrawalAmount = pendingResult[0]?.total || 0;

    return {
        balance: wallet.balance,
        referralWalletBalance: refWallet?.balance || 0,
        totalEarnings: totalReferralEarnings + totalRoiEarnings,
        totalReferralEarnings,
        totalRoiEarnings,
        totalWithdrawals,
        pendingWithdrawals: pendingWithdrawalAmount,
    };
}
