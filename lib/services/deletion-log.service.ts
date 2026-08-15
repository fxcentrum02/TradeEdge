// ===========================================
// DELETION LOG SERVICE & AUDIT LAYER
// ===========================================

import { Db, ObjectId } from 'mongodb';
import { NextRequest } from 'next/server';
import { Collections } from '../db/collections';
import type {
    UserDocument,
    DeletionLogDocument,
    ActivePlanSnapshotItem,
    PendingWithdrawalSnapshotItem,
    CompletedWithdrawalSnapshotItem
} from '../db/types';
import type { AdminSessionPayload } from '@/types';
import { updateUserStatsRecursively } from '../referral';

export class DeletionLogService {
    /**
     * Extracts reliable client IP from headers or connection.
     */
    static extractClientIp(req: NextRequest): string {
        const forwarded = req.headers.get('x-forwarded-for');
        const realIp = req.headers.get('x-real-ip');
        if (forwarded) {
            return forwarded.split(',')[0].trim();
        }
        if (realIp) {
            return realIp.trim();
        }
        return (req as any).ip || '127.0.0.1';
    }

    /**
     * Identifies operating system/device category from request metadata.
     */
    static detectDevice(req: NextRequest, userAgent: string): string {
        const secChUaPlatform = req.headers.get('sec-ch-ua-platform')?.replace(/"/g, '')?.trim();
        if (secChUaPlatform) {
            return secChUaPlatform;
        }

        if (/android/i.test(userAgent)) return 'Android';
        if (/iphone|ipad|ipod/i.test(userAgent)) return 'iOS';
        if (/macintosh|mac os x/i.test(userAgent)) return 'macOS';
        if (/windows/i.test(userAgent)) return 'Windows';
        if (/linux/i.test(userAgent)) return 'Linux';
        return 'Unknown Device';
    }

    /**
     * Captures a comprehensive financial, plan & network snapshot of a user before deletion,
     * and inserts the audit record into the `deletion_logs` collection.
     */
    static async recordUserDeletionSnapshot(
        db: Db,
        user: UserDocument,
        session: AdminSessionPayload,
        req: NextRequest,
        deletionType: 'PERMANENT' | 'SOFT',
        authPasswordDetails?: { personName: string; passwordKey: string }
    ): Promise<DeletionLogDocument> {
        const userId = user._id;
        const parentId = user.referredById;

        // Perform parallel queries for related financial entities and master plans
        const [withdrawals, userPlans, wallet, refWallet, referrerDoc, adminDoc, masterPlans] = await Promise.all([
            db.collection(Collections.WITHDRAWALS).find({ userId }).toArray(),
            db.collection(Collections.USER_PLANS).find({ userId }).toArray(),
            db.collection(Collections.WALLETS).findOne({ userId }),
            db.collection(Collections.REFERRAL_WALLETS).findOne({ userId }),
            parentId ? db.collection(Collections.USERS).findOne({ _id: parentId }) : null,
            ObjectId.isValid(session.adminId)
                ? db.collection(Collections.ADMINS).findOne({ _id: new ObjectId(session.adminId) })
                : null,
            db.collection(Collections.PLANS).find({}).toArray()
        ]);

        const masterPlanMap = new Map<string, any>();
        for (const p of masterPlans) {
            masterPlanMap.set(p._id.toString(), p);
        }

        // Aggregate withdrawals & build snapshot items
        let totalCompletedAmount = 0;
        let totalCompletedCount = 0;
        let totalRequestedAmount = 0;
        let totalPendingAmount = 0;
        const pendingWithdrawalsSnapshot: PendingWithdrawalSnapshotItem[] = [];
        const completedWithdrawalsSnapshot: CompletedWithdrawalSnapshotItem[] = [];

        for (const w of withdrawals) {
            const amt = Number(w.amount) || 0;
            totalRequestedAmount += amt;

            if (w.status === 'COMPLETED') {
                totalCompletedAmount += amt;
                totalCompletedCount++;
                completedWithdrawalsSnapshot.push({
                    _id: w._id,
                    amount: amt,
                    fee: Number(w.fee) || 0,
                    netAmount: Number(w.netAmount) || amt,
                    walletAddress: w.walletAddress || '',
                    network: w.network || 'BEP20',
                    processedAt: w.processedAt || w.updatedAt,
                    createdAt: w.createdAt || new Date()
                });
            } else if (w.status === 'PENDING') {
                totalPendingAmount += amt;
                pendingWithdrawalsSnapshot.push({
                    _id: w._id,
                    amount: amt,
                    fee: Number(w.fee) || 0,
                    netAmount: Number(w.netAmount) || amt,
                    walletAddress: w.walletAddress || '',
                    network: w.network || 'BEP20',
                    createdAt: w.createdAt || new Date()
                });
            }
        }

        // Aggregate plans & build active plans snapshot
        let totalReinvested = 0;
        let activePlansCount = 0;
        const activePlansSnapshot: ActivePlanSnapshotItem[] = [];

        for (const p of userPlans) {
            const planAmt = Number(p.amount) || 0;
            if (p.isReinvest) {
                totalReinvested += planAmt;
            }

            if (p.isActive && !p.isDeleted) {
                activePlansCount++;
                const master = masterPlanMap.get(p.planId?.toString());
                const dailyRate = Number(master?.dailyRoiRate) || (p.isReinvest ? 0.004 : 0.008);
                const totalDurationDays = master?.durationDays || (p.isReinvest ? 500 : 250);
                const totalPaid = Number(p.totalRoiPaid) || 0;
                const completedRoiDays = (planAmt > 0 && dailyRate > 0)
                    ? Math.round(totalPaid / (planAmt * dailyRate))
                    : 0;
                const remainingDurationDays = Math.max(0, totalDurationDays - completedRoiDays);

                activePlansSnapshot.push({
                    _id: p._id,
                    planId: p.planId,
                    planName: master?.name || (p.isReinvest ? 'Reinvestment Plan' : 'Standard Plan'),
                    amount: planAmt,
                    startDate: p.startDate || new Date(),
                    endDate: p.endDate || new Date(),
                    isReinvest: !!p.isReinvest,
                    totalRoiPaid: totalPaid,
                    lastRoiDate: p.lastRoiDate,
                    completedRoiDays,
                    remainingDurationDays,
                    totalDurationDays,
                    dailyRoiRate: dailyRate
                });
            }
        }

        const ip = this.extractClientIp(req);
        const userAgent = req.headers.get('user-agent') || 'Unknown';
        const device = this.detectDevice(req, userAgent);

        const deletionLogRecord: DeletionLogDocument = {
            deletedUserId: userId,
            userSnapshot: {
                telegramId: user.telegramId,
                telegramUsername: user.telegramUsername,
                firstName: user.firstName,
                lastName: user.lastName,
                referralCode: user.referralCode,
                tradePower: user.tradePower || 0,
                downlineTradePower: user.downlineTradePower || 0,
                totalReinvested,
                walletBalance: wallet?.balance || 0,
                referralWalletBalance: refWallet?.balance || 0,
                walletDetails: {
                    balance: wallet?.balance || 0,
                    totalWithdrawn: wallet?.totalWithdrawn || totalCompletedAmount,
                    totalDeposited: wallet?.totalDeposited || 0
                },
                referralWalletDetails: {
                    balance: refWallet?.balance || 0,
                    totalEarned: refWallet?.totalEarned || 0
                },
                withdrawals: {
                    totalCompletedAmount,
                    totalCompletedCount,
                    totalRequestedAmount,
                    totalPendingAmount
                },
                referral: {
                    referredById: user.referredById || null,
                    ancestors: user.ancestors || [],
                    referrerName: referrerDoc
                        ? `${referrerDoc.firstName || ''} ${referrerDoc.lastName || ''}`.trim() || referrerDoc.telegramUsername
                        : undefined,
                    referrerTelegramId: referrerDoc?.telegramId,
                    directReferralCount: user.directReferralCount || 0,
                    totalDownlineCount: user.totalDownlineCount || 0
                },
                activePlansCount,
                totalPlansCount: userPlans.length,
                activePlansSnapshot,
                pendingWithdrawalsSnapshot,
                completedWithdrawalsSnapshot,
                userCreatedAt: user.createdAt
            },
            deletedBy: {
                adminId: session.adminId,
                email: session.email,
                name: adminDoc?.name || undefined,
                role: session.role
            },
            authorizedByPassword: authPasswordDetails,
            ip,
            userAgent,
            device,
            deletedAt: new Date(),
            deletionType
        };

        const result = await db.collection(Collections.DELETION_LOGS).insertOne(deletionLogRecord);
        deletionLogRecord._id = result.insertedId;

        return deletionLogRecord;
    }

    /**
     * Intelligently restores a deleted user from their snapshot:
     * 1. Recreates user account in `users`.
     * 2. Re-links to active upline sponsor or fallback ancestor.
     * 3. Recreates wallets and referral wallets with exact snapshot balances.
     * 4. Resumes active plans by shifting dates (pauses plan during deletion, resumes remaining days from today).
     * 5. Restores pending and completed withdrawals.
     * 6. Recursively recalculates upline network statistics.
     * 7. Marks deletion log as restored and logs audit transaction.
     */
    static async restoreUserFromSnapshot(
        db: Db,
        logId: string | ObjectId,
        adminSession: AdminSessionPayload,
        authPasswordDetails?: { personName: string; passwordKey: string }
    ): Promise<{ success: boolean; user: any; message: string }> {
        const logObjectId = typeof logId === 'string' ? new ObjectId(logId) : logId;
        const log = await db.collection<DeletionLogDocument>(Collections.DELETION_LOGS).findOne({ _id: logObjectId });

        if (!log) {
            throw new Error('Deletion log record not found');
        }

        if (log.isRestored) {
            throw new Error(`This user was already restored on ${log.restoredAt ? new Date(log.restoredAt).toLocaleDateString() : 'N/A'} by ${log.restoredByPassword?.personName || log.restoredBy?.name || 'Admin'}`);
        }

        const snapshot = log.userSnapshot;
        const userId = log.deletedUserId;

        // 1. Guard against duplicate active user conflict
        const existingUser = await db.collection(Collections.USERS).findOne({
            $or: [
                { _id: userId },
                { telegramId: snapshot.telegramId }
            ]
        });

        if (existingUser && !existingUser.isDeleted) {
            throw new Error(`An active user with Telegram ID ${snapshot.telegramId} already exists in the system`);
        }

        // 2. Resolve Upline Hierarchy
        let uplineId: ObjectId | null = snapshot.referral?.referredById ? new ObjectId(snapshot.referral.referredById) : null;
        let ancestors: ObjectId[] = [];

        if (uplineId) {
            const uplineDoc = await db.collection(Collections.USERS).findOne({ _id: uplineId });
            if (uplineDoc && !uplineDoc.isDeleted) {
                ancestors = [uplineId, ...(uplineDoc.ancestors || [])];
            } else {
                // Sponsor was deleted or missing -> check ancestors chain
                uplineId = null;
                if (snapshot.referral?.ancestors && snapshot.referral.ancestors.length > 0) {
                    for (const ancId of snapshot.referral.ancestors) {
                        const ancDoc = await db.collection(Collections.USERS).findOne({ _id: new ObjectId(ancId) });
                        if (ancDoc && !ancDoc.isDeleted) {
                            uplineId = ancDoc._id;
                            ancestors = [ancDoc._id, ...(ancDoc.ancestors || [])];
                            break;
                        }
                    }
                }
            }
        }

        const now = new Date();

        // 3. User Document
        const userDoc: Partial<UserDocument> = {
            _id: userId,
            telegramId: snapshot.telegramId,
            telegramUsername: snapshot.telegramUsername || undefined,
            firstName: snapshot.firstName || 'User',
            lastName: snapshot.lastName || '',
            referralCode: snapshot.referralCode,
            referredById: uplineId,
            ancestors,
            tradePower: snapshot.tradePower || 0,
            downlineTradePower: snapshot.downlineTradePower || 0,
            directReferralCount: snapshot.referral?.directReferralCount || 0,
            totalReferralCount: snapshot.referral?.directReferralCount || 0,
            totalDownlineCount: snapshot.referral?.totalDownlineCount || 0,
            totalEarnings: snapshot.referralWalletDetails?.totalEarned || 0,
            isActive: true,
            isDeleted: false,
            createdAt: snapshot.userCreatedAt ? new Date(snapshot.userCreatedAt) : now,
            updatedAt: now
        };

        // 4. Wallet Documents
        const walletDoc = {
            userId,
            balance: snapshot.walletBalance || 0,
            totalWithdrawn: snapshot.walletDetails?.totalWithdrawn || snapshot.withdrawals?.totalCompletedAmount || 0,
            totalDeposited: snapshot.walletDetails?.totalDeposited || 0,
            createdAt: now,
            updatedAt: now
        };

        const refWalletDoc = {
            userId,
            balance: snapshot.referralWalletBalance || 0,
            totalEarned: snapshot.referralWalletDetails?.totalEarned || 0,
            createdAt: now,
            updatedAt: now
        };

        // 5. Active Plans Date Shift (Pause during deletion, resume remaining days starting today)
        const plansToInsert: any[] = [];
        if (snapshot.activePlansSnapshot && snapshot.activePlansSnapshot.length > 0) {
            for (const plan of snapshot.activePlansSnapshot) {
                const completedDays = Number(plan.completedRoiDays) || 0;
                const remainingDays = Number(plan.remainingDurationDays) || Math.max(1, (plan.totalDurationDays || 250) - completedDays);

                const newStartDate = new Date(now.getTime() - completedDays * 86400000);
                const newEndDate = new Date(now.getTime() + remainingDays * 86400000);

                plansToInsert.push({
                    _id: plan._id ? new ObjectId(plan._id) : new ObjectId(),
                    userId,
                    planId: new ObjectId(plan.planId),
                    amount: plan.amount,
                    startDate: newStartDate,
                    endDate: newEndDate,
                    isActive: true,
                    isReinvest: !!plan.isReinvest,
                    totalRoiPaid: plan.totalRoiPaid || 0,
                    lastRoiDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 4, 30, 0, 0), // Today's base
                    createdAt: plan.startDate ? new Date(plan.startDate) : now,
                    updatedAt: now
                });
            }
        }

        // 6. Withdrawals to restore
        const withdrawalsToInsert: any[] = [];
        if (snapshot.pendingWithdrawalsSnapshot) {
            for (const w of snapshot.pendingWithdrawalsSnapshot) {
                withdrawalsToInsert.push({
                    _id: new ObjectId(w._id),
                    userId,
                    amount: w.amount,
                    fee: w.fee,
                    netAmount: w.netAmount,
                    walletAddress: w.walletAddress,
                    network: w.network || 'BEP20',
                    status: 'PENDING',
                    createdAt: new Date(w.createdAt),
                    updatedAt: now
                });
            }
        }
        if (snapshot.completedWithdrawalsSnapshot) {
            for (const w of snapshot.completedWithdrawalsSnapshot) {
                withdrawalsToInsert.push({
                    _id: new ObjectId(w._id),
                    userId,
                    amount: w.amount,
                    fee: w.fee,
                    netAmount: w.netAmount,
                    walletAddress: w.walletAddress,
                    network: w.network || 'BEP20',
                    status: 'COMPLETED',
                    processedAt: w.processedAt ? new Date(w.processedAt) : now,
                    createdAt: new Date(w.createdAt),
                    updatedAt: w.processedAt ? new Date(w.processedAt) : now
                });
            }
        }

        // 7. Write to Database
        await db.collection(Collections.USERS).replaceOne({ _id: userId }, userDoc, { upsert: true });
        await db.collection(Collections.WALLETS).replaceOne({ userId }, walletDoc, { upsert: true });
        await db.collection(Collections.REFERRAL_WALLETS).replaceOne({ userId }, refWalletDoc, { upsert: true });

        for (const p of plansToInsert) {
            await db.collection(Collections.USER_PLANS).replaceOne({ _id: p._id }, p, { upsert: true });
        }

        for (const w of withdrawalsToInsert) {
            await db.collection(Collections.WITHDRAWALS).replaceOne({ _id: w._id }, w, { upsert: true });
        }

        // 8. Audit Transaction
        const adminDoc = ObjectId.isValid(adminSession.adminId)
            ? await db.collection(Collections.ADMINS).findOne({ _id: new ObjectId(adminSession.adminId) })
            : null;

        await db.collection(Collections.TRANSACTIONS).insertOne({
            userId,
            type: 'ADMIN_CREDIT',
            amount: 0,
            fee: 0,
            netAmount: 0,
            balanceAfter: snapshot.walletBalance || 0,
            description: `Account restored by ${authPasswordDetails?.personName || adminDoc?.name || 'Admin'} from deletion snapshot`,
            status: 'COMPLETED',
            createdAt: now,
            updatedAt: now
        });

        // 9. Update Deletion Log status
        await db.collection(Collections.DELETION_LOGS).updateOne(
            { _id: logObjectId },
            {
                $set: {
                    isRestored: true,
                    restoredAt: now,
                    restoredBy: {
                        adminId: adminSession.adminId,
                        email: adminSession.email,
                        name: adminDoc?.name || undefined,
                        role: adminSession.role
                    },
                    restoredByPassword: authPasswordDetails,
                    restorationNotes: `Restored under upline: ${uplineId ? uplineId.toString() : 'None (Root)'}. ${plansToInsert.length} active plans resumed.`
                }
            }
        );

        // 10. Recalculate Upline Tree Stats
        if (uplineId) {
            try {
                await updateUserStatsRecursively(uplineId);
            } catch (err) {
                console.error('Failed to recursively update upline stats during restoration:', err);
            }
        }

        return {
            success: true,
            user: userDoc,
            message: `User ${snapshot.firstName} ${snapshot.lastName || ''} (@${snapshot.telegramUsername || snapshot.telegramId}) successfully restored!`
        };
    }

    /**
     * Retrieve all deletion logs sorted by newest first.
     */
    static async getDeletionLogs(db: Db, limit: number = 100): Promise<DeletionLogDocument[]> {
        return db
            .collection(Collections.DELETION_LOGS)
            .find({})
            .sort({ deletedAt: -1 })
            .limit(limit)
            .toArray() as Promise<DeletionLogDocument[]>;
    }
}
