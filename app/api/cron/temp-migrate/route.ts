import { NextRequest, NextResponse } from 'next/server';
import { getDB, getBackupDB, getPaidDB, getFreeDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import { ObjectId, Db } from 'mongodb';

export const dynamic = 'force-dynamic';

async function getReferralTreeByTierForDb(db: Db, userId: ObjectId, maxTier: number = 20) {
    const result: { tier: number; userIds: ObjectId[] }[] = [];
    for (let tier = 1; tier <= maxTier; tier++) {
        result.push({ tier, userIds: [] });
    }

    const aggResult = await db.collection(Collections.USERS).aggregate([
        { $match: { _id: userId } },
        {
            $graphLookup: {
                from: Collections.USERS,
                startWith: '$_id',
                connectFromField: '_id',
                connectToField: 'referredById',
                maxDepth: maxTier - 1,
                depthField: 'depth',
                as: 'descendants'
            }
        },
        {
            $project: {
                _id: 0,
                'descendants._id': 1,
                'descendants.depth': 1
            }
        }
    ]).toArray();

    if (aggResult.length > 0 && aggResult[0].descendants) {
        const descendants = aggResult[0].descendants as { _id: ObjectId; depth: number }[];
        for (const desc of descendants) {
            const tier = desc.depth + 1;
            if (tier >= 1 && tier <= maxTier) {
                result[tier - 1].userIds.push(desc._id);
            }
        }
    }

    return result;
}

async function countAllDescendantsForDb(db: Db, userId: ObjectId) {
    const result = await db.collection(Collections.USERS).aggregate([
        { $match: { _id: userId } },
        {
            $graphLookup: {
                from: Collections.USERS,
                startWith: '$_id',
                connectFromField: '_id',
                connectToField: 'referredById',
                as: 'descendants',
            }
        },
        {
            $project: {
                count: { $size: '$descendants' }
            }
        }
    ]).toArray();

    return result.length > 0 ? result[0].count : 0;
}

async function getTotalReferralEarningsForDb(db: Db, userId: ObjectId) {
    const result = await db.collection(Collections.REFERRAL_EARNINGS)
        .aggregate([
            { $match: { userId: userId } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .toArray();

    return result.length > 0 ? result[0].total : 0;
}

async function getTotalActiveAmountForDb(db: Db, userId: ObjectId) {
    const now = new Date();
    const result = await db.collection(Collections.USER_PLANS)
        .aggregate([
            {
                $match: {
                    userId: userId,
                    isActive: true,
                    endDate: { $gt: now }
                }
            },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .toArray();

    return result.length > 0 ? result[0].total : 0;
}

async function recalculateAndSaveUserStatsForDb(db: Db, userId: ObjectId) {
    const [
        directCount,
        tierTree,
        totalDownline,
        totalEarnings,
        tradePower
    ] = await Promise.all([
        db.collection(Collections.USERS).countDocuments({ referredById: userId }),
        getReferralTreeByTierForDb(db, userId, 20),
        countAllDescendantsForDb(db, userId),
        getTotalReferralEarningsForDb(db, userId),
        getTotalActiveAmountForDb(db, userId)
    ]);

    const totalCount = tierTree.reduce((sum: number, tierData) => sum + tierData.userIds.length, 0);

    await db.collection(Collections.USERS).updateOne(
        { _id: userId },
        {
            $set: {
                directReferralCount: directCount,
                totalReferralCount: totalCount,
                totalDownlineCount: totalDownline,
                totalEarnings: totalEarnings,
                tradePower: tradePower,
                updatedAt: new Date(),
            },
        }
    );
}

async function updateUserStatsRecursivelyForDb(db: Db, userId: ObjectId, depth: number = 0) {
    if (depth > 20) return;
    await recalculateAndSaveUserStatsForDb(db, userId);
    const user = await db.collection(Collections.USERS).findOne({ _id: userId }, { projection: { referredById: 1 } });
    if (user?.referredById) {
        await updateUserStatsRecursivelyForDb(db, user.referredById, depth + 1);
    }
}

async function runMigrationOnDb(db: Db | null): Promise<string[]> {
    const logs: string[] = [];
    if (!db) {
        logs.push("Database connection returned null.");
        return logs;
    }

    try {
        const sourceTgId = '8609520966';
        const targetTgId = '1145942183';

        const sourceUser = await db.collection(Collections.USERS).findOne({ telegramId: sourceTgId });
        const targetUser = await db.collection(Collections.USERS).findOne({ telegramId: targetTgId });

        if (!sourceUser) {
            logs.push(`Source user (tgId: ${sourceTgId}) not found. Skipping migration.`);
            return logs;
        }

        if (!targetUser) {
            logs.push(`Target user (tgId: ${targetTgId}) not found. Skipping migration.`);
            return logs;
        }

        const sourceUserId = sourceUser._id;
        const targetUserId = targetUser._id;

        logs.push(`Found Source User: ID ${sourceUserId}, Name: ${sourceUser.firstName || ''} ${sourceUser.lastName || ''}`);
        logs.push(`Found Target User: ID ${targetUserId}, Name: ${targetUser.firstName || ''} ${targetUser.lastName || ''}`);

        // 1. Move User Plan (Shift startDate/endDate +1 day, reset totalRoiPaid, unset lastRoiDate)
        const plan = await db.collection(Collections.USER_PLANS).findOne({ userId: sourceUserId });
        if (plan) {
            const origStart = new Date(plan.startDate);
            const origEnd = new Date(plan.endDate);
            const newStart = new Date(origStart.getTime() + 24 * 60 * 60 * 1000);
            const newEnd = new Date(origEnd.getTime() + 24 * 60 * 60 * 1000);

            logs.push(`Moving user plan ${plan._id}:`);
            logs.push(`- Original Start: ${plan.startDate} -> New Start: ${newStart.toISOString()}`);
            logs.push(`- Original End: ${plan.endDate} -> New End: ${newEnd.toISOString()}`);

            await db.collection(Collections.USER_PLANS).updateOne(
                { _id: plan._id },
                {
                    $set: {
                        userId: targetUserId,
                        startDate: newStart,
                        endDate: newEnd,
                        totalRoiPaid: 0,
                        updatedAt: new Date()
                    },
                    $unset: {
                        lastRoiDate: ""
                    }
                }
            );
            logs.push(`✅ Plan successfully moved to target user and reset.`);
        } else {
            logs.push(`⚠️ No user plans found for source user.`);
        }

        // 2. Move Payment Ticket
        const ticket = await db.collection(Collections.PAYMENT_TICKETS).findOne({ userId: sourceUserId });
        if (ticket) {
            logs.push(`Moving payment ticket ${ticket._id} to target user.`);
            await db.collection(Collections.PAYMENT_TICKETS).updateOne(
                { _id: ticket._id },
                {
                    $set: {
                        userId: targetUserId,
                        updatedAt: new Date()
                    }
                }
            );
            logs.push(`✅ Payment ticket successfully moved.`);
        } else {
            logs.push(`⚠️ No payment tickets found for source user.`);
        }

        // 3. Move/Delete Transactions
        const depTx = await db.collection(Collections.TRANSACTIONS).findOne({ userId: sourceUserId, type: 'DEPOSIT' });
        if (depTx) {
            logs.push(`Moving DEPOSIT transaction ${depTx._id} to target user.`);
            await db.collection(Collections.TRANSACTIONS).updateOne(
                { _id: depTx._id },
                {
                    $set: {
                        userId: targetUserId
                    }
                }
            );
            logs.push(`✅ DEPOSIT transaction moved.`);
        }

        const roiTxDelete = await db.collection(Collections.TRANSACTIONS).deleteMany({ userId: sourceUserId, type: 'ROI_EARNING' });
        logs.push(`🗑️ Deleted ${roiTxDelete.deletedCount} ROI_EARNING transactions of the source user.`);

        // 4. Revert today's referral earnings distributed to upline from source user
        const refEarnings = await db.collection(Collections.REFERRAL_EARNINGS).find({ fromUserId: sourceUserId }).toArray();
        logs.push(`Found ${refEarnings.length} referral earnings to revert:`);
        for (const re of refEarnings) {
            const rw = await db.collection(Collections.REFERRAL_WALLETS).findOne({ userId: re.userId });
            if (rw) {
                const decrAmount = re.amount;
                const newBalance = Math.max(0, rw.balance - decrAmount);
                logs.push(`- Reverting $${decrAmount} commission for recipient ${re.userId}: Wallet Balance $${rw.balance} -> $${newBalance}`);
                await db.collection(Collections.REFERRAL_WALLETS).updateOne(
                    { userId: re.userId },
                    {
                        $set: {
                            balance: newBalance,
                            updatedAt: new Date()
                        }
                    }
                );
            }

            const txDel = await db.collection(Collections.TRANSACTIONS).deleteMany({
                userId: re.userId,
                type: 'REFERRAL_EARNING',
                reference: plan ? plan._id.toString() : { $exists: true }
            });
            logs.push(`  * Deleted ${txDel.deletedCount} transaction logs for recipient ${re.userId}`);

            await db.collection(Collections.REFERRAL_EARNINGS).deleteOne({ _id: re._id });
            logs.push(`  * Deleted referral earning log ${re._id}`);
        }

        // 5. Delete source user's wallet, referral wallet, and user document
        const delWallet = await db.collection(Collections.WALLETS).deleteOne({ userId: sourceUserId });
        const delRefWallet = await db.collection(Collections.REFERRAL_WALLETS).deleteOne({ userId: sourceUserId });
        const delUser = await db.collection(Collections.USERS).deleteOne({ _id: sourceUserId });
        logs.push(`🗑️ Deleted source user wallet: ${delWallet.deletedCount}, referral wallet: ${delRefWallet.deletedCount}, user: ${delUser.deletedCount}`);

        // 6. Ensure target user has wallets
        const targetWallet = await db.collection(Collections.WALLETS).findOne({ userId: targetUserId });
        if (!targetWallet) {
            await db.collection(Collections.WALLETS).insertOne({
                _id: new ObjectId(),
                userId: targetUserId,
                balance: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            logs.push(`✅ Created wallet for target user.`);
        }
        const targetRefWallet = await db.collection(Collections.REFERRAL_WALLETS).findOne({ userId: targetUserId });
        if (!targetRefWallet) {
            await db.collection(Collections.REFERRAL_WALLETS).insertOne({
                _id: new ObjectId(),
                userId: targetUserId,
                balance: 0,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            logs.push(`✅ Created referral wallet for target user.`);
        }

        // 7. Update Stats recursively
        if (sourceUser.referredById) {
            logs.push(`Recalculating stats recursively for source user upline starting from: ${sourceUser.referredById}`);
            await updateUserStatsRecursivelyForDb(db, new ObjectId(sourceUser.referredById));
        }

        logs.push(`Recalculating stats recursively for target user and upline starting from: ${targetUserId}`);
        await updateUserStatsRecursivelyForDb(db, targetUserId);

        // 8. Fix duplicate milestone transaction for Raj Pandey (userId: 69be21cffe89f0a8d9f1ac91)
        const targetUserIdFix = new ObjectId('69be21cffe89f0a8d9f1ac91');
        const fixResult = await db.collection(Collections.TRANSACTIONS).deleteOne({
            userId: targetUserIdFix,
            type: 'REFERRAL_EARNING',
            amount: 150,
            description: 'Milestone Bonus: 5,000 USDT threshold reached'
        });
        if (fixResult.deletedCount > 0) {
            logs.push(`✅ Successfully deleted duplicate REFERRAL_EARNING transaction for Raj Pandey.`);
        } else {
            logs.push(`ℹ️ Duplicate transaction for Raj Pandey not found or already deleted.`);
        }

        logs.push(`✅ Migration completed successfully on this database!`);

    } catch (e: any) {
        logs.push(`❌ Migration failed due to error: ${e.message || e}`);
    }

    return logs;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');
        const cronSecret = process.env.CRON_SECRET;

        if (!cronSecret || secret !== cronSecret) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const results: any = {};

        // Try Main DB
        try {
            const db = await getDB();
            results['MAIN_DATABASE'] = await runMigrationOnDb(db);
        } catch (e: any) {
            results['MAIN_DATABASE'] = [`Connection failed: ${e.message || e}`];
        }

        // Try Paid DB
        try {
            const db = await getPaidDB();
            results['PAID_DATABASE'] = await runMigrationOnDb(db);
        } catch (e: any) {
            results['PAID_DATABASE'] = [`Connection failed: ${e.message || e}`];
        }

        // Try Free DB
        try {
            const db = await getFreeDB();
            results['FREE_DATABASE'] = await runMigrationOnDb(db);
        } catch (e: any) {
            results['FREE_DATABASE'] = [`Connection failed: ${e.message || e}`];
        }

        // Try Backup DB
        try {
            const db = await getBackupDB();
            results['BACKUP_DATABASE'] = await runMigrationOnDb(db);
        } catch (e: any) {
            results['BACKUP_DATABASE'] = [`Connection failed: ${e.message || e}`];
        }

        return NextResponse.json({
            success: true,
            results
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message || 'Migration API failed'
        }, { status: 500 });
    }
}
