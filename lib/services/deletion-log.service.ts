// ===========================================
// DELETION LOG SERVICE & AUDIT LAYER
// ===========================================

import { Db, ObjectId } from 'mongodb';
import { NextRequest } from 'next/server';
import { Collections } from '../db/collections';
import type { UserDocument, DeletionLogDocument } from '../db/types';
import type { AdminSessionPayload } from '@/types';

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
     * Captures a comprehensive financial & network snapshot of a user before deletion,
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

        // Perform parallel queries for related financial entities
        const [withdrawals, userPlans, wallet, refWallet, referrerDoc, adminDoc] = await Promise.all([
            db.collection(Collections.WITHDRAWALS).find({ userId }).toArray(),
            db.collection(Collections.USER_PLANS).find({ userId }).toArray(),
            db.collection(Collections.WALLETS).findOne({ userId }),
            db.collection(Collections.REFERRAL_WALLETS).findOne({ userId }),
            parentId ? db.collection(Collections.USERS).findOne({ _id: parentId }) : null,
            ObjectId.isValid(session.adminId)
                ? db.collection(Collections.ADMINS).findOne({ _id: new ObjectId(session.adminId) })
                : null,
        ]);

        // Aggregate withdrawals
        let totalCompletedAmount = 0;
        let totalCompletedCount = 0;
        let totalRequestedAmount = 0;
        let totalPendingAmount = 0;

        for (const w of withdrawals) {
            const amt = Number(w.amount) || 0;
            totalRequestedAmount += amt;
            if (w.status === 'COMPLETED') {
                totalCompletedAmount += amt;
                totalCompletedCount++;
            } else if (w.status === 'PENDING') {
                totalPendingAmount += amt;
            }
        }

        // Aggregate plans & reinvestments
        let totalReinvested = 0;
        let activePlansCount = 0;

        for (const p of userPlans) {
            if (p.isReinvest) {
                totalReinvested += Number(p.amount) || 0;
            }
            if (p.isActive && !p.isDeleted) {
                activePlansCount++;
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
                totalReinvested,
                walletBalance: wallet?.balance || 0,
                referralWalletBalance: refWallet?.balance || 0,
                withdrawals: {
                    totalCompletedAmount,
                    totalCompletedCount,
                    totalRequestedAmount,
                    totalPendingAmount,
                },
                referral: {
                    referredById: user.referredById || null,
                    referrerName: referrerDoc
                        ? `${referrerDoc.firstName || ''} ${referrerDoc.lastName || ''}`.trim() || referrerDoc.telegramUsername
                        : undefined,
                    referrerTelegramId: referrerDoc?.telegramId,
                    directReferralCount: user.directReferralCount || 0,
                    totalDownlineCount: user.totalDownlineCount || 0,
                },
                activePlansCount,
                totalPlansCount: userPlans.length,
                userCreatedAt: user.createdAt,
            },
            deletedBy: {
                adminId: session.adminId,
                email: session.email,
                name: adminDoc?.name || undefined,
                role: session.role,
            },
            authorizedByPassword: authPasswordDetails,
            ip,
            userAgent,
            device,
            deletedAt: new Date(),
            deletionType,
        };

        const result = await db.collection(Collections.DELETION_LOGS).insertOne(deletionLogRecord);
        deletionLogRecord._id = result.insertedId;

        return deletionLogRecord;
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
