// ===========================================
// REFERRAL HISTORY API
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getTelegramUserFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import { ObjectId } from 'mongodb';
import type { ApiResponse, PaginatedResponse } from '@/types';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<PaginatedResponse<any>>>> {
    try {
        const user = await getTelegramUserFromRequest(request);

        if (!user) {
            return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const filter = searchParams.get('filter') || 'all'; // all, today, yesterday, week

        const db = await getDB();
        const skip = (page - 1) * limit;

        // Build date filter
        const dateFilter: any = {};
        const now = new Date();
        if (filter === 'today') {
            const startOfDay = new Date(now.setHours(0, 0, 0, 0));
            dateFilter.createdAt = { $gte: startOfDay };
        } else if (filter === 'yesterday') {
            const startOfYesterday = new Date(now.setDate(now.getDate() - 1));
            startOfYesterday.setHours(0, 0, 0, 0);
            const endOfYesterday = new Date(startOfYesterday);
            endOfYesterday.setHours(23, 59, 59, 999);
            dateFilter.createdAt = { $gte: startOfYesterday, $lte: endOfYesterday };
        } else if (filter === 'week') {
            const startOfWeek = new Date(now.setDate(now.getDate() - 7));
            dateFilter.createdAt = { $gte: startOfWeek };
        }

        const matchStage = {
            userId: user._id,
            ...dateFilter
        };

        const pipeline: any[] = [
            { $match: matchStage },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: Collections.USERS,
                    localField: 'fromUserId',
                    foreignField: '_id',
                    as: 'fromUser'
                }
            },
            { $unwind: { path: '$fromUser', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    amount: 1,
                    tier: 1,
                    createdAt: 1,
                    fromUser: {
                        firstName: 1,
                        lastName: 1,
                        telegramUsername: 1
                    }
                }
            },
            {
                $facet: {
                    metadata: [{ $count: 'total' }],
                    data: [{ $skip: skip }, { $limit: limit }]
                }
            }
        ];

        const results = await db.collection(Collections.REFERRAL_EARNINGS).aggregate(pipeline).toArray();
        const metadata = results[0]?.metadata[0] || { total: 0 };
        const items = results[0]?.data || [];

        return NextResponse.json({
            success: true,
            data: {
                items: items.map((item: any) => ({
                    ...item,
                    id: item._id.toString(),
                    _id: item._id.toString(),
                })),
                total: metadata.total,
                page,
                limit,
                totalPages: Math.ceil(metadata.total / limit),
                hasMore: skip + limit < metadata.total,
            }
        });

    } catch (error) {
        console.error('Referral history error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get history' }, { status: 500 });
    }
}
