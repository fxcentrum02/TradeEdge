export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import { pusherServer } from '@/lib/pusher';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;
        const isManualWithSecret = cronSecret && authHeader === `Bearer ${cronSecret}`;

        // Bypass authorization for testing (mobile access)
        // if (!isManualWithSecret) {
        //     console.error('[test-cron] Unauthorized access attempt');
        //     return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        // }

        console.log('[test-cron] Starting manual ROI settlement');

        const db = await getDB();
        const now = new Date();
        const expireResult = await db.collection(Collections.USER_PLANS).updateMany(
            { isActive: true, endDate: { $lte: now } },
            { $set: { isActive: false, updatedAt: now } }
        );

        const { searchParams } = new URL(request.url);
        const targetUserId = searchParams.get('userId');

        // Force process all active plans regardless of whether they were already processed today
        console.log('[test-cron] Fetching all active plans for manual override', targetUserId ? `for user ${targetUserId}` : '');
        
        const filter: any = {
            isActive: true,
            endDate: { $gt: now },
        };
        if (targetUserId) {
            filter.userId = new ObjectId(targetUserId);
        }

        const activePlansCursor = db.collection(Collections.USER_PLANS).find(filter);

        const activePlans = await activePlansCursor.toArray();
        console.log(`[test-cron] Found ${activePlans.length} active plans to force process`);

        const result = {
            processed: 0,
            totalAmount: 0,
            referralCommissionsTriggered: 0,
            errors: [] as string[]
        };

        const { creditPlanRoi } = await import('@/lib/roi');
        const { calculateDailyRoi } = await import('@/lib/constants');
        const { findPlanById } = await import('@/lib/repositories/plan.repository');

        for (const userPlan of activePlans) {
            try {
                // We bypass findPlansEligibleForRoi, but we still use creditPlanRoi to do the actual credit
                await creditPlanRoi(userPlan._id);
                result.processed++;

                // Since we don't have direct access to the distributions count from creditPlanRoi, 
                // we'll just log that it was triggered. 
                // In a perfect world we'd update creditPlanRoi to return this.
                result.referralCommissionsTriggered++; 

                // Calculate the amount for logging
                const plan = await findPlanById(userPlan.planId);
                if (plan) {
                    const dailyRoi = calculateDailyRoi(userPlan.amount, plan.dailyRoi);
                    result.totalAmount += dailyRoi;
                }
            } catch (error) {
                console.error(`Error forcing ROI for plan ${userPlan._id}:`, error);
                result.errors.push(String(error));
            }
        }

        // Notify admins and users of the settlement
        await pusherServer.trigger('admin-notifications', 'cron-event', {
            type: 'ROI_SETTLEMENT',
            message: `Manual ROI Settled: ${result.processed} plans, +$${result.totalAmount.toFixed(2)} USDT`,
            timestamp: now.toISOString()
        });

        // Let all users know global cron finished 
        await pusherServer.trigger('global-events', 'roi-settled', { timestamp: now.toISOString() });

        return NextResponse.json({
            success: true,
            message: 'Manual ROI triggered successfully',
            data: {
                ...result,
                expiredPlans: expireResult.modifiedCount
            }
        });
    } catch (error) {
        console.error('[test-cron] Error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
