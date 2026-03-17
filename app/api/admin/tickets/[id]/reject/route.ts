// ===========================================
// ADMIN TICKET REJECTION API
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import type { ApiResponse } from '@/types';
import { findPaymentTicketById, rejectPaymentTicket } from '@/lib/repositories/payment-ticket.repository';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/tickets/[id]/reject - Reject payment ticket
 */
export async function POST(
    request: NextRequest,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const session = await getAdminSessionFromRequest(request);

        if (!session ) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { adminNote } = body;

        // Find ticket
        const ticket = await findPaymentTicketById(id);
        if (!ticket) {
            return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
        }

        if (ticket.status !== 'PENDING') {
            return NextResponse.json({ success: false, error: 'Ticket already processed' }, { status: 400 });
        }

        // Reject ticket
        await rejectPaymentTicket(ticket._id, new ObjectId(session.adminId), adminNote || 'Rejected by admin');

        return NextResponse.json({
            success: true,
            message: 'Payment ticket rejected',
        });

    } catch (error) {
        console.error('Reject ticket error:', error);
        return NextResponse.json({ success: false, error: 'Failed to reject ticket' }, { status: 500 });
    }
}
