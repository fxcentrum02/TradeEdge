import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/repositories/settings.repository';
import type { ApiResponse } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { password, maintenanceMode, maintenanceEstimatedDuration } = body;

        if (password !== 'dwaparedge007@') {
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid developer password' }, { status: 401 });
        }

        if (maintenanceMode === undefined) {
            return NextResponse.json({ success: false, error: 'Missing maintenanceMode' }, { status: 400 });
        }

        const settings = await updateSettings({
            maintenanceMode,
            maintenanceEstimatedDuration: maintenanceEstimatedDuration || ''
        });

        return NextResponse.json({
            success: true,
            data: {
                maintenanceMode: settings.maintenanceMode,
                maintenanceEstimatedDuration: settings.maintenanceEstimatedDuration || ''
            }
        });
    } catch (error: unknown) {
        console.error('Failed to update maintenance settings:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
