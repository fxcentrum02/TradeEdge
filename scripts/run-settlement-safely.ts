// ==========================================================
// SCRIPT: Safe ROI Settlement Runner & Inspector
// Usage:
//   Dry Run (Inspect Pending Payouts): npx tsx scripts/run-settlement-safely.ts --dry-run
//   Safe Execution: npx tsx scripts/run-settlement-safely.ts --execute
// ==========================================================

import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env manually
try {
    const envPath = resolve(__dirname, '../.env');
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
    }
} catch { /* ignore */ }

const isExecute = process.argv.includes('--execute');

async function runSafeSettlement() {
    const uri = process.env.DATABASE_URL;
    const dbName = process.env.MONGODB_DB_NAME || 'TradeEdge';

    if (!uri) {
        console.error('❌ DATABASE_URL is missing in environment.');
        process.exit(1);
    }

    console.log(`\n==================================================`);
    console.log(`🛡️  SAFE ROI SETTLEMENT INSPECTOR & RUNNER`);
    console.log(`    Mode: ${isExecute ? '⚡ LIVE EXECUTION ⚡' : '🔍 DRY-RUN INSPECTION 🔍'}`);
    console.log(`==================================================\n`);

    const client = await MongoClient.connect(uri);
    const db = client.db(dbName);

    try {
        const now = new Date();
        const shifted = new Date(now.getTime() - (4 * 60 + 30) * 60 * 1000);
        const todaySettlementStart = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
        const currentSettlementThreshold = new Date(todaySettlementStart.getTime() + (4 * 60 + 30) * 60 * 1000);

        console.log(`🕒 Current Time (UTC): ${now.toISOString()}`);
        console.log(`🕒 Target Settlement Cycle Threshold: ${currentSettlementThreshold.toISOString()}`);

        // 1. Find eligible user plans
        const eligiblePlans = await db.collection('user_plans').aggregate([
            {
                $match: {
                    isActive: true,
                    isDeleted: { $ne: true },
                    endDate: { $gt: now },
                    $or: [
                        { lastRoiDate: { $exists: false } },
                        { lastRoiDate: { $lt: currentSettlementThreshold } },
                    ],
                }
            },
            {
                $lookup: {
                    from: 'plans',
                    localField: 'planId',
                    foreignField: '_id',
                    as: 'planData'
                }
            },
            { $unwind: '$planData' }
        ]).toArray();

        console.log(`\n📊 Eligible User Plans Pending Settlement: ${eligiblePlans.length}`);

        if (eligiblePlans.length === 0) {
            console.log('✅ No plans are currently pending settlement for today! All active plans are up-to-date.');
            return;
        }

        let totalPendingRoiUSDT = 0;
        const userRoiMap = new Map<string, { count: number; totalUSDT: number }>();

        for (const up of eligiblePlans) {
            const lastRoi = up.lastRoiDate ? new Date(up.lastRoiDate) : new Date(up.startDate);
            const shiftedLast = new Date(lastRoi.getTime() - (4 * 60 + 30) * 60 * 1000);
            const lastRoiSettlementStart = new Date(Date.UTC(shiftedLast.getUTCFullYear(), shiftedLast.getUTCMonth(), shiftedLast.getUTCDate()));

            const msPerDay = 1000 * 60 * 60 * 24;
            const daysToPay = Math.floor((todaySettlementStart.getTime() - lastRoiSettlementStart.getTime()) / msPerDay);

            if (daysToPay <= 0) continue;

            const dailyRoiAmount = (up.amount * up.planData.dailyRoi) / 100;
            const totalCatchUpAmount = dailyRoiAmount * daysToPay;

            totalPendingRoiUSDT += totalCatchUpAmount;
            const uidStr = up.userId.toString();
            const curr = userRoiMap.get(uidStr) || { count: 0, totalUSDT: 0 };
            userRoiMap.set(uidStr, { count: curr.count + 1, totalUSDT: curr.totalUSDT + totalCatchUpAmount });
        }

        console.log(`💰 Total ROI Amount to be Settled: $${totalPendingRoiUSDT.toFixed(2)} USDT`);
        console.log(`👥 Unique Users Affected: ${userRoiMap.size}`);

        console.log('\nTop 5 Pending User Payout Summaries:');
        let idx = 1;
        for (const [uid, info] of Array.from(userRoiMap.entries()).slice(0, 5)) {
            console.log(`  ${idx++}. User ${uid}: ${info.count} plan(s) -> +$${info.totalUSDT.toFixed(2)} USDT`);
        }

        if (!isExecute) {
            console.log(`\n🔍 [INSPECTION COMPLETE] No changes were written to the database.`);
            console.log(`👉 To safely execute this settlement, run: npx tsx scripts/run-settlement-safely.ts --execute`);
            return;
        }

        // EXECUTE MODE
        console.log(`\n⚡ EXECUTING SETTLEMENT SAFELY...`);
        const { executeRoiSettlementTask, executeMilestoneBonusTask } = await import('../lib/services/cron.service');
        
        console.log('[Settlement] Step 1: Running ROI Settlement Task...');
        const roiResult = await executeRoiSettlementTask();
        console.log('✅ ROI Settlement Task Completed:', roiResult);

        console.log('[Settlement] Step 2: Running Milestone Bonus Check Task...');
        const milestoneResult = await executeMilestoneBonusTask();
        console.log('✅ Milestone Bonus Task Completed:', milestoneResult);

        console.log('\n==================================================');
        console.log('🎉 TODAY\'S SETTLEMENT COMPLETED SUCCESSFULLY!');
        console.log(`   Processed Plans: ${roiResult.processed}`);
        console.log(`   Total ROI Settled: $${roiResult.totalAmount.toFixed(2)} USDT`);
        console.log(`   Expired Plans: ${roiResult.expiredPlans}`);
        console.log(`   Milestone Awards: ${milestoneResult.totalNewAwards}`);
        console.log('==================================================\n');

    } catch (error) {
        console.error('❌ Error during safe settlement execution:', error);
    } finally {
        await client.close();
    }
}

runSafeSettlement();
