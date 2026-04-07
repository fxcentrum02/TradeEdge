// ===========================================
// REFERRAL MILESTONES API
// GET /api/referrals/milestones
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { MILESTONE_BONUSES, MILESTONE_SPLIT } from '@/lib/constants';
import { getDirectLegVolumes, check403030 } from '@/lib/milestone';
import { findAwardedMilestones } from '@/lib/repositories/milestone.repository';
import type { ApiResponse } from '@/types';

export interface MilestoneStatus {
    threshold: number;
    reward: number;
    isAchieved: boolean;
    achievedAt: string | null;
    // Current progress (only populated for unachieved milestones)
    legA: number;
    legB: number;
    legC: number;
    legARequired: number;
    legBRequired: number;
    legCRequired: number;
    legAPct: number;   // progress percentage (0-100) capped at 100
    legBPct: number;
    legCPct: number;
}

export interface MilestonePageData {
    milestones: MilestoneStatus[];
    totalAwarded: number;
    totalUSDT: number;
    nextMilestone: MilestoneStatus | null;
}

/**
 * GET /api/referrals/milestones
 * Returns all milestone statuses (achieved + progress for next) for the authenticated user.
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<MilestonePageData>>> {
    try {
        const user = await getTelegramUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        // 1. Get already awarded milestones
        const awards = await findAwardedMilestones(user._id);
        const awardedMap = new Map(awards.map(a => [a.milestoneThreshold, a]));

        // 2. Compute current leg volumes ONCE — reused across all milestone checks
        const sortedLegs = await getDirectLegVolumes(user._id);

        // 3. Build status for every milestone
        const milestones: MilestoneStatus[] = MILESTONE_BONUSES.map(m => {
            const award = awardedMap.get(m.threshold);
            const isAchieved = !!award;

            const { legA, legB, legC } = check403030(m.threshold, sortedLegs);
            const legARequired = m.threshold * MILESTONE_SPLIT.LEG_A_PCT;
            const legBRequired = m.threshold * MILESTONE_SPLIT.LEG_B_PCT;
            const legCRequired = m.threshold * MILESTONE_SPLIT.LEG_C_PCT;

            return {
                threshold: m.threshold,
                reward: m.reward,
                isAchieved,
                achievedAt: award ? award.awardedAt.toISOString() : null,
                legA,
                legB,
                legC,
                legARequired,
                legBRequired,
                legCRequired,
                legAPct: Math.min(100, legARequired > 0 ? (legA / legARequired) * 100 : 0),
                legBPct: Math.min(100, legBRequired > 0 ? (legB / legBRequired) * 100 : 0),
                legCPct: Math.min(100, legCRequired > 0 ? (legC / legCRequired) * 100 : 0),
            };
        });

        const totalAwarded = awards.length;
        const totalUSDT = awards.reduce((sum, a) => sum + a.rewardAmount, 0);
        const nextMilestone = milestones.find(m => !m.isAchieved) ?? null;

        return NextResponse.json({
            success: true,
            data: { milestones, totalAwarded, totalUSDT, nextMilestone },
        });

    } catch (error) {
        console.error('[milestones-api] Error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch milestones' },
            { status: 500 }
        );
    }
}
