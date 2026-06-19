import { NextRequest, NextResponse } from 'next/server';
import { getSettings } from '@/lib/repositories/settings.repository';
import type { ApiResponse } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{ maintenanceMode: boolean; maintenanceEstimatedDuration?: string }>>> {
    try {
        const settings = await getSettings();
        return NextResponse.json({
            success: true,
            data: {
                maintenanceMode: settings.maintenanceMode || false,
                maintenanceEstimatedDuration: settings.maintenanceEstimatedDuration || ''
            }
        });
    } catch (error) {
        console.error('Failed to get maintenance settings:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch settings' }, { status: 500 });
    }
}
