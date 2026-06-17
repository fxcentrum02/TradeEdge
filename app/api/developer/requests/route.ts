import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { password } = body;

        if (password !== 'dwaparedge007@') {
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid developer password' }, { status: 401 });
        }

        const db = await getDB();
        const requests = await db.collection(Collections.FEATURE_REQUESTS)
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        return NextResponse.json({ success: true, data: requests });
    } catch (error: unknown) {
        console.error('Failed to retrieve developer requests:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}

// Optionally allow developers to update the status of a request (e.g. from requested to activated)
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { password, requestId, newStatus } = body;

        if (password !== 'dwaparedge007@') {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        if (!requestId || !newStatus) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        const db = await getDB();
        
        await db.collection(Collections.FEATURE_REQUESTS).updateOne(
            { _id: new ObjectId(requestId) },
            { $set: { status: newStatus, updatedAt: new Date() } }
        );

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Failed to update request status:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
