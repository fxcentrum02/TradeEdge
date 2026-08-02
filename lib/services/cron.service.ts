// ===========================================
// CRON SERVICE
// Centralized service encapsulating cron execution tasks
// ===========================================

import type { NextRequest } from 'next/server';
import { getDB, getBackupDB } from '@/lib/db';
import { ObjectId } from 'mongodb';
import { Collections } from '@/lib/db/collections';
import { processDailyRoiSettlement } from '@/lib/roi';
import { processMilestoneBonusBatch } from '@/lib/milestone';
import { pusherServer } from '@/lib/pusher';
import { remoteLog } from '@/lib/logger';

export interface RoiSettlementTaskResult {
    processed: number;
    totalAmount: number;
    errors: { planId: string; error: string }[];
    expiredPlans: number;
    affectedUserIds: string[];
    settlementTime: string;
}

export interface MilestoneBonusTaskResult {
    totalUsers: number;
    totalNewAwards: number;
    totalUSDT: number;
    errors: { userId: string; error: string }[];
    settlementTime: string;
}

export interface DatabaseBackupTaskResult {
    durationSeconds: string;
    totalDocuments: number;
    results?: Record<string, number | { error: string }>;
}

export interface TaskExecutionStatus<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface DailyCronSummary {
    executionTime: string;
    roiSettlement: TaskExecutionStatus<RoiSettlementTaskResult>;
    milestoneBonus: TaskExecutionStatus<MilestoneBonusTaskResult>;
    databaseBackup: TaskExecutionStatus<DatabaseBackupTaskResult>;
}

/**
 * Validates request authorization headers against Vercel Cron header or CRON_SECRET token.
 */
export function verifyCronAuth(request: NextRequest): boolean {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';
    const isManualWithSecret = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);

    return isVercelCron || isManualWithSecret;
}

/**
 * Helper to normalize MongoDB host for safety verification
 */
function getNormalizedHost(uri: string): string {
    if (!uri) return '';
    try {
        const match = uri.match(/@([^/?#\s]+)/);
        return match ? match[1].trim().toLowerCase() : '';
    } catch {
        return '';
    }
}

/**
 * Executes Step 1: Daily ROI Settlement
 */
export async function executeRoiSettlementTask(): Promise<RoiSettlementTaskResult> {
    const db = await getDB();
    const now = new Date();

    // 1a. Expire completed plans (endDate <= now)
    const expiringPlans = await db.collection(Collections.USER_PLANS)
        .find({ isActive: true, endDate: { $lte: now } })
        .project<{ userId: any }>({ userId: 1 })
        .toArray();

    const userIdsToUpdate = Array.from(new Set(expiringPlans.map(p => p.userId.toString())));

    const expireResult = await db.collection(Collections.USER_PLANS).updateMany(
        { isActive: true, endDate: { $lte: now } },
        { $set: { isActive: false, updatedAt: now } }
    );

    const usersToRefresh = new Set<string | ObjectId>(userIdsToUpdate);

    // 1b. Process daily ROI for active plans
    const result = await processDailyRoiSettlement();
    result.affectedUserIds.forEach(id => usersToRefresh.add(id));

    // 1c. Refresh user stats batch
    const { refreshUserStatsBatch } = await import('@/lib/referral');
    await refreshUserStatsBatch(usersToRefresh);

    const settlementTime = now.toISOString();

    // Notify Pusher channels
    await pusherServer.trigger('admin-notifications', 'cron-event', {
        type: 'ROI_SETTLEMENT',
        message: `ROI Settled: ${result.processed} plans, +$${result.totalAmount.toFixed(2)} USDT`,
        timestamp: settlementTime
    });

    await pusherServer.trigger('global-events', 'roi-settled', { timestamp: settlementTime });

    return {
        processed: result.processed,
        totalAmount: result.totalAmount,
        errors: result.errors,
        expiredPlans: expireResult.modifiedCount,
        affectedUserIds: Array.from(result.affectedUserIds),
        settlementTime
    };
}

/**
 * Executes Step 2: Milestone Bonus Check
 */
export async function executeMilestoneBonusTask(): Promise<MilestoneBonusTaskResult> {
    const now = new Date();
    const result = await processMilestoneBonusBatch();
    const settlementTime = now.toISOString();

    if (result.totalNewAwards > 0) {
        await pusherServer.trigger('admin-notifications', 'cron-event', {
            type: 'MILESTONE_BONUS',
            message: `Milestone Bonuses: ${result.totalNewAwards} awarded | +$${result.totalUSDT.toLocaleString()} USDT`,
            timestamp: settlementTime
        });
    }

    return {
        totalUsers: result.totalUsers,
        totalNewAwards: result.totalNewAwards,
        totalUSDT: result.totalUSDT,
        errors: result.errors,
        settlementTime
    };
}

/**
 * Executes Step 3: Database Backup
 */
export async function executeDatabaseBackupTask(): Promise<DatabaseBackupTaskResult> {
    const sourceUri = process.env.DATABASE_URL!;
    const targetUri = process.env.BACKUP_DATABASE_URL;

    if (!targetUri) {
        remoteLog('Backup failed: BACKUP_DATABASE_URL not configured', {}, 'ERROR');
        throw new Error('BACKUP_DATABASE_URL not configured');
    }

    const sourceHost = getNormalizedHost(sourceUri);
    const targetHost = getNormalizedHost(targetUri);

    if (sourceHost && targetHost && sourceHost === targetHost) {
        throw new Error('Backup target matches source database. Backup aborted for safety.');
    }

    const sourceDb = await getDB();
    const targetDb = await getBackupDB();

    if (!targetDb) {
        remoteLog('Backup failed: targetDb connection failed', {}, 'ERROR');
        throw new Error('Backup DB connection failed');
    }

    const collections = await sourceDb.listCollections().toArray();
    const collectionsToBackup = collections
        .map(c => c.name)
        .filter(name => !name.startsWith('system.'));

    const results: Record<string, number | { error: string }> = {};
    const startTime = Date.now();

    for (const collectionName of collectionsToBackup) {
        try {
            const data = await sourceDb.collection(collectionName).find({}).toArray();
            if (data.length > 0) {
                const tempCollectionName = `${collectionName}_temp`;
                await targetDb.collection(tempCollectionName).drop().catch(() => {});
                await targetDb.collection(tempCollectionName).insertMany(data);
                await targetDb.collection(tempCollectionName).rename(collectionName, { dropTarget: true });
            } else {
                await targetDb.collection(collectionName).deleteMany({});
            }
            results[collectionName] = data.length;
        } catch (err) {
            results[collectionName] = { error: String(err) };
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const totalDocs = Object.values(results).reduce<number>(
        (sum, val) => sum + (typeof val === 'number' ? val : 0),
        0
    );

    remoteLog('Database backup succeeded', { durationSeconds: duration, totalDocuments: totalDocs });

    await pusherServer.trigger('admin-notifications', 'cron-event', {
        type: 'BACKUP',
        message: `Backup Completed: ${totalDocs} documents synced in ${duration}s`,
        timestamp: new Date().toISOString()
    });

    return {
        durationSeconds: duration,
        totalDocuments: totalDocs,
        results
    };
}
