// ===========================================
// WITHDRAWALS API (MongoDB Native)
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { debitWallet } from '@/lib/repositories/wallet.repository';
import { findWithdrawalsByUserId, createWithdrawal } from '@/lib/repositories/withdrawal.repository';
import { findWalletByUserId } from '@/lib/repositories/wallet.repository';
import { getSettings } from '@/lib/repositories/settings.repository';
import { updateUser } from '@/lib/repositories/user.repository';
import { pusherServer } from '@/lib/pusher';
import type { ApiResponse, PaginatedResponse, Withdrawal } from '@/types';

/**
 * GET /api/withdrawals - Get user's withdrawal history
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<PaginatedResponse<Withdrawal>>>> {
    try {
        const user = await getTelegramUserFromRequest(request);

        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');

        const withdrawals = await findWithdrawalsByUserId(user._id.toString());

        // Paginate in memory (for simplicity, can be moved to repository)
        const skip = (page - 1) * limit;
        const paginatedItems = withdrawals.slice(skip, skip + limit);

        // Convert to API format
        const items = paginatedItems.map(w => ({
            ...w,
            id: w._id.toString(),
            _id: w._id.toString(),
            userId: w.userId.toString(),
            processedBy: w.processedBy?.toString() ?? null,
            adminNote: w.adminNote ?? null,
            txHash: w.txHash ?? null,
        }));

        return NextResponse.json({
            success: true,
            data: {
                items,
                total: withdrawals.length,
                page,
                limit,
                totalPages: Math.ceil(withdrawals.length / limit),
                hasMore: skip + limit < withdrawals.length,
            },
        } as any);

    } catch (error) {
        console.error('Withdrawals error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get withdrawals' }, { status: 500 });
    }
}

/**
 * POST /api/withdrawals - Create withdrawal request
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Withdrawal>>> {
    try {
        const user = await getTelegramUserFromRequest(request);

        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { amount, walletAddress, network = 'BEP20' } = body;

        const settings = await getSettings();
        if (settings.maintenanceMode) {
            return NextResponse.json({ success: false, error: 'Platform is in maintenance mode. Withdrawals are temporarily disabled.' }, { status: 503 });
        }

        const minAmount = settings.minWithdrawalAmount || 10;

        // Validation
        if (!amount || amount < minAmount) {
            return NextResponse.json({ success: false, error: `Minimum ${minAmount} USDT` }, { status: 400 });
        }

        if (amount > 1000000) { // Safety cap
            return NextResponse.json({ success: false, error: `Maximum withdrawal limit exceeded` }, { status: 400 });
        }

        if (!walletAddress) {
            return NextResponse.json({ success: false, error: 'Wallet address required' }, { status: 400 });
        }

        // Wallet address format validation (EVM: 0x followed by 40 hex chars)
        const addressRegex = /^0x[a-fA-F0-9]{40}$/;
        if (!addressRegex.test(walletAddress)) {
            return NextResponse.json({ 
                success: false, 
                error: 'Invalid wallet address format. Please enter a valid BEP20 (USDT) address.' 
            }, { status: 400 });
        }

        // Get user for validation and notifications
        // User is already in session (from getTelegramUserFromRequest)

        // Check 24-hour cooldown
        if (user.lastWithdrawalAt) {
            const lastWithdrawal = new Date(user.lastWithdrawalAt);
            const now = new Date();
            const hoursSinceLast = (now.getTime() - lastWithdrawal.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLast < 24) {
                const hoursRemaining = Math.ceil(24 - hoursSinceLast);
                return NextResponse.json({ 
                    success: false, 
                    error: `Please wait ${hoursRemaining} more hour(s) before requesting another withdrawal. (24h cooldown)` 
                }, { status: 400 });
            }
        }

        // Check balance
        const wallet = await findWalletByUserId(new ObjectId(user._id));
        if (!wallet || wallet.balance < amount) {
            return NextResponse.json({ success: false, error: 'Insufficient balance' }, { status: 400 });
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
            return NextResponse.json({ success: false, error: debitResult.error }, { status: 400 });
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
            return NextResponse.json({ success: false, error: 'Failed to create withdrawal' }, { status: 500 });
        }

        const withdrawalData: any = {
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
        await pusherServer.trigger('admin-notifications', 'new-withdrawal', {
            withdrawalId: withdrawal._id.toString(),
            amount: amount,
            netAmount: netAmount,
            userName: user?.firstName || user?.telegramUsername || 'User',
            timestamp: new Date().toISOString()
        });

        return NextResponse.json({
            success: true,
            data: withdrawalData,
            message: 'Withdrawal request submitted',
        }, { status: 201 });

    } catch (error) {
        console.error('Create withdrawal error:', error);
        return NextResponse.json({ success: false, error: 'Failed to create withdrawal' }, { status: 500 });
    }
}
