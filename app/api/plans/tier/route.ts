// ===========================================
// PLAN TIER LOOKUP API
// GET /api/plans/tier?amount=XXX
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { findPlanForAmount } from '@/lib/repositories/plan.repository';
import type { ApiResponse, Plan } from '@/types';

/**
 * GET /api/plans/tier?amount=<number>
 * Returns the matching plan tier for a given investment amount.
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Plan | null>>> {
    try {
        const { searchParams } = new URL(request.url);
        const amountStr = searchParams.get('amount');

        if (!amountStr) {
            return NextResponse.json({ success: false, error: 'amount query parameter is required' }, { status: 400 });
        }

        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            return NextResponse.json({ success: false, error: 'Invalid amount' }, { status: 400 });
        }

        const plan = await findPlanForAmount(amount);

        if (!plan) {
            return NextResponse.json({ success: true, data: null, message: 'No matching tier found' });
        }

        const planData: Plan = {
            ...plan,
            id: plan._id.toString(),
            description: plan.description ?? null,
            maxAmount: plan.maxAmount ?? null,
        };

        return NextResponse.json({ success: true, data: planData });

    } catch (error) {
        console.error('[plans/tier] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to find plan tier' }, { status: 500 });
    }
}
