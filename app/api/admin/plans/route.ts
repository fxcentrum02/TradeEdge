// ===========================================
// ADMIN PLANS API - List All Plans (including inactive)
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { findAllPlans } from '@/lib/repositories/plan.repository';
import type { ApiResponse, Plan } from '@/types';

/**
 * GET /api/admin/plans - Get all plans (including inactive) for admin
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Plan[]>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session ) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const plans = await findAllPlans();

        const planData: Plan[] = plans.map(p => ({
            ...p,
            id: p._id.toString(),
            description: p.description ?? null,
            maxAmount: p.maxAmount ?? null,
        }));

        return NextResponse.json({ success: true, data: planData });
    } catch (error) {
        console.error('Admin plans error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get plans' }, { status: 500 });
    }
}
