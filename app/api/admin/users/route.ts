// ===========================================
// ADMIN USERS API
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import type { ApiResponse, PaginatedResponse, AdminUserView } from '@/types';

/**
 * GET /api/admin/users - Get all users with pagination
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<PaginatedResponse<AdminUserView>>>> {
    try {
        const session = await getAdminSessionFromRequest(request);

        if (!session) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const isActive = searchParams.get('isActive');
        const minTradePower = searchParams.get('minTradePower');
        const minBalance = searchParams.get('minBalance');
        const maxBalance = searchParams.get('maxBalance');
        const minReferrals = searchParams.get('minReferrals');
        const minEarnings = searchParams.get('minEarnings');
        const maxEarnings = searchParams.get('maxEarnings');
        const minActivePlans = searchParams.get('minActivePlans');
        const minTotalInvestment = searchParams.get('minTotalInvestment');
        const hasReferrer = searchParams.get('hasReferrer');
        const isAdmin = searchParams.get('isAdmin');

        // Sorting
        const sortBy = searchParams.get('sortBy') || 'createdAt'; // Default sort
        const sortOrderStr = searchParams.get('sortOrder') || 'desc';
        const sortOrder = sortOrderStr === 'asc' ? 1 : -1;

        const skip = (page - 1) * limit;

        const db = await getDB();

        // Build query
        const query: any = {};
        if (search) {
            query.$or = [
                { telegramUsername: { $regex: search, $options: 'i' } },
                { firstName: { $regex: search, $options: 'i' } },
                { referralCode: { $regex: search, $options: 'i' } },
            ];
        }
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) { const s = new Date(startDate); s.setHours(0, 0, 0, 0); query.createdAt.$gte = s; }
            if (endDate) { const e = new Date(endDate); e.setHours(23, 59, 59, 999); query.createdAt.$lte = e; }
        }

        if (minTradePower) query.tradePower = { $gte: parseFloat(minTradePower) };
        if (isAdmin === 'true') query.isAdmin = true;
        if (isAdmin === 'false') query.isAdmin = { $ne: true };

        if (minReferrals) query.totalReferralCount = { $gte: parseInt(minReferrals) };
        if (minEarnings) { query.totalEarnings = query.totalEarnings || {}; query.totalEarnings.$gte = parseFloat(minEarnings); }
        if (maxEarnings) { query.totalEarnings = query.totalEarnings || {}; query.totalEarnings.$lte = parseFloat(maxEarnings); }

        if (hasReferrer === 'true') query.referredById = { $ne: null };
        if (hasReferrer === 'false') query.referredById = null;

        // Build Sort Object
        const sortObj: any = {};
        if (sortBy === 'createdAt') sortObj.createdAt = sortOrder;
        else if (sortBy === 'tradePower') sortObj.tradePower = sortOrder;
        else if (sortBy === 'totalEarnings') sortObj.totalEarnings = sortOrder;
        else if (sortBy === 'totalReferralCount') sortObj.totalReferralCount = sortOrder;
        else if (sortBy === 'walletBalance') sortObj['wallet.balance'] = sortOrder; // Note: balance is joined, so sort comes after $lookup
        else sortObj.createdAt = -1;

        // Fetch users using aggregation to include wallet and active plans info
        const users = await db.collection(Collections.USERS).aggregate([
            { $match: query },
            // Initial sort for base fields (perf)
            ...((sortBy !== 'walletBalance') ? [{ $sort: sortObj }] : []),
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: Collections.WALLETS,
                    localField: '_id',
                    foreignField: userIdField,
                    as: 'wallet'
                }
            },
            {
                $lookup: {
                    from: Collections.USER_PLANS,
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'allPlans'
                }
            },
            {
                $addFields: {
                    totalInvestment: { $sum: '$allPlans.amount' }
                }
            },
            // Filter by total investment if requested
            ...(minTotalInvestment ? [{
                $match: { totalInvestment: { $gte: parseFloat(minTotalInvestment) } }
            }] : []),
            {
                $lookup: {
                    from: Collections.USER_PLANS,
                    let: { userId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ['$userId', '$$userId'] }, { $eq: ['$isActive', true] }] } } }
                    ],
                    as: 'activePlans'
                }
            },
            { $unwind: { path: '$wallet', preserveNullAndEmptyArrays: true } },
            // Filter by plan-based isActive definition
            ...(isActive === 'true' ? [{
                $match: {
                    $expr: { $gt: [{ $size: '$activePlans' }, 0] }
                }
            }] : []),
            ...(isActive === 'false' ? [{
                $match: {
                    $expr: { $eq: [{ $size: '$activePlans' }, 0] }
                }
            }] : []),
            // Filter by active plan count if requested
            ...(minActivePlans ? [{
                $match: {
                    $expr: { $gte: [{ $size: '$activePlans' }, parseInt(minActivePlans)] }
                }
            }] : []),
            // Filter by wallet balance after joining
            ...(minBalance || maxBalance ? [{
                $match: {
                    'wallet.balance': {
                        ...(minBalance ? { $gte: parseFloat(minBalance) } : {}),
                        ...(maxBalance ? { $lte: parseFloat(maxBalance) } : {}),
                    }
                }
            }] : []),
            // Final sort if it's a joined field
            ...((sortBy === 'walletBalance') ? [{ $sort: sortObj }] : []),
        ]).toArray();

        // If we have complex filters (joined collections), we need to get the count from an aggregation too
        let total = 0;
        if (minActivePlans || minBalance || maxBalance || isActive || minTotalInvestment) {
            const countResult = await db.collection(Collections.USERS).aggregate([
                { $match: query },
                {
                    $lookup: {
                        from: Collections.WALLETS,
                        localField: '_id',
                        foreignField: userIdField,
                        as: 'wallet'
                    }
                },
                {
                    $lookup: {
                        from: Collections.USER_PLANS,
                        let: { userId: '$_id' },
                        pipeline: [
                            { $match: { $expr: { $and: [{ $eq: ['$userId', '$$userId'] }, { $eq: ['$isActive', true] }] } } }
                        ],
                        as: 'activePlans'
                    }
                },
                {
                    $lookup: {
                        from: Collections.USER_PLANS,
                        localField: '_id',
                        foreignField: 'userId',
                        as: 'allPlans'
                    }
                },
                {
                    $addFields: {
                        totalInvestment: { $sum: '$allPlans.amount' }
                    }
                },
                ...(minTotalInvestment ? [{
                    $match: { totalInvestment: { $gte: parseFloat(minTotalInvestment) } }
                }] : []),
                { $unwind: { path: '$wallet', preserveNullAndEmptyArrays: true } },
                ...(isActive === 'true' ? [{
                    $match: {
                        $expr: { $gt: [{ $size: '$activePlans' }, 0] }
                    }
                }] : []),
                ...(isActive === 'false' ? [{
                    $match: {
                        $expr: { $eq: [{ $size: '$activePlans' }, 0] }
                    }
                }] : []),
                ...(minActivePlans ? [{
                    $match: {
                        $expr: { $gte: [{ $size: '$activePlans' }, parseInt(minActivePlans)] }
                    }
                }] : []),
                ...(minBalance || maxBalance ? [{
                    $match: {
                        'wallet.balance': {
                            ...(minBalance ? { $gte: parseFloat(minBalance) } : {}),
                            ...(maxBalance ? { $lte: parseFloat(maxBalance) } : {}),
                        }
                    }
                }] : []),
                { $count: 'total' }
            ]).toArray();
            total = countResult[0]?.total || 0;
        } else {
            total = await db.collection(Collections.USERS).countDocuments(query);
        }

        const usersWithDetails: AdminUserView[] = users.map(u => ({
            ...u,
            id: u._id.toString(),
            walletBalance: u.wallet?.balance || 0,
            activePlanCount: u.activePlans?.length || 0,
            totalInvestment: u.totalInvestment || 0,
        } as unknown as AdminUserView));

        return NextResponse.json({
            success: true,
            data: {
                items: usersWithDetails,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasMore: skip + limit < total,
            },
        });

    } catch (error) {
        console.error('Admin users error:', error);
        return NextResponse.json({ success: false, error: 'Failed to get users' }, { status: 500 });
    }
}

// Helper to determine wallet field name (userId in schema)
const userIdField = 'userId';
