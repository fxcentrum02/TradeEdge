// ===========================================
// ADMIN TICKET APPROVAL API
// POST /api/admin/tickets/[id]/approve
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import type { ApiResponse } from '@/types';
import { findPaymentTicketById, approvePaymentTicket } from '@/lib/repositories/payment-ticket.repository';
import { findPlanById } from '@/lib/repositories/plan.repository';
import { createUserPlan } from '@/lib/repositories/user-plan.repository';
import { distributeReferralCommissions, updateUserStatsRecursively } from '@/lib/referral';
import { remoteLog } from '@/lib/logger';
import { pusherServer } from '@/lib/pusher';

/**
 * POST /api/admin/tickets/[id]/approve - Approve payment ticket and activate plan
 * On approval:
 * 1. Creates UserPlan with amount from ticket
 * 2. Updates user.tradePower += ticket.amount
 * 3. Distributes referral commissions (to referral wallets)
 * 4. Marks ticket as APPROVED
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{
    userPlanId: string;
    amount: number;
    commissionsDistributed: number;
    planTier: string;
    dailyRoi: number;
    endDate: Date;
}>>> {
    try {
        const session = await getAdminSessionFromRequest(request);

        if (!session) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const { adminNote, backdateRoi } = body;

        remoteLog('Admin approve ticket', { ticketId: id, adminId: session.adminId });

        // 1. Atomic Lock: Transition from PENDING to PROCESSING
        // This prevents two admins from approving the same ticket simultaneously.
        const db = await getDB();
        const ticket = await db.collection(Collections.PAYMENT_TICKETS).findOneAndUpdate(
            { _id: typeof id === 'string' ? new ObjectId(id) : id, status: 'PENDING' },
            { $set: { status: 'PROCESSING', updatedAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!ticket) {
            // Check if it exists at all or was already processed
            const checkTicket = await findPaymentTicketById(id);
            if (!checkTicket) {
                return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
            }
            return NextResponse.json({
                success: false,
                error: `Ticket is already ${checkTicket.status.toLowerCase()}`
            }, { status: 400 });
        }

        // 2. Get plan tier details
        const plan = await findPlanById(ticket.planId);
        if (!plan) {
            // Rollback status if plan not found (unlikely but safe)
            await db.collection(Collections.PAYMENT_TICKETS).updateOne(
                { _id: ticket._id },
                { $set: { status: 'PENDING', updatedAt: new Date() } }
            );
            return NextResponse.json({ success: false, error: 'Plan tier not found' }, { status: 404 });
        }

        // Calculate duration
        // If backdateRoi, start from ticket submission date (so the plan tenure is full from when user paid)
        const now = new Date();
        const startDate = backdateRoi ? new Date(ticket.createdAt) : now;
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + plan.duration);

        // Calculate missed ROI days if backdating
        const missedDays = backdateRoi
            ? Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)))
            : 0;

        // Create UserPlan record (NOT a reinvest — this is a real deposit)
        const userPlan = await createUserPlan({
            userId: ticket.userId,
            planId: ticket.planId,
            amount: ticket.amount,
            startDate,
            endDate,
            isActive: true,
            isReinvest: false,
            paymentTxHash: ticket.transactionId,
            paymentAddress: ticket.paymentAddress,
            totalRoiPaid: 0,
        });

        if (!userPlan) {
            return NextResponse.json({ success: false, error: 'Failed to create user plan' }, { status: 500 });
        }

        remoteLog('UserPlan created', {
            userPlanId: userPlan._id.toString(), amount: ticket.amount
        });

        // Update user.tradePower
        await db.collection(Collections.USERS).updateOne(
            { _id: ticket.userId },
            {
                $inc: { tradePower: ticket.amount },
                $set: { updatedAt: new Date() },
            }
        );

        // Record DEPOSIT transaction without crediting the withdrawable wallet balance
        const { logTransaction } = await import('@/lib/repositories/wallet.repository');
        await logTransaction(
            ticket.userId,
            'DEPOSIT',
            ticket.amount,
            `Buy Mining Power: ${plan.name}`,
            userPlan._id.toString()
        );

        // Credit backdated ROI if admin chose that option
        let backdatedRoiAmount = 0;
        if (missedDays > 0) {
            const { calculateDailyRoi } = await import('@/lib/constants');
            const { creditWallet } = await import('@/lib/repositories/wallet.repository');
            const dailyRoiAmount = calculateDailyRoi(ticket.amount, plan.dailyRoi);
            backdatedRoiAmount = parseFloat((dailyRoiAmount * missedDays).toFixed(8));
            await creditWallet(
                ticket.userId,
                backdatedRoiAmount,
                'ROI_EARNING',
                `Backdated ROI for ${missedDays} day${missedDays > 1 ? 's' : ''} (${plan.name})`,
                userPlan._id.toString()
            );
            // Update plan's running totalRoiPaid tracker
            const { updateRoiPaid } = await import('@/lib/repositories/user-plan.repository');
            await updateRoiPaid(userPlan._id, backdatedRoiAmount);
            remoteLog('Backdated ROI credited', { missedDays, backdatedRoiAmount });
        }

        // Distribute referral commissions (real deposit, not reinvest)
        const commissions = await distributeReferralCommissions(
            ticket.userId,
            userPlan._id,
            ticket.amount,
            false // isReinvest = false
        );
        remoteLog('Referral commissions distributed', { count: commissions.length });

        // Update stats for the subscriber and their entire upline chain (to sync tradePower and earnings)
        try {
            await updateUserStatsRecursively(ticket.userId);
        } catch (error) {
            remoteLog('Recursive stats update failed', { error: String(error) }, 'WARN');
        }

        // Mark ticket as APPROVED
        await approvePaymentTicket(
            ticket._id,
            new ObjectId(session.adminId),
            userPlan._id,
            adminNote
        );

        // Notify user of ticket approval
        await pusherServer.trigger(`user-${ticket.userId.toString()}-notifications`, 'ticket-approved', {
            ticketId: ticket._id.toString(),
            amount: ticket.amount,
            timestamp: new Date().toISOString()
        });

        // Notify admins to update their UI
        await pusherServer.trigger('admin-notifications', 'ticket-processed', {
            ticketId: ticket._id.toString(),
            action: 'approved'
        });

        return NextResponse.json({
            success: true,
            data: {
                userPlanId: userPlan._id.toString(),
                amount: ticket.amount,
                commissionsDistributed: commissions.length,
                planTier: plan.name,
                dailyRoi: plan.dailyRoi,
                endDate,
            },
            message: `Payment approved. Mining power +${ticket.amount} USDT activated. ${commissions.length} referral commissions paid.${missedDays > 0 ? ` Also credited ${backdatedRoiAmount.toFixed(2)} USDT for ${missedDays} missed ROI day${missedDays > 1 ? 's' : ''}.` : ''}`,
        });

    } catch (error) {
        console.error('[approve ticket] Error:', error);
        remoteLog('Approve ticket error', { error: String(error) }, 'ERROR');
        return NextResponse.json({ success: false, error: 'Failed to approve ticket' }, { status: 500 });
    }
}
