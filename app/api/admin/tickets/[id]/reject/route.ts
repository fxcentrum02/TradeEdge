// ===========================================
// ADMIN TICKET REJECTION API
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
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
    const { id } = await params;
    try {
        const session = await getAdminSessionFromRequest(request);

        if (!session ) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const body = await request.json().catch(() => ({}));
        const { adminNote } = body;

        // 1. Atomic Lock: Transition from PENDING to PROCESSING
        // This prevents two admins from processing/rejecting the same ticket simultaneously.
        const db = await getDB();
        const ticket = await db.collection(Collections.PAYMENT_TICKETS).findOneAndUpdate(
            { _id: typeof id === 'string' ? new ObjectId(id) : id, status: 'PENDING' },
            { $set: { status: 'PROCESSING', updatedAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!ticket) {
            // Check if it exists or was already processed
            const checkTicket = await findPaymentTicketById(id);
            if (!checkTicket) {
                return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
            }
            return NextResponse.json({
                success: false,
                error: `Ticket is already ${checkTicket.status.toLowerCase()}`
            }, { status: 400 });
        }

        // 2. Reject ticket
        await rejectPaymentTicket(ticket._id, new ObjectId(session.adminId), adminNote || 'Rejected by admin');

        return NextResponse.json({
            success: true,
            message: 'Payment ticket rejected',
        });

    } catch (error) {
        console.error('Reject ticket error:', error);
        
        // Rollback ticket status to PENDING on error so it can be retried
        try {
            const db = await getDB();
            await db.collection(Collections.PAYMENT_TICKETS).updateOne(
                { _id: typeof id === 'string' ? new ObjectId(id) : id, status: 'PROCESSING' },
                { $set: { status: 'PENDING', updatedAt: new Date() } }
            );
        } catch (rollbackError) {
            console.error('[reject ticket] Rollback failed:', rollbackError);
        }

        return NextResponse.json({ success: false, error: 'Failed to reject ticket: ' + String(error) }, { status: 500 });
    }
}
