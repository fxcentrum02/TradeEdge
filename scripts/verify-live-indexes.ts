// ===========================================
// LIVE INDEX VERIFICATION & CREATION SCRIPT
// Runs on LIVE database
// Usage: npx tsx scripts/verify-live-indexes.ts
// ===========================================

import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Manual .env loading
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
} catch { /* ignore if .env doesn't exist */ }

const LIVE_URI = process.env.DATABASE_URL;
const DB_NAME = process.env.MONGODB_DB_NAME || 'TradeEdge';

if (!LIVE_URI) {
    console.error('DATABASE_URL not set in .env');
    process.exit(1);
}

const Collections = {
    USERS: 'users',
    WALLETS: 'wallets',
    REFERRAL_WALLETS: 'referral_wallets',
    PLANS: 'plans',
    USER_PLANS: 'user_plans',
    REFERRAL_EARNINGS: 'referral_earnings',
    TRANSACTIONS: 'transactions',
    WITHDRAWALS: 'withdrawals',
    PAYMENT_TICKETS: 'payment_tickets',
    ADMINS: 'admins',
    SETTINGS: 'settings',
    PENDING_REFERRALS: 'pending_referrals',
    MILESTONE_AWARDS: 'milestone_awards',
} as const;

// Define all REQUIRED indexes
const REQUIRED_INDEXES: Record<string, { key: Record<string, number>; name: string; unique?: boolean }[]> = {
    [Collections.USERS]: [
        { key: { telegramId: 1 }, name: 'telegramId_unique', unique: true },
        { key: { referralCode: 1 }, name: 'referralCode_unique', unique: true },
        { key: { referredById: 1 }, name: 'referredById_index' },
        { key: { isAdmin: 1 }, name: 'isAdmin_index' },
        { key: { createdAt: -1 }, name: 'createdAt_desc_index' },
    ],
    [Collections.WALLETS]: [
        { key: { userId: 1 }, name: 'userId_unique', unique: true },
    ],
    [Collections.REFERRAL_WALLETS]: [
        { key: { userId: 1 }, name: 'userId_unique', unique: true },
    ],
    [Collections.PLANS]: [
        { key: { isActive: 1 }, name: 'isActive_index' },
        { key: { sortOrder: 1 }, name: 'sortOrder_index' },
    ],
    [Collections.USER_PLANS]: [
        { key: { userId: 1 }, name: 'userId_index' },
        { key: { isActive: 1 }, name: 'isActive_index' },
        { key: { lastRoiDate: 1 }, name: 'lastRoiDate_index' },
        { key: { userId: 1, isActive: 1, endDate: 1 }, name: 'userId_isActive_endDate_index' },
        // compound indexes
        { key: { userId: 1, createdAt: -1 }, name: 'userId_createdAt_desc_compound' },
        { key: { isActive: 1, isDeleted: 1, endDate: 1, lastRoiDate: 1 }, name: 'roi_eligibility_compound' },
    ],
    [Collections.PAYMENT_TICKETS]: [
        { key: { userId: 1 }, name: 'userId_index' },
        { key: { status: 1 }, name: 'status_index' },
        { key: { createdAt: -1 }, name: 'createdAt_desc_index' },
        // compound index
        { key: { status: 1, createdAt: -1 }, name: 'status_createdAt_desc_compound' },
    ],
    [Collections.REFERRAL_EARNINGS]: [
        { key: { userId: 1 }, name: 'userId_index' },
        { key: { userId: 1, tier: 1 }, name: 'userId_tier_index' },
        { key: { fromUserId: 1 }, name: 'fromUserId_index' },
        // compound index for date-range queries
        { key: { userId: 1, createdAt: -1 }, name: 'userId_createdAt_desc_compound' },
    ],
    [Collections.TRANSACTIONS]: [
        { key: { userId: 1 }, name: 'userId_index' },
        { key: { type: 1 }, name: 'type_index' },
        { key: { createdAt: -1 }, name: 'createdAt_desc_index' },
        { key: { userId: 1, type: 1, createdAt: -1 }, name: 'userId_type_createdAt_index' },
        // compound index
        { key: { userId: 1, createdAt: -1 }, name: 'userId_createdAt_desc_compound' },
    ],
    [Collections.WITHDRAWALS]: [
        { key: { userId: 1 }, name: 'userId_index' },
        { key: { status: 1 }, name: 'status_index' },
        { key: { createdAt: -1 }, name: 'createdAt_desc_index' },
        // compound indexes
        { key: { userId: 1, createdAt: -1 }, name: 'userId_createdAt_desc_compound' },
        { key: { status: 1, createdAt: -1 }, name: 'status_createdAt_desc_compound' },
    ],
    [Collections.PENDING_REFERRALS]: [
        { key: { telegramId: 1 }, name: 'telegramId_index' },
    ],
    [Collections.MILESTONE_AWARDS]: [
        { key: { userId: 1, milestoneThreshold: 1 }, name: 'userId_milestoneThreshold_unique', unique: true },
        { key: { userId: 1 }, name: 'userId_index' },
        { key: { awardedAt: -1 }, name: 'awardedAt_desc_index' },
    ],
};

function indexKeyMatch(existingKey: Record<string, number>, requiredKey: Record<string, number>): boolean {
    const existingKeys = Object.keys(existingKey);
    const requiredKeys = Object.keys(requiredKey);
    if (existingKeys.length !== requiredKeys.length) return false;
    for (let i = 0; i < requiredKeys.length; i++) {
        if (existingKeys[i] !== requiredKeys[i]) return false;
        if (existingKey[existingKeys[i]] !== requiredKey[requiredKeys[i]]) return false;
    }
    return true;
}

async function main() {
    console.log('========================================');
    console.log('LIVE DATABASE INDEX VERIFICATION & CREATION');
    console.log(`Target: LIVE DB (${DB_NAME})`);
    console.log('========================================\n');

    const client = await MongoClient.connect(LIVE_URI!, {
        maxPoolSize: 3,
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
    });

    const db = client.db(DB_NAME);
    await db.command({ ping: 1 });
    console.log('✅ Connected to LIVE database\n');

    const report: {
        collection: string;
        existing: string[];
        missing: string[];
        created: string[];
        skipped: string[];
    }[] = [];

    for (const [collName, requiredIndexes] of Object.entries(REQUIRED_INDEXES)) {
        console.log(`--- ${collName} ---`);
        
        // Get existing indexes
        const existingIndexes = await db.collection(collName).listIndexes().toArray();
        const existingNames = existingIndexes.map(i => i.name);
        const existingKeys = existingIndexes.map(i => i.key);

        const collReport = {
            collection: collName,
            existing: existingNames,
            missing: [] as string[],
            created: [] as string[],
            skipped: [] as string[],
        };

        for (const req of requiredIndexes) {
            const exists = existingKeys.some(ek => indexKeyMatch(ek, req.key));

            if (exists) {
                console.log(`  ✅ EXISTS: ${req.name} ${JSON.stringify(req.key)}`);
                collReport.skipped.push(req.name);
            } else {
                console.log(`  ❌ MISSING on Live: ${req.name} ${JSON.stringify(req.key)}`);
                collReport.missing.push(req.name);

                // Create the missing index on Live DB
                try {
                    const options: any = { name: req.name };
                    if (req.unique) options.unique = true;
                    await db.collection(collName).createIndex(req.key, options);
                    console.log(`     ✅ CREATED: ${req.name}`);
                    collReport.created.push(req.name);
                } catch (error) {
                    console.error(`     ❌ FAILED TO CREATE: ${req.name}`, error);
                }
            }
        }

        report.push(collReport);
        console.log('');
    }

    // Summary
    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================');
    let totalMissing = 0;
    let totalCreated = 0;
    for (const r of report) {
        if (r.missing.length > 0) {
            console.log(`${r.collection}: ${r.missing.length} missing, ${r.created.length} created`);
            totalMissing += r.missing.length;
            totalCreated += r.created.length;
        }
    }
    if (totalMissing === 0) {
        console.log('All required indexes exist on Live DB! ✅');
    } else {
        console.log(`\nTotal: ${totalMissing} indexes were missing on Live, ${totalCreated} created.`);
    }

    // Run explain() on live DB to verify IXSCAN on key queries
    console.log('\n========================================');
    console.log('EXPLAIN ANALYSIS (Live DB IXSCAN Verification)');
    console.log('========================================\n');

    const explainResults: { query: string; collection: string; stage: string; indexName: string; docsExamined: number; keysExamined: number }[] = [];

    // Helper to extract the winning plan stage type
    const getStage = (plan: any): string => {
        if (!plan) return 'UNKNOWN';
        if (plan.stage === 'IXSCAN' || plan.inputStage?.stage === 'IXSCAN') return 'IXSCAN';
        if (plan.stage === 'COLLSCAN') return 'COLLSCAN';
        if (plan.inputStage) return getStage(plan.inputStage);
        if (plan.inputStages) {
            for (const s of plan.inputStages) {
                const r = getStage(s);
                if (r !== 'UNKNOWN') return r;
            }
        }
        return plan.stage || 'UNKNOWN';
    };

    // Helper to extract the index name
    const getIndexName = (plan: any): string => {
        if (!plan) return 'none';
        if (plan.indexName) return plan.indexName;
        if (plan.inputStage) return getIndexName(plan.inputStage);
        if (plan.inputStages) {
            for (const s of plan.inputStages) {
                const r = getIndexName(s);
                if (r !== 'none') return r;
            }
        }
        return 'none';
    };

    // 1. User plans: ROI eligibility query
    {
        const now = new Date();
        const explain = await db.collection(Collections.USER_PLANS).find({
            isActive: true,
            isDeleted: { $ne: true },
            endDate: { $gt: now },
            $or: [
                { lastRoiDate: { $exists: false } },
                { lastRoiDate: { $lt: now } },
            ],
        }).explain('executionStats') as any;

        const winningPlan = explain.queryPlanner?.winningPlan;
        const stage = getStage(winningPlan);
        const stats = explain.executionStats;
        const indexName = getIndexName(winningPlan);

        explainResults.push({ query: 'ROI Eligibility', collection: Collections.USER_PLANS, stage, indexName, docsExamined: stats?.totalDocsExamined || 0, keysExamined: stats?.totalKeysExamined || 0 });
    }

    // 2. Transactions: user history (userId + sort createdAt desc)
    {
        const sampleUserId = await db.collection(Collections.USERS).findOne({}, { projection: { _id: 1 } });
        if (sampleUserId) {
            const explain = await db.collection(Collections.TRANSACTIONS).find({ userId: sampleUserId._id }).sort({ createdAt: -1 }).limit(20).explain('executionStats') as any;
            const winningPlan = explain.queryPlanner?.winningPlan;
            const stage = getStage(winningPlan);
            const indexName = getIndexName(winningPlan);
            const stats = explain.executionStats;

            explainResults.push({ query: 'Transaction History', collection: Collections.TRANSACTIONS, stage, indexName, docsExamined: stats?.totalDocsExamined || 0, keysExamined: stats?.totalKeysExamined || 0 });
        }
    }

    console.log('Query'.padEnd(30) + 'Stage'.padEnd(15) + 'Index'.padEnd(40) + 'DocsExam'.padEnd(12) + 'KeysExam');
    console.log('-'.repeat(107));
    for (const r of explainResults) {
        console.log(
            r.query.padEnd(30) +
            r.stage.padEnd(15) +
            r.indexName.padEnd(40) +
            String(r.docsExamined).padEnd(12) +
            String(r.keysExamined)
        );
    }

    await client.close();
    console.log('\n✅ Live DB connection closed.');
}

main().catch((err) => {
    console.error('Live index check failed:', err);
    process.exit(1);
});
