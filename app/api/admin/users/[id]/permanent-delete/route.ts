import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import { ObjectId } from 'mongodb';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { updateUserStatsRecursively } from '@/lib/referral';

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        if (!id || !ObjectId.isValid(id)) {
            return NextResponse.json(
                { success: false, error: 'Invalid user ID format' },
                { status: 400 }
            );
        }

        // Authenticate as Admin
        const session = await getAdminSessionFromRequest(req);
        if (!session) {
            return NextResponse.json(
                { success: false, error: 'Authentication required' },
                { status: 403 }
            );
        }

        const db = await getDB();
        const userId = new ObjectId(id);

        // Check if user exists
        const user = await db.collection(Collections.USERS).findOne({ _id: userId });
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        // Admin account protection
        if (user.isAdmin) {
            return NextResponse.json(
                { success: false, error: 'Cannot delete an admin account' },
                { status: 403 }
            );
        }

        // Safety Check 1: Verify Downlines (Architecture Protection)
        // Check if any users have referredById === userId
        const directDownlinesCount = await db.collection(Collections.USERS).countDocuments({
            referredById: userId
        });

        const directReferrals = user.directReferralCount || 0;
        const totalDownlines = user.totalDownlineCount || 0;

        if (directDownlinesCount > 0 || directReferrals > 0 || totalDownlines > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Cannot delete user because they have active downlines/referrals (${directDownlinesCount || directReferrals} direct, ${totalDownlines} total). Hard deleting a user with downlines breaks the network hierarchy architecture.`
                },
                { status: 400 }
            );
        }

        // Safety Check 2: Verify Trade Power Confirmation
        const activePlansCount = await db.collection(Collections.USER_PLANS).countDocuments({
            userId,
            isActive: true
        });
        const tradePower = user.tradePower || 0;

        let confirmTradePowerDelete = false;
        try {
            const body = await req.json();
            confirmTradePowerDelete = !!body.confirmTradePowerDelete;
        } catch {
            // Request body might be empty if no body was sent
        }

        if ((tradePower > 0 || activePlansCount > 0) && !confirmTradePowerDelete) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'User has active Trade Power or active plans. Explicit confirmation is required to delete Trade Power.'
                },
                { status: 400 }
            );
        }

        // Store parent referrer ID before deleting user document
        const parentId = user.referredById;

        // Perform Permanent Multi-Collection Hard Delete (User-Scoped Only)
        // Note: Do NOT delete referral_earnings where fromUserId === userId for OTHER users, so upline earnings remain intact!
        await Promise.all([
            db.collection(Collections.USERS).deleteOne({ _id: userId }),
            db.collection(Collections.WALLETS).deleteMany({ userId }),
            db.collection(Collections.REFERRAL_WALLETS).deleteMany({ userId }),
            db.collection(Collections.USER_PLANS).deleteMany({ userId }),
            db.collection(Collections.TRANSACTIONS).deleteMany({ userId }),
            db.collection(Collections.WITHDRAWALS).deleteMany({ userId }),
            db.collection(Collections.REFERRAL_EARNINGS).deleteMany({ userId }),
            db.collection(Collections.PAYMENT_TICKETS).deleteMany({ userId }),
            db.collection(Collections.PENDING_REFERRALS).deleteMany({
                $or: [{ userId }, { referrerId: userId }]
            }),
            db.collection(Collections.MILESTONE_AWARDS).deleteMany({ userId }),
            db.collection(Collections.FEATURE_REQUESTS).deleteMany({ userId }),
        ]);

        // Recalculate upline ancestor stats if user had a referrer
        if (parentId) {
            try {
                await updateUserStatsRecursively(parentId);
            } catch (err) {
                console.error('Failed to update upline stats post permanent-delete:', err);
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                message: 'User and all associated records permanently deleted successfully',
                deletedUserId: id
            }
        });

    } catch (error: any) {
        console.error('Error permanently deleting user:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to permanently delete user' },
            { status: 500 }
        );
    }
}
