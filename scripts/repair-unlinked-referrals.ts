// ==========================================================
// REPAIR SCRIPT: Repair unlinked referrals and populate ancestors
// Usage:
//   Dry Run: npx tsx scripts/repair-unlinked-referrals.ts --dry-run
//   Execute: npx tsx scripts/repair-unlinked-referrals.ts
// ==========================================================

import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

const isDryRun = process.argv.includes('--dry-run');

async function runRepair() {
    const uri = process.env.DATABASE_URL;
    const dbName = process.env.MONGODB_DB_NAME || 'TradeEdge';

    if (!uri) {
        console.error('❌ [Repair] DATABASE_URL is not set.');
        process.exit(1);
    }

    console.log(`🚀 [Repair] Starting unlinked referral check... Mode: ${isDryRun ? 'DRY RUN 🔍' : 'LIVE REPAIR ⚡'}`);
    const client = await MongoClient.connect(uri);
    const db = client.db(dbName);
    const usersCol = db.collection('users');
    const pendingCol = db.collection('pending_referrals');

    try {
        const unlinkedUsers = await usersCol.find({
            isDeleted: { $ne: true },
            $or: [{ referredById: null }, { referredById: { $exists: false } }]
        }).toArray();

        console.log(`📊 Found ${unlinkedUsers.length} users with referredById == null`);

        const allUsers = await usersCol.find({ isDeleted: { $ne: true } }).toArray();
        const userMapByCode = new Map<string, any>();
        for (const u of allUsers) {
            if (u.referralCode) {
                userMapByCode.set(u.referralCode.trim().toUpperCase(), u);
            }
        }

        let repairedCount = 0;
        const affectedReferrers = new Set<string>();

        for (const user of unlinkedUsers) {
            const pendingDoc = await pendingCol.findOne({ telegramId: String(user.telegramId) });
            if (!pendingDoc || !pendingDoc.referralCode) continue;

            const cleanCode = pendingDoc.referralCode.trim().toUpperCase();
            const referrer = userMapByCode.get(cleanCode);

            if (referrer && referrer._id.toString() !== user._id.toString()) {
                console.log(`💡 Found pending referral match for User ${user._id} (${user.firstName || user.telegramUsername || user.telegramId}): Link to Referrer ${referrer._id} (${referrer.firstName || referrer.telegramUsername || cleanCode})`);
                repairedCount++;
                affectedReferrers.add(referrer._id.toString());

                if (!isDryRun) {
                    // Compute ancestors array
                    const parentAncestors = referrer.ancestors || [];
                    const newAncestors = [referrer._id, ...parentAncestors].slice(0, 20);

                    await usersCol.updateOne(
                        { _id: user._id },
                        { 
                            $set: { 
                                referredById: referrer._id,
                                ancestors: newAncestors,
                                updatedAt: new Date()
                            } 
                        }
                    );

                    await pendingCol.deleteOne({ _id: pendingDoc._id });
                }
            }
        }

        console.log(`\n==================================================`);
        console.log(`Result: ${repairedCount} user(s) ${isDryRun ? 'can be linked' : 'successfully linked'} to their referrer!`);
        console.log(`==================================================`);

        if (!isDryRun && affectedReferrers.size > 0) {
            console.log(`⚡ Recalculating referral statistics for affected referrers...`);
            const { updateUserStatsRecursively } = await import('../lib/referral');
            for (const refIdStr of affectedReferrers) {
                await updateUserStatsRecursively(new ObjectId(refIdStr)).catch(err => console.error('Error updating stats for referrer:', refIdStr, err));
            }
            console.log(`✅ Referrer statistics updated successfully!`);
        }

    } catch (err) {
        console.error('❌ [Repair Error]:', err);
    } finally {
        await client.close();
    }
}

runRepair();
