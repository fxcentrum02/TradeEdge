import { NextRequest, NextResponse } from 'next/server';
import { getSettings } from '@/lib/repositories/settings.repository';

/**
 * Public endpoint – no auth required.
 * Returns just the payment address and QR code URL so the
 * user-side deposit page can render dynamic values.
 */
export async function GET(_request: NextRequest) {
    try {
        const settings = await getSettings();

        return NextResponse.json({
            success: true,
            data: {
                receivingAddress: settings.receivingAddress || '',
                qrCodeUrl: settings.qrCodeUrl || '',
            },
        });
    } catch (error) {
        console.error('Failed to get payment settings:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch payment settings' },
            { status: 500 }
        );
    }
}
