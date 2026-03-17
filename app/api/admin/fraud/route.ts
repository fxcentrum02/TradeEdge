import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const db = await getDB();

        // 1. Find Duplicate IPs
        const duplicateIps = await db.collection(Collections.USERS).aggregate([
            { $match: { lastIp: { $exists: true, $ne: '127.0.0.1' } } },
            {
                $group: {
                    _id: '$lastIp',
                    count: { $sum: 1 },
                    users: { $push: { id: '$_id', username: '$telegramUsername', firstName: '$firstName' } }
                }
            },
            { $match: { count: { $gt: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 50 }
        ]).toArray();

        // 2. Find Referral Velocity Issues
        // We look for users who have many signups within a short overlapping window.
        // Simplified: Users with > 5 referrals where at least 5 were created in the same hour.
        const suspiciousReferrers = await db.collection(Collections.USERS).aggregate([
            { $match: { referredById: { $ne: null } } },
            {
                $group: {
                    _id: {
                        referredById: '$referredById',
                        hour: { $dateToString: { format: '%Y-%m-%d %H', date: '$createdAt' } }
                    },
                    count: { $sum: 1 },
                    referrals: { $push: { id: '$_id', username: '$telegramUsername', createdAt: '$createdAt' } }
                }
            },
            { $match: { count: { $gt: 4 } } }, // 5 or more signups in the same hour
            {
                $lookup: {
                    from: Collections.USERS,
                    localField: '_id.referredById',
                    foreignField: '_id',
                    as: 'referrer'
                }
            },
            { $unwind: '$referrer' },
            {
                $project: {
                    referrerId: '$_id.referredById',
                    referrerUsername: '$referrer.telegramUsername',
                    referrerName: '$referrer.firstName',
                    hour: '$_id.hour',
                    count: 1,
                    referrals: 1
                }
            },
            { $sort: { count: -1 } }
        ]).toArray();

        return NextResponse.json({
            success: true,
            data: {
                duplicateIps,
                suspiciousReferrers
            }
        });

    } catch (error) {
        console.error('[fraud] error:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch fraud data' }, { status: 500 });
    }
}
