// ===========================================
// BUY MINING POWER API
// POST /api/plans/buy-tp
// Creates a PaymentTicket (PENDING) for admin approval
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { findPlanForAmount } from '@/lib/repositories/plan.repository';
import { createPaymentTicket } from '@/lib/repositories/payment-ticket.repository';
import type { ApiResponse, PaymentTicket } from '@/types';
import { ObjectId } from 'mongodb';
import { remoteLog } from '@/lib/logger';
import { pusherServer } from '@/lib/pusher';

const BEP20_ADDRESS = process.env.PAYMENT_BEP20_ADDRESS || '';
const MIN_DEPOSIT = 10; // Minimum 10 USDT

/**
 * POST /api/plans/buy-tp
 * Body: { amount: number, transactionId: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<PaymentTicket>>> {
    try {
        const user = await getTelegramUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const body = await request.json();
        const { amount, transactionId } = body;

        const { getSettings } = await import('@/lib/repositories/settings.repository');
        const settings = await getSettings();
        if (settings.maintenanceMode) {
            return NextResponse.json({ success: false, error: 'Platform is in maintenance mode. New investments are temporarily disabled.' }, { status: 503 });
        }

        remoteLog('buy-tp: request received', { userId: user._id.toString(), amount, hasTransactionId: !!transactionId });

        const db = await import('@/lib/db').then(m => m.getDB());
        const dbCollections = await import('@/lib/db/collections').then(m => m.Collections);

        // Validate amount
        if (!amount || typeof amount !== 'number' || isNaN(amount)) {
            return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
        }

        if (amount < MIN_DEPOSIT) {
            return NextResponse.json(
                { success: false, error: `Minimum investment is ${MIN_DEPOSIT} USDT` },
                { status: 400 }
            );
        }

        // Validate TX ID
        if (!transactionId || typeof transactionId !== 'string' || !transactionId.trim()) {
            return NextResponse.json({ success: false, error: 'Transaction ID is required' }, { status: 400 });
        }

        // 1. Format check (BEP20 / standard EVM hash: 0x followed by 64 hex chars)
        const txRegex = /^0x([A-Fa-f0-9]{64})$/;
        if (!txRegex.test(transactionId.trim())) {
            return NextResponse.json({ 
                success: false, 
                error: 'Invalid transaction hash format. It must be a 66-character string starting with 0x.' 
            }, { status: 400 });
        }

        // 2. Duplicate check (prevent re-using the same hash)
        const existingTicket = await db.collection(dbCollections.PAYMENT_TICKETS).findOne({ 
            transactionId: transactionId.trim() 
        });

        if (existingTicket) {
            return NextResponse.json({ 
                success: false, 
                error: 'This transaction hash has already been submitted for a previous deposit.' 
            }, { status: 400 });
        }

        // Find matching plan tier
        const plan = await findPlanForAmount(amount);
        if (!plan) {
            return NextResponse.json(
                { success: false, error: 'No investment tier found for this amount. Please check available plans.' },
                { status: 400 }
            );
        }

        remoteLog('buy-tp: matched plan', { planId: plan._id.toString(), planName: plan.name });

        // Create payment ticket (PENDING — awaits admin approval)
        const ticket = await createPaymentTicket({
            userId: user._id,
            planId: plan._id,
            amount,
            paymentAddress: BEP20_ADDRESS,
            transactionId: transactionId.trim(),
            status: 'PENDING',
        });

        if (!ticket) {
            remoteLog('buy-tp: failed to create ticket', null, 'ERROR');
            return NextResponse.json({ success: false, error: 'Failed to create payment ticket' }, { status: 500 });
        }

        remoteLog('buy-tp: ticket created', { ticketId: ticket._id.toString(), status: 'PENDING' });

        // User is already in session

        // Notify admins of new ticket
        await pusherServer.trigger('admin-notifications', 'new-ticket', {
            ticketId: ticket._id.toString(),
            amount: amount,
            userName: user?.firstName || user?.telegramUsername || 'User',
            timestamp: new Date().toISOString()
        });

        const ticketResponse: PaymentTicket = {
            id: ticket._id.toString(),
            userId: ticket.userId.toString(),
            planId: ticket.planId.toString(),
            amount: ticket.amount,
            paymentAddress: ticket.paymentAddress,
            transactionId: ticket.transactionId,
            status: ticket.status,
            adminNote: ticket.adminNote ?? null,
            userPlanId: ticket.userPlanId?.toString() ?? null,
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
        };

        return NextResponse.json({
            success: true,
            data: ticketResponse,
            message: 'Payment submitted for review. Your mining power will be activated within 24 hours.',
        }, { status: 201 });

    } catch (error) {
        console.error('[buy-tp] Error:', error);
        remoteLog('buy-tp: unexpected error', { error: String(error) }, 'ERROR');
        return NextResponse.json({ success: false, error: 'Failed to process request' }, { status: 500 });
    }
}
