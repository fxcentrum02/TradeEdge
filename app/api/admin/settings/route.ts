import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/session';
import { getSettings, updateSettings } from '@/lib/repositories/settings.repository';
import type { ApiResponse, AppSettings } from '@/types';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<AppSettings>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const settings = await getSettings();
        return NextResponse.json({ success: true, data: settings });
    } catch (error) {
        console.error('Failed to get settings:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch settings' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<AppSettings>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const updatedSettings = await updateSettings(body);

        return NextResponse.json({ success: true, data: updatedSettings });
    } catch (error) {
        console.error('Failed to update settings:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update settings' },
            { status: 500 }
        );
    }
}
