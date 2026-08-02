// ==========================================================
// MIGRATION SCRIPT: Populate ancestors field on User documents
// Usage:
//   Dry Run: npx tsx scripts/migrate-user-ancestors.ts --dry-run
//   Execute: npx tsx scripts/migrate-user-ancestors.ts
// ==========================================================

import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load environment variables manually
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

async function runMigration() {
    const uri = process.env.DATABASE_URL;
    const dbName = process.env.MONGODB_DB_NAME || 'TradeEdge';

    if (!uri) {
        console.error('❌ [Migration] DATABASE_URL is not set in environment.');
        process.exit(1);
    }

    console.log(`🚀 [Migration] Starting user ancestors backfill... Mode: ${isDryRun ? 'DRY RUN 🔍' : 'LIVE WRITE ⚡'}`);
    const client = await MongoClient.connect(uri);
    const db = client.db(dbName);
    const usersCol = db.collection('users');

    try {
        // Fetch all non-deleted users with just _id, referredById, ancestors
        const users = await usersCol.find(
            { isDeleted: { $ne: true } },
            { projection: { _id: 1, referredById: 1, ancestors: 1 } }
        ).toArray();

        console.log(`📊 Total users found in database: ${users.length}`);

        // Build mapping in memory
        const userMap = new Map<string, { _id: ObjectId; referredById?: ObjectId | null; ancestors?: ObjectId[] }>();
        for (const u of users) {
            userMap.set(u._id.toString(), u);
        }

        // Helper function to resolve ancestors array up to 20 tiers
        const resolveAncestors = (userIdStr: string, visited = new Set<string>()): ObjectId[] => {
            if (visited.has(userIdStr)) return []; // Prevent infinite loop in case of bad data/cycles
            visited.add(userIdStr);

            const user = userMap.get(userIdStr);
            if (!user || !user.referredById) return [];

            const parentIdStr = user.referredById.toString();
            const parent = userMap.get(parentIdStr);
            if (!parent) return [user.referredById];

            const parentAncestors = resolveAncestors(parentIdStr, new Set(visited));
            return [user.referredById, ...parentAncestors].slice(0, 20);
        };

        const bulkOps: any[] = [];
        let updatedCount = 0;
        let skippedCount = 0;

        for (const user of users) {
            const calculatedAncestors = resolveAncestors(user._id.toString());
            
            // Check if user already has identical ancestors
            const currentAncestors = (user.ancestors || []).map((a: ObjectId) => a.toString());
            const newAncestorsStr = calculatedAncestors.map((a: ObjectId) => a.toString());

            const isAlreadyEqual = currentAncestors.length === newAncestorsStr.length &&
                currentAncestors.every((val: string, idx: number) => val === newAncestorsStr[idx]);

            if (isAlreadyEqual) {
                skippedCount++;
                continue;
            }

            updatedCount++;

            if (isDryRun) {
                if (updatedCount <= 5) {
                    console.log(`[DRY-RUN] User ${user._id}: ${currentAncestors.length} -> ${calculatedAncestors.length} ancestors`);
                }
            } else {
                bulkOps.push({
                    updateOne: {
                        filter: { _id: user._id },
                        update: { $set: { ancestors: calculatedAncestors, updatedAt: new Date() } }
                    }
                });
            }
        }

        if (isDryRun) {
            console.log(`\n🔍 [DRY-RUN Complete]`);
            console.log(`  - Users needing update: ${updatedCount}`);
            console.log(`  - Users already up to date: ${skippedCount}`);
            console.log(`👉 Run without --dry-run to apply changes to database.`);
        } else if (bulkOps.length > 0) {
            console.log(`⚡ Executing bulkWrite for ${bulkOps.length} users...`);
            
            // Execute in batches of 500
            const batchSize = 500;
            for (let i = 0; i < bulkOps.length; i += batchSize) {
                const batch = bulkOps.slice(i, i + batchSize);
                await usersCol.bulkWrite(batch, { ordered: false });
                console.log(`  Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(bulkOps.length / batchSize)}`);
            }

            console.log(`✅ [Migration Complete] Updated ancestors for ${bulkOps.length} users!`);
        } else {
            console.log(`✅ [Migration Complete] All ${users.length} users already have up-to-date ancestors!`);
        }

    } catch (error) {
        console.error('❌ [Migration Error]:', error);
    } finally {
        await client.close();
    }
}

runMigration();
