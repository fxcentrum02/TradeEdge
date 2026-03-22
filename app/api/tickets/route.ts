// ===========================================
// USER TICKETS API - GET /api/tickets
// Returns the current user's own ticket history
// ===========================================
import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { findPaymentTicketsByUserId } from '@/lib/repositories/payment-ticket.repository';
import { findPlanById } from '@/lib/repositories/plan.repository';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const user = await getTelegramUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const tickets = await findPaymentTicketsByUserId(user._id.toString());

        // Enrich with plan details
        const planCache = new Map<string, { name: string; dailyRoi: number; duration: number }>();
        const enriched = await Promise.all(
            tickets.map(async (ticket) => {
                const planIdStr = ticket.planId.toString();
                if (!planCache.has(planIdStr)) {
                    const plan = await findPlanById(ticket.planId);
                    if (plan) {
                        planCache.set(planIdStr, { name: plan.name, dailyRoi: plan.dailyRoi, duration: plan.duration });
                    }
                }
                const planInfo = planCache.get(planIdStr);

                return {
                    id: ticket._id.toString(),
                    userId: ticket.userId.toString(),
                    planId: planIdStr,
                    planName: planInfo?.name ?? 'Unknown Plan',
                    planDailyRoi: planInfo?.dailyRoi ?? 0,
                    planDuration: planInfo?.duration ?? 0,
                    amount: ticket.amount,
                    transactionId: ticket.transactionId,
                    paymentAddress: ticket.paymentAddress,
                    status: ticket.status,
                    adminNote: ticket.adminNote ?? null,
                    userPlanId: ticket.userPlanId?.toString() ?? null,
                    createdAt: ticket.createdAt,
                    updatedAt: ticket.updatedAt,
                };
            })
        );

        return NextResponse.json({
            success: true,
            data: enriched,
        });
    } catch (error) {
        console.error('[GET /api/tickets] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch tickets' }, { status: 500 });
    }
}
