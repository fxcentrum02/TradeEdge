// ===========================================
// ADMIN HIERARCHY REPORT API
// GET /api/admin/reports/hierarchy
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import { getGlobalHierarchyStats, getDescendantsTree } from '@/lib/repositories/user.repository';
import { ObjectId } from 'mongodb';
import type { ApiResponse } from '@/types';

/**
 * GET /api/admin/reports/hierarchy
 * Query params:
 * - rootUserId? (optional): Start tree from specific user
 * - depth? (optional, default 3): For the tree explorer
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const rootUserId = searchParams.get('rootUserId');
        const depth = parseInt(searchParams.get('depth') || '3');

        // 1. Get global stats for the 20-tier breakdown
        const stats = await getGlobalHierarchyStats(20);

        // 2. Get top-level users (roots) to populate the initial explorer
        const db = await getDB();
        const rootUsers = await db.collection(Collections.USERS)
            .find({
                $or: [
                    { referredById: { $exists: false } },
                    { referredById: null }
                ]
            })
            .sort({ totalReferralCount: -1, tradePower: -1 })
            .limit(20)
            .toArray();

        const formattedRoots = rootUsers.map(u => ({
            id: u._id.toString(),
            telegramId: u.telegramId,
            telegramUsername: u.telegramUsername || null,
            firstName: u.firstName || null,
            lastName: u.lastName || null,
            photoUrl: u.photoUrl || null,
            tradePower: u.tradePower || 0,
            directReferralCount: u.directReferralCount || 0,
            totalReferralCount: u.totalReferralCount || 0,
            joinedAt: u.createdAt.toISOString(),
        }));

        // 3. If a specific user is requested, build their descendant tree
        let explorerTree = null;
        if (rootUserId && ObjectId.isValid(rootUserId)) {
            explorerTree = await getDescendantsTree(rootUserId, depth);
        }

        return NextResponse.json({
            success: true,
            data: {
                stats,
                rootUsers: formattedRoots,
                explorerTree
            }
        });

    } catch (error) {
        console.error('[hierarchy report] Error:', error);
        return NextResponse.json({ success: false, error: 'Failed to generate report' }, { status: 500 });
    }
}
