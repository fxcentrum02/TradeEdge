
import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { getReferralEarningsByTierAndDateRange } from '@/lib/repositories/referral-earning.repository';

export async function GET(req: NextRequest) {
    try {
        const user = await getTelegramUserFromRequest(req);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const start = searchParams.get('start');
        const end = searchParams.get('end');

        if (!start || !end) {
            return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
        }

        const startDate = new Date(start);
        const endDate = new Date(end);
        
        // Ensure endDate is at the end of the day
        endDate.setHours(23, 59, 59, 999);

        const insights = await getReferralEarningsByTierAndDateRange(user._id.toString(), startDate, endDate);

        return NextResponse.json(insights);
    } catch (error) {
        console.error('Error fetching referral insights:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
