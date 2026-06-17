import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/session';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';

export async function POST(request: NextRequest) {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { featureTitle, fullName, email, price } = body;

        if (!featureTitle || !fullName || !email) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const db = await getDB();
        const requestDoc = {
            featureTitle,
            fullName,
            email,
            price,
            status: 'activation requested',
            createdAt: new Date(),
            requestedBy: session.email,
        };

        const result = await db.collection(Collections.FEATURE_REQUESTS).insertOne(requestDoc);

        return NextResponse.json({ success: true, id: result.insertedId });
    } catch (error: unknown) {
        console.error('Failed to create feature request:', error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
