import { NextRequest, NextResponse } from 'next/server';
import { updateSettings } from '@/lib/repositories/settings.repository';
import { verifyDeletionPassword } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { password, maintenanceMode, maintenanceEstimatedDuration } = body;

        const auth = verifyDeletionPassword(password);
        if (!auth.valid) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid password' }, { status: 401 });
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
