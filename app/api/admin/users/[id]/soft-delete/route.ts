import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import { ObjectId } from 'mongodb';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { updateUserStatsRecursively } from '@/lib/referral';
import { DeletionLogService } from '@/lib/services/deletion-log.service';
import { verifyDeletionPassword } from '@/lib/constants';

export async function POST(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        if (!ObjectId.isValid(id)) {
            return NextResponse.json(
                { success: false, error: 'Invalid user ID format' },
                { status: 400 }
            );
        }

        // Authenticate as Admin
        const session = await getAdminSessionFromRequest(req);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const db = await getDB();
        const userId = new ObjectId(id);
        const now = new Date();

        // Check if user exists
        const user = await db.collection(Collections.USERS).findOne({ _id: userId });
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'User not found' },
                { status: 404 }
            );
        }

        if (user.isAdmin) {
            return NextResponse.json(
                { success: false, error: 'Cannot soft delete an admin account' },
                { status: 403 }
            );
        }

        let deletionPassword = '';
        try {
            const body = await req.json();
            deletionPassword = body.deletionPassword || body.password || '';
        } catch {
            // Request body might be empty
        }

        // Verify Deletion Authorization Password
        const authCheck = verifyDeletionPassword(deletionPassword);
        if (!authCheck.valid) {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Invalid or missing deletion authorization password. Valid security password is required.'
                },
                { status: 401 }
            );
        }

        // Audit snapshot before soft deletion with authorization trace
        await DeletionLogService.recordUserDeletionSnapshot(
            db,
            user as any,
            session,
            req,
            'SOFT',
            {
                personName: authCheck.personName!,
                passwordKey: authCheck.passwordKey!
            }
        );

        // Perform Soft Delete
        // 1. Update User Document
        await db.collection(Collections.USERS).updateOne(
            { _id: userId },
            {
                $set: {
                    isActive: false,
                    isDeleted: true,
                    deletedAt: now,
                    updatedAt: now,
                }
            }
        );

        // 2. Update all active plans for this user
        const plansUpdateResult = await db.collection(Collections.USER_PLANS).updateMany(
            { userId: userId, isActive: true },
            {
                $set: {
                    isActive: false,
                    isDeleted: true,
                    deletedAt: now,
                    updatedAt: now,
                }
            }
        );
        // 3. Update upline stats recursively to sync tradePower and downline counts
        try {
            await updateUserStatsRecursively(userId);
        } catch (err) {
            console.error('Failed to recursively update stats on soft-delete:', err);
        }

        return NextResponse.json({
            success: true,
            data: {
                message: 'User and active plans successfully soft-deleted',
                plansAffected: plansUpdateResult.modifiedCount
            }
        });
    } catch (error: any) {
        console.error('Error soft deleting user:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to soft delete user' },
            { status: 500 }
        );
    }
}
