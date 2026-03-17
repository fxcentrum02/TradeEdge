import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { level, message, data } = body;

        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[REMOTE:${level || 'LOG'}] [${timestamp}]`;

        if (data) {
            console.log(`${prefix} ${message}`, JSON.stringify(data, null, 2));
        } else {
            console.log(`${prefix} ${message}`);
        }

        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ success: false }, { status: 500 });
    }
}
