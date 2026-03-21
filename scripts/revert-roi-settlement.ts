// ===========================================
// REVERT ROI SETTLEMENT: Safety Tool
// Usage: npx tsx scripts/revert-roi-settlement.ts [YYYY-MM-DD]
// ===========================================

import { getDB } from '../lib/db';
import { Collections } from '../lib/db/collections';
import { ObjectId } from 'mongodb';

async function main() {
    const db = await getDB();
    const args = process.argv.slice(2);
    
    // Determine the target settlement window
    // Default to today if no date provided
    const now = new Date();
    const targetDate = args[0] ? new Date(args[0]) : now;
    
    // The settlement cycle starts at 04:30 UTC. 
    // We target logs created within a 1-hour window around the expected settlement time 
    // or simply within the "settlement day".
    const shifted = new Date(targetDate.getTime() - (4 * 60 + 30) * 60 * 1000);
    const windowStart = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
    const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000);

    console.log(`========================================`);
    console.log(`DANGER ZONE: REVERTING ROI SETTLEMENT`);
    console.log(`Target Window: ${windowStart.toISOString()} to ${windowEnd.toISOString()}`);
    console.log(`========================================\n`);

    // 1. Identify records to reverse
    const roiTx = await db.collection(Collections.TRANSACTIONS).find({
        type: 'ROI_EARNING',
        createdAt: { $gte: windowStart, $lte: windowEnd }
    }).toArray();

    const refEarnings = await db.collection(Collections.REFERRAL_EARNINGS).find({
        sourceType: 'roi_settlement',
        createdAt: { $gte: windowStart, $lte: windowEnd }
    }).toArray();

    if (roiTx.length === 0 && refEarnings.length === 0) {
        console.log('No settlement records found for this period. Aborting.');
        return;
    }

    console.log(`Found ${roiTx.length} ROI transactions and ${refEarnings.length} referral earnings to reverse.`);
    console.log('This will deduct these amounts from user balances and reset plan dates.\n');

    const walletUpdates = new Map<string, number>(); // userId -> amount to DEDUCT (negative)
    const refWalletUpdates = new Map<string, number>(); // userId -> amount to DEDUCT
    const planReversions = new Map<string, { amount: number }>(); // planId -> combined ROI to subtract

    // Process ROI Transactions
    for (const tx of roiTx) {
        const uid = tx.userId.toString();
        walletUpdates.set(uid, (walletUpdates.get(uid) || 0) - tx.amount);
        
        const pid = tx.reference;
        if (pid) {
            planReversions.set(pid, { amount: (planReversions.get(pid)?.amount || 0) + tx.amount });
        }
    }

    // Process Referral Earnings
    for (const earn of refEarnings) {
        const uid = earn.userId.toString();
        refWalletUpdates.set(uid, (refWalletUpdates.get(uid) || 0) - earn.amount);
    }

    const totalAffectedUsers = new Set([...walletUpdates.keys(), ...refWalletUpdates.keys()]);

    console.log(`Affected Users: ${totalAffectedUsers.size}`);
    console.log(`Total ROI to reverse: ${Array.from(planReversions.values()).reduce((s,v) => s+v.amount, 0).toFixed(2)} USDT`);
    console.log(`Total Referral to reverse: ${Math.abs(Array.from(refWalletUpdates.values()).reduce((s,v) => s+v, 0)).toFixed(4)} USDT\n`);

    // 2. Perform Reversal in Bulk
    const bulkOps: Promise<any>[] = [];

    // Reverse Wallets
    if (walletUpdates.size > 0) {
        const bulk = Array.from(walletUpdates.entries()).map(([uid, amt]) => ({
            updateOne: {
                filter: { userId: new ObjectId(uid) },
                update: { $inc: { balance: amt }, $set: { updatedAt: now } }
            }
        }));
        bulkOps.push(db.collection(Collections.WALLETS).bulkWrite(bulk));
    }

    // Reverse Referral Wallets
    if (refWalletUpdates.size > 0) {
        const bulk = Array.from(refWalletUpdates.entries()).map(([uid, amt]) => ({
            updateOne: {
                filter: { userId: new ObjectId(uid) },
                update: { $inc: { balance: amt }, $set: { updatedAt: now } }
            }
        }));
        bulkOps.push(db.collection(Collections.REFERRAL_WALLETS).bulkWrite(bulk));
    }

    // Reset User Plans
    if (planReversions.size > 0) {
        const bulk = Array.from(planReversions.entries()).map(([pid, data]) => ({
            updateOne: {
                filter: { _id: new ObjectId(pid) },
                update: { 
                    $inc: { totalRoiPaid: -data.amount },
                    // We can't easily know the previous lastRoiDate with 100% certainty 
                    // without keeping history, but setting it back by 1 day is a safe heuristic 
                    // for a "today" reversal. For perfect restoration, we just unset it
                    // and let the next cron pick it up.
                    $unset: { lastRoiDate: "" },
                    $set: { updatedAt: now }
                }
            }
        }));
        bulkOps.push(db.collection(Collections.USER_PLANS).bulkWrite(bulk));
    }

    // Delete Log Entries
    bulkOps.push(db.collection(Collections.TRANSACTIONS).deleteMany({
        _id: { $in: roiTx.map(t => t._id) }
    }));
    bulkOps.push(db.collection(Collections.REFERRAL_EARNINGS).deleteMany({
        _id: { $in: refEarnings.map(e => e._id) }
    }));

    await Promise.all(bulkOps);

    // 3. Refresh Stats for all affected users
    console.log('Refreshing stats for all affected users...');
    const { refreshUserStatsBatch } = await import('../lib/referral');
    await refreshUserStatsBatch(totalAffectedUsers);

    console.log('\n========================================');
    console.log('REVERSAL COMPLETE');
    console.log('========================================');
}

main().catch(console.error).finally(() => process.exit());
