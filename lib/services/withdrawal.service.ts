import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { Collections } from '../db/collections';
import type { UserDocument, WithdrawalDocument, WithdrawalStatus } from '../db/types';
import { debitWallet, creditWallet, findWalletByUserId } from '../repositories/wallet.repository';
import { 
    findWithdrawalsByUserId, 
    createWithdrawal, 
    findWithdrawalById, 
    approveWithdrawal, 
    rejectWithdrawal 
} from '../repositories/withdrawal.repository';
import { getSettings } from '../repositories/settings.repository';
import { updateUser } from '../repositories/user.repository';
import { pusherServer } from '../pusher';

export interface UserWithdrawalResponse {
    items: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
}

export class WithdrawalService {
    /**
     * Get paginated user withdrawals history
     */
    static async getUserWithdrawals(userId: string | ObjectId, page: number = 1, limit: number = 20): Promise<UserWithdrawalResponse> {
        const withdrawals = await findWithdrawalsByUserId(userId);
        
        // Paginate in memory
        const skip = (page - 1) * limit;
        const paginatedItems = withdrawals.slice(skip, skip + limit);

        const items = paginatedItems.map(w => ({
            ...w,
            id: w._id.toString(),
            _id: w._id.toString(),
            userId: w.userId.toString(),
            processedBy: w.processedBy?.toString() ?? null,
            adminNote: w.adminNote ?? null,
            txHash: w.txHash ?? null,
        }));

        return {
            items,
            total: withdrawals.length,
            page,
            limit,
            totalPages: Math.ceil(withdrawals.length / limit),
            hasMore: skip + limit < withdrawals.length,
        };
    }

    /**
     * Handle user withdrawal request submission
     */
    static async requestWithdrawal(
        user: UserDocument,
        amount: number,
        walletAddress: string,
        network: string = 'BEP20'
    ): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
        const settings = await getSettings();
        if (settings.maintenanceMode) {
            return {
                success: false,
                error: 'Platform is in maintenance mode. Withdrawals are temporarily disabled.',
                status: 503
            };
        }

        const minAmount = settings.minWithdrawalAmount || 10;

        // Validation
        if (!amount || amount < minAmount) {
            return {
                success: false,
                error: `Minimum ${minAmount} USDT`,
                status: 400
            };
        }

        if (amount > 1000000) { // Safety cap
            return {
                success: false,
                error: `Maximum withdrawal limit exceeded`,
                status: 400
            };
        }

        if (!walletAddress) {
            return {
                success: false,
                error: 'Wallet address required',
                status: 400
            };
        }

        // Wallet address format validation (EVM: 0x followed by 40 hex chars)
        const addressRegex = /^0x[a-fA-F0-9]{40}$/;
        if (!addressRegex.test(walletAddress)) {
            return {
                success: false,
                error: 'Invalid wallet address format. Please enter a valid BEP20 (USDT) address.',
                status: 400
            };
        }

        // Check 24-hour cooldown
        if (user.lastWithdrawalAt) {
            const lastWithdrawal = new Date(user.lastWithdrawalAt);
            const now = new Date();
            const hoursSinceLast = (now.getTime() - lastWithdrawal.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLast < 24) {
                const hoursRemaining = Math.ceil(24 - hoursSinceLast);
                return {
                    success: false,
                    error: `Please wait ${hoursRemaining} more hour(s) before requesting another withdrawal. (24h cooldown)`,
                    status: 400
                };
            }
        }

        // Check balance
        const wallet = await findWalletByUserId(new ObjectId(user._id));
        if (!wallet || wallet.balance < amount) {
            return {
                success: false,
                error: 'Insufficient balance',
                status: 400
            };
        }

        // Calculate fee
        let fee = 0;
        if (settings.withdrawalFeeType === 'FIXED') {
            fee = settings.withdrawalFeeValue;
        } else {
            fee = (amount * settings.withdrawalFeeValue) / 100;
        }

        const netAmount = Math.max(0, amount - fee);

        // Debit wallet
        const debitResult = await debitWallet(
            user._id.toString(),
            amount,
            'WITHDRAWAL',
            `Withdrawal request: ${netAmount} USDT`
        );

        if (!debitResult.success) {
            return {
                success: false,
                error: debitResult.error,
                status: 400
            };
        }

        // Create withdrawal record
        const withdrawal = await createWithdrawal({
            userId: new ObjectId(user._id),
            amount,
            fee,
            netAmount,
            walletAddress,
            network,
            status: 'PENDING',
        });

        if (!withdrawal) {
            return {
                success: false,
                error: 'Failed to create withdrawal',
                status: 500
            };
        }

        const withdrawalData = {
            ...withdrawal,
            id: withdrawal._id.toString(),
            _id: withdrawal._id.toString(),
            userId: withdrawal.userId.toString(),
        };

        // Update stats for the user and their entire upline chain (to sync tradePower)
        try {
            await updateUser(user._id.toString(), { 
                lastWithdrawalAt: new Date(),
                lastWithdrawalAddress: walletAddress 
            });
        } catch (updateErr) {
            console.error('Failed to update user withdrawal metadata:', updateErr);
        }

        // Notify admins of new withdrawal request
        try {
            await pusherServer.trigger('admin-notifications', 'new-withdrawal', {
                withdrawalId: withdrawal._id.toString(),
                amount: amount,
                netAmount: netAmount,
                userName: user?.firstName || user?.telegramUsername || 'User',
                timestamp: new Date().toISOString()
            });
        } catch (pusherErr) {
            console.error('Pusher notification failed:', pusherErr);
        }

        return {
            success: true,
            data: withdrawalData
        };
    }

    /**
     * Get all platform withdrawals with filters for admin panel
     */
    static async adminGetWithdrawals(filters: {
        status?: WithdrawalStatus | null;
        startDate?: string | null;
        endDate?: string | null;
        amountMin?: string | null;
        amountMax?: string | null;
        page: number;
        limit: number;
        dateType?: string | null;
    }) {
        const { status, startDate, endDate, amountMin, amountMax, page, limit, dateType } = filters;
        const skip = (page - 1) * limit;

        const db = await getDB();
        const matchStage: any = {};
        if (status) matchStage.status = status;

        const dateField = dateType === 'processedAt' ? 'processedAt' : 'createdAt';
        if (startDate || endDate) {
            matchStage[dateField] = {};
            if (startDate) { const s = new Date(startDate); s.setHours(0, 0, 0, 0); matchStage[dateField].$gte = s; }
            if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); matchStage[dateField].$lte = e; }
        }
        if (amountMin) matchStage.amount = { ...matchStage.amount, $gte: parseFloat(amountMin) };
        if (amountMax) matchStage.amount = { ...matchStage.amount, $lte: parseFloat(amountMax) };

        const [withdrawals, total] = await Promise.all([
            db.collection(Collections.WITHDRAWALS)
                .aggregate([
                    { $match: matchStage },
                    { $sort: { createdAt: -1 } },
                    { $skip: skip },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: Collections.USERS,
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'userInfo',
                        }
                    },
                    { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
                ]).toArray(),
            db.collection(Collections.WITHDRAWALS).countDocuments(matchStage),
        ]);

        const items = withdrawals.map(w => ({
            ...w,
            id: w._id.toString(),
            _id: w._id.toString(),
            userId: w.userId.toString(),
            processedBy: w.processedBy?.toString() ?? null,
            adminNote: w.adminNote ?? null,
            txHash: w.txHash ?? null,
            processedAt: w.processedAt ?? null,
            userName: w.userInfo?.firstName || w.userInfo?.telegramUsername || 'Unknown',
            telegramUsername: w.userInfo?.telegramUsername || null,
        }));

        return {
            items,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            hasMore: skip + limit < total,
        };
    }

    /**
     * Approve or reject a withdrawal request (admin action)
     */
    static async adminProcessWithdrawal(
        withdrawalId: string,
        action: 'approve' | 'reject',
        adminId: string,
        txHash?: string,
        adminNote?: string
    ): Promise<{ success: boolean; data?: any; error?: string; status?: number }> {
        if (!withdrawalId || !['approve', 'reject'].includes(action)) {
            return { success: false, error: 'Invalid request', status: 400 };
        }

        if (action === 'approve' && !txHash) {
            return { success: false, error: 'Transaction hash required for approval', status: 400 };
        }

        // 1. Atomic Lock: Transition from PENDING to PROCESSING
        // This prevents two admins from processing the same withdrawal simultaneously.
        const db = await getDB();
        const withdrawal = await db.collection(Collections.WITHDRAWALS).findOneAndUpdate(
            { _id: new ObjectId(withdrawalId), status: 'PENDING' },
            { $set: { status: 'PROCESSING', updatedAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!withdrawal) {
            // Check if it exists or was already processed
            const checkWithdrawal = await findWithdrawalById(withdrawalId);
            if (!checkWithdrawal) {
                return { success: false, error: 'Withdrawal not found', status: 404 };
            }
            return {
                success: false,
                error: `Withdrawal is already ${checkWithdrawal.status.toLowerCase()}`,
                status: 400
            };
        }

        if (action === 'reject') {
            let updated;
            try {
                updated = await rejectWithdrawal(
                    withdrawalId,
                    new ObjectId(adminId),
                    adminNote || 'Rejected by admin'
                );
            } catch (err) {
                // Rollback status to PENDING on failure
                await db.collection(Collections.WITHDRAWALS).updateOne(
                    { _id: new ObjectId(withdrawalId) },
                    { $set: { status: 'PENDING', updatedAt: new Date() } }
                );
                throw err;
            }

            try {
                // Refund user
                await creditWallet(
                    withdrawal.userId,
                    withdrawal.amount,
                    'ADMIN_CREDIT',
                    'Withdrawal rejected - refund',
                    withdrawalId
                );
            } catch (err) {
                // If crediting fails, we MUST roll back the withdrawal status to PENDING so the refund is not lost!
                await db.collection(Collections.WITHDRAWALS).updateOne(
                    { _id: new ObjectId(withdrawalId) },
                    { $set: { status: 'PENDING', updatedAt: new Date() } }
                );
                return {
                    success: false,
                    error: 'Failed to refund user wallet. Rolled back withdrawal status. Error: ' + String(err),
                    status: 500
                };
            }

            return {
                success: true,
                data: updated,
                status: 200
            };
        }

        // Approve
        try {
            const updated = await approveWithdrawal(
                withdrawalId,
                new ObjectId(adminId),
                txHash!,
                adminNote
            );

            return {
                success: true,
                data: updated,
                status: 200
            };
        } catch (err) {
            // Rollback status to PENDING on failure
            await db.collection(Collections.WITHDRAWALS).updateOne(
                { _id: new ObjectId(withdrawalId) },
                { $set: { status: 'PENDING', updatedAt: new Date() } }
            );
            return {
                success: false,
                error: 'Failed to approve withdrawal: ' + String(err),
                status: 500
            };
        }
    }
}
