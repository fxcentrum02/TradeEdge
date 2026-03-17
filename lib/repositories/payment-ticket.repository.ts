// ===========================================
// PAYMENT TICKET REPOSITORY
// ===========================================

import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { Collections } from '../db/collections';
import type { PaymentTicketDocument, PaymentTicketStatus } from '../db/types';

export async function findPaymentTicketById(id: string | ObjectId) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;
    return db.collection<PaymentTicketDocument>(Collections.PAYMENT_TICKETS).findOne({ _id });
}

export async function findPaymentTicketsByUserId(userId: string | ObjectId) {
    const db = await getDB();
    const _userId = typeof userId === 'string' ? new ObjectId(userId) : userId;

    return db.collection<PaymentTicketDocument>(Collections.PAYMENT_TICKETS)
        .find({ userId: _userId })
        .sort({ createdAt: -1 })
        .toArray();
}

export async function findPaymentTicketsByStatus(status: PaymentTicketStatus, page: number = 1, limit: number = 20) {
    const db = await getDB();
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
        db.collection<PaymentTicketDocument>(Collections.PAYMENT_TICKETS)
            .find({ status })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        db.collection<PaymentTicketDocument>(Collections.PAYMENT_TICKETS).countDocuments({ status }),
    ]);

    return {
        items: tickets,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
    };
}

export async function findAllPaymentTickets(page: number = 1, limit: number = 20) {
    const db = await getDB();
    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
        db.collection<PaymentTicketDocument>(Collections.PAYMENT_TICKETS)
            .find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray(),
        db.collection<PaymentTicketDocument>(Collections.PAYMENT_TICKETS).countDocuments({}),
    ]);

    return {
        items: tickets,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
    };
}

export async function createPaymentTicket(
    ticketData: Omit<PaymentTicketDocument, '_id' | 'createdAt' | 'updatedAt'>
) {
    const db = await getDB();
    const now = new Date();

    const ticket: Omit<PaymentTicketDocument, '_id'> = {
        ...ticketData,
        createdAt: now,
        updatedAt: now,
    };

    const result = await db.collection<PaymentTicketDocument>(Collections.PAYMENT_TICKETS).insertOne(ticket as PaymentTicketDocument);
    return db.collection<PaymentTicketDocument>(Collections.PAYMENT_TICKETS).findOne({ _id: result.insertedId });
}

export async function updatePaymentTicket(
    id: string | ObjectId,
    updates: Partial<PaymentTicketDocument>
) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await db.collection<PaymentTicketDocument>(Collections.PAYMENT_TICKETS).findOneAndUpdate(
        { _id },
        {
            $set: {
                ...updates,
                updatedAt: new Date(),
            },
        },
        { returnDocument: 'after' }
    );

    return result;
}

export async function approvePaymentTicket(
    id: string | ObjectId,
    reviewedBy: ObjectId,
    userPlanId: ObjectId,
    adminNote?: string
) {
    return updatePaymentTicket(id, {
        status: 'APPROVED',
        reviewedBy,
        reviewedAt: new Date(),
        userPlanId,
        adminNote,
    });
}

export async function rejectPaymentTicket(
    id: string | ObjectId,
    reviewedBy: ObjectId,
    adminNote: string
) {
    return updatePaymentTicket(id, {
        status: 'REJECTED',
        reviewedBy,
        reviewedAt: new Date(),
        adminNote,
    });
}

export async function countPendingTickets() {
    const db = await getDB();
    return db.collection<PaymentTicketDocument>(Collections.PAYMENT_TICKETS).countDocuments({
        status: 'PENDING',
    });
}
