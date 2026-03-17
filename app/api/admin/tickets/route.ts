// ===========================================
// ADMIN TICKETS API - List & Filter with user+plan info
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import type { ApiResponse } from '@/types';
import type { PaymentTicketStatus } from '@/lib/db/types';
import { ObjectId } from 'mongodb';

/**
 * GET /api/admin/tickets - Get all payment tickets with user + plan info joined
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const session = await getAdminSessionFromRequest(request);

        if (!session) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') as PaymentTicketStatus | null;
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const amountMin = searchParams.get('amountMin');
        const amountMax = searchParams.get('amountMax');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const skip = (page - 1) * limit;

        const db = await getDB();

        const matchStage: any = {};
        if (status) matchStage.status = status;
        if (startDate || endDate) {
            matchStage.createdAt = {};
            if (startDate) { const s = new Date(startDate); s.setHours(0, 0, 0, 0); matchStage.createdAt.$gte = s; }
            if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); matchStage.createdAt.$lte = e; }
        }
        if (amountMin) matchStage.amount = { ...matchStage.amount, $gte: parseFloat(amountMin) };
        if (amountMax) matchStage.amount = { ...matchStage.amount, $lte: parseFloat(amountMax) };

        const tickets = await db.collection(Collections.PAYMENT_TICKETS)
            .aggregate([
                { $match: matchStage },
                { $sort: { createdAt: -1 } },
                { $skip: skip },
                { $limit: limit },
                // Join user info
                {
                    $lookup: {
                        from: Collections.USERS,
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'userInfo',
                    }
                },
                { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
                // Join plan info
                {
                    $lookup: {
                        from: Collections.PLANS,
                        localField: 'planId',
                        foreignField: '_id',
                        as: 'planInfo',
                    }
                },
                { $unwind: { path: '$planInfo', preserveNullAndEmptyArrays: true } },
            ]).toArray();

        const total = await db.collection(Collections.PAYMENT_TICKETS).countDocuments(matchStage);

        const items = tickets.map(ticket => ({
            id: ticket._id.toString(),
            userId: ticket.userId.toString(),
            planId: ticket.planId.toString(),
            amount: ticket.amount,
            transactionId: ticket.transactionId,
            paymentAddress: ticket.paymentAddress,
            status: ticket.status,
            adminNote: ticket.adminNote || null,
            userPlanId: ticket.userPlanId?.toString() || null,
            reviewedBy: ticket.reviewedBy?.toString() || null,
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
            // Joined
            userName: ticket.userInfo?.firstName || ticket.userInfo?.telegramUsername || 'Unknown',
            telegramUsername: ticket.userInfo?.telegramUsername || null,
            planName: ticket.planInfo?.name || 'Unknown Tier',
            planDailyRoi: ticket.planInfo?.dailyRoi || null,
        }));

        return NextResponse.json({
            success: true,
            data: {
                items,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasMore: skip + limit < total,
            },
        });

    } catch (error) {
        console.error('[admin/tickets] error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get tickets' }, { status: 500 });
    }
}
