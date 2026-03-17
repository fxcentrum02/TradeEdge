// ===========================================
// PLANS API (Range-Based Tiers)
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, Plan } from '@/types';
import { findActivePlans, createPlan, validatePlanOverlap } from '@/lib/repositories/plan.repository';

/**
 * GET /api/plans - Get all active plan tiers (sorted by minAmount)
 */
export async function GET(): Promise<NextResponse<ApiResponse<Plan[]>>> {
    try {
        const plans = await findActivePlans();

        const planData: Plan[] = plans.map(p => ({
            ...p,
            id: p._id.toString(),
            description: p.description ?? null,
            maxAmount: p.maxAmount ?? null,
        }));

        return NextResponse.json({ success: true, data: planData });

    } catch (error) {
        console.error('Plans error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get plans' }, { status: 500 });
    }
}

/**
 * POST /api/plans - Create a plan tier (Admin only)
 * Body: { name, description?, minAmount, maxAmount?, dailyRoi, duration?, sortOrder? }
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Plan>>> {
    try {
        const body = await request.json();
        const { name, description, minAmount, maxAmount, dailyRoi = 5.5, duration = 30, sortOrder = 0 } = body;

        if (!name || minAmount == null || minAmount < 0) {
            return NextResponse.json(
                { success: false, error: 'name and minAmount are required' },
                { status: 400 }
            );
        }

        if (!dailyRoi || dailyRoi <= 0) {
            return NextResponse.json({ success: false, error: 'dailyRoi must be > 0' }, { status: 400 });
        }

        const isOverlapping = await validatePlanOverlap(minAmount, maxAmount);
        if (isOverlapping) {
             return NextResponse.json(
                { success: false, error: 'Plan amount range overlaps with an existing plan.' },
                { status: 400 }
            );
        }

        const plan = await createPlan({
            name,
            description,
            minAmount,
            maxAmount: maxAmount ?? undefined,
            dailyRoi,
            duration,
            isActive: true,
            sortOrder,
        });

        if (!plan) {
            return NextResponse.json({ success: false, error: 'Failed to create plan tier' }, { status: 500 });
        }

        const planData: Plan = {
            ...plan,
            id: plan._id.toString(),
            description: plan.description ?? null,
            maxAmount: plan.maxAmount ?? null,
        };

        return NextResponse.json({ success: true, data: planData }, { status: 201 });

    } catch (error) {
        console.error('Create plan error:', error);
        return NextResponse.json({ success: false, error: 'Failed to create plan' }, { status: 500 });
    }
}
