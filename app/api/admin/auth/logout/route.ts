import { NextResponse } from 'next/server';
import { clearAdminSessionCookie } from '@/lib/auth';

export async function POST() {
    try {
        const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
        clearAdminSessionCookie(response);
        return response;
    } catch (error) {
        console.error('[Admin Logout] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
