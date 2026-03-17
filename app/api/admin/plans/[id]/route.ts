// ===========================================
// ADMIN PLANS API - Individual Plan Operations
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import { findPlanById, updatePlan, deletePlan, validatePlanOverlap } from '@/lib/repositories/plan.repository';
import type { ApiResponse, Plan } from '@/types';
import { ObjectId } from 'mongodb';

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/plans/[id] - Get a single plan
 */
export async function GET(
    request: NextRequest,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<Plan>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session ) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const { id } = await params;
        const plan = await findPlanById(id);

        if (!plan) {
            return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
        }

        const planData: Plan = {
            ...plan,
            id: plan._id.toString(),
            description: plan.description ?? null,
            maxAmount: plan.maxAmount ?? null,
        };

        return NextResponse.json({ success: true, data: planData });
    } catch (error) {
        console.error('Get plan error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get plan' }, { status: 500 });
    }
}

/**
 * PUT /api/admin/plans/[id] - Update a plan
 */
export async function PUT(
    request: NextRequest,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<Plan>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session ) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const { name, description, minAmount, maxAmount, dailyRoi, duration, isActive, sortOrder } = body;

        const currentPlan = await findPlanById(id);
        if (!currentPlan) {
            return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
        }

        const checkMinAmount = minAmount !== undefined ? minAmount : currentPlan.minAmount;
        // maxAmount can be explicitly passed as null, handle it:
        const checkMaxAmount = maxAmount !== undefined ? maxAmount : currentPlan.maxAmount;
        
        const isOverlapping = await validatePlanOverlap(checkMinAmount, checkMaxAmount, id);
        if (isOverlapping) {
            return NextResponse.json(
                { success: false, error: 'Plan amount range overlaps with an existing plan.' },
                { status: 400 }
            );
        }

        const updatedPlan = await updatePlan(id, {
            ...(name !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(minAmount !== undefined && { minAmount }),
            // maxAmount can be null/undefined (unlimited tier)
            ...(maxAmount !== undefined && { maxAmount: maxAmount || undefined }),
            ...(dailyRoi !== undefined && { dailyRoi }),
            ...(duration !== undefined && { duration }),
            ...(isActive !== undefined && { isActive }),
            ...(sortOrder !== undefined && { sortOrder }),
        });

        if (!updatedPlan) {
            return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
        }

        const planData: Plan = {
            ...updatedPlan,
            id: updatedPlan._id.toString(),
            description: updatedPlan.description ?? null,
            maxAmount: updatedPlan.maxAmount ?? null,
        };

        return NextResponse.json({ success: true, data: planData });
    } catch (error) {
        console.error('Update plan error:', error);
        return NextResponse.json({ success: false, error: 'Failed to update plan' }, { status: 500 });
    }
}

/**
 * DELETE /api/admin/plans/[id] - Delete a plan
 */
export async function DELETE(
    request: NextRequest,
    { params }: RouteParams
): Promise<NextResponse<ApiResponse<null>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session ) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const { id } = await params;
        const db = await getDB();

        // Check if plan has active subscriptions
        const activeSubscriptions = await db.collection(Collections.USER_PLANS).countDocuments({
            planId: new ObjectId(id),
            isActive: true,
        });

        if (activeSubscriptions > 0) {
            return NextResponse.json({
                success: false,
                error: `Cannot delete plan with ${activeSubscriptions} active subscriptions`
            }, { status: 400 });
        }

        await deletePlan(id);

        return NextResponse.json({ success: true, message: 'Plan deleted successfully' });
    } catch (error) {
        console.error('Delete plan error:', error);
        return NextResponse.json({ success: false, error: 'Failed to delete plan' }, { status: 500 });
    }
}
