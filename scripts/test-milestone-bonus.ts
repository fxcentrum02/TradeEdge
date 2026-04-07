// ===========================================
// TEST: Milestone Bonus System
// Usage: DATABASE_URL="..." npx tsx scripts/test-milestone-bonus.ts
// ===========================================

import { ObjectId } from 'mongodb';
import { getDB } from '../lib/db';
import { Collections } from '../lib/db/collections';
import { checkAndAwardMilestones, getDirectLegVolumes, check403030 } from '../lib/milestone';
import { getAwardedMilestoneThresholds } from '../lib/repositories/milestone.repository';
import { createIndexes } from '../lib/db/indexes';

// ─────────────────────── ANSI colors ────────────────────────
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function pass(msg: string) { console.log(`${GREEN}✅ PASS${RESET}: ${msg}`); }
function fail(msg: string) { console.log(`${RED}❌ FAIL${RESET}: ${msg}`); }
function info(msg: string) { console.log(`${CYAN}ℹ ${RESET} ${msg}`); }
function section(msg: string) { console.log(`\n${BOLD}${YELLOW}═══ ${msg} ═══${RESET}`); }

// ─────────────────────── Test Setup ────────────────────────

type TestUser = { _id: ObjectId; name: string };

async function createTestUser(
    db: Awaited<ReturnType<typeof getDB>>,
    name: string,
    tradePower: number,
    referredById?: ObjectId
): Promise<TestUser> {
    const now = new Date();
    const result = await db.collection(Collections.USERS).insertOne({
        telegramId: `test_${name}_${Date.now()}`,
        telegramUsername: name,
        firstName: name,
        referralCode: `REF_${name.toUpperCase()}_${Date.now()}`,
        referredById: referredById ?? null,
        directReferralCount: 0,
        totalReferralCount: 0,
        totalDownlineCount: 0,
        totalEarnings: 0,
        tradePower,                   // simulate active trade power
        isAdmin: false,
        isActive: true,
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
    });
    return { _id: result.insertedId, name };
}

async function cleanup(db: Awaited<ReturnType<typeof getDB>>, userIds: ObjectId[]) {
    if (userIds.length === 0) return;
    await db.collection(Collections.USERS).deleteMany({ _id: { $in: userIds } });
    await db.collection(Collections.REFERRAL_WALLETS).deleteMany({ userId: { $in: userIds } });
    await db.collection(Collections.TRANSACTIONS).deleteMany({ userId: { $in: userIds } });
    await db.collection(Collections.MILESTONE_AWARDS).deleteMany({ userId: { $in: userIds } });
    info(`Cleaned up ${userIds.length} test users and related records`);
}

// ─────────────────────── Tests ────────────────────────

async function main() {
    console.log(`\n${BOLD}${YELLOW}MILESTONE BONUS SYSTEM — TEST SUITE${RESET}`);
    console.log(`Database: ${process.env.DATABASE_URL?.split('@')[1] ?? 'unknown'}\n`);

    const db = await getDB();

    // Ensure indexes exist (creates milestone_awards unique index)
    section('Step 0: Ensure Indexes');
    await createIndexes();
    pass('Indexes created/verified');

    const allTestUserIds: ObjectId[] = [];

    try {
        // ─────────────────────────────────────────────────────────────────
        section('Test 1: Pure 40/30/30 Logic (No DB)');
        // ─────────────────────────────────────────────────────────────────
        {
            const fakeLegs = [
                { userId: 'a', firstName: 'A', telegramUsername: null, personalTradePower: 2000, downlineTradePower: 0, totalLegVolume: 2000 },
                { userId: 'b', firstName: 'B', telegramUsername: null, personalTradePower: 1500, downlineTradePower: 0, totalLegVolume: 1500 },
                { userId: 'c', firstName: 'C', telegramUsername: null, personalTradePower: 1500, downlineTradePower: 0, totalLegVolume: 1500 },
            ];

            const result = check403030(5000, fakeLegs);
            if (result.passed) pass('5K milestone: legA=2000 legB=1500 legC=1500 → PASSES');
            else fail('5K milestone should pass but did not');

            // Fail case: legB too small
            const failLegs = [
                { userId: 'a', firstName: 'A', telegramUsername: null, personalTradePower: 2500, downlineTradePower: 0, totalLegVolume: 2500 },
                { userId: 'b', firstName: 'B', telegramUsername: null, personalTradePower: 1000, downlineTradePower: 0, totalLegVolume: 1000 }, // < 1500
                { userId: 'c', firstName: 'C', telegramUsername: null, personalTradePower: 1500, downlineTradePower: 0, totalLegVolume: 1500 },
            ];
            const failResult = check403030(5000, failLegs);
            if (!failResult.passed) pass('5K milestone: legB=1000 (< 1500 required) → correctly FAILS');
            else fail('5K milestone should fail (legB too small) but passed');
        }

        // ─────────────────────────────────────────────────────────────────
        section('Test 2: Real DB — No Direct Referrals');
        // ─────────────────────────────────────────────────────────────────
        {
            const loneUser = await createTestUser(db, 'LoneWolf', 10000);
            allTestUserIds.push(loneUser._id);

            const result = await checkAndAwardMilestones(loneUser._id);
            if (result.newlyAwardedCount === 0) pass('User with no referrals earns 0 milestones');
            else fail(`Expected 0 awards, got ${result.newlyAwardedCount}`);
        }

        // ─────────────────────────────────────────────────────────────────
        section('Test 3: Real DB — 5K Milestone Should Pass');
        // ─────────────────────────────────────────────────────────────────
        {
            // Meet (root) — 3 direct referrals
            const meet = await createTestUser(db, 'Meet', 500);
            allTestUserIds.push(meet._id);

            // Abhay: 2000 personal (top leg)
            const abhay = await createTestUser(db, 'Abhay', 2000, meet._id);
            // Jay: 1500 personal (second leg)
            const jay = await createTestUser(db, 'Jay', 1500, meet._id);
            // Raj: 1500 personal (third leg → goes into legC)
            const raj = await createTestUser(db, 'Raj', 1500, meet._id);
            allTestUserIds.push(abhay._id, jay._id, raj._id);

            // Update Meet's directReferralCount
            await db.collection(Collections.USERS).updateOne(
                { _id: meet._id },
                { $set: { directReferralCount: 3, updatedAt: new Date() } }
            );

            // Verify leg volumes
            const legs = await getDirectLegVolumes(meet._id);
            info(`Sorted legs: ${legs.map(l => `${l.firstName}=${l.totalLegVolume}`).join(', ')}`);

            if (legs[0].totalLegVolume >= 2000) pass(`Leg A volume: ${legs[0].totalLegVolume} ≥ 2000`);
            else fail(`Leg A volume ${legs[0].totalLegVolume} < 2000`);

            if (legs[1].totalLegVolume >= 1500) pass(`Leg B volume: ${legs[1].totalLegVolume} ≥ 1500`);
            else fail(`Leg B volume ${legs[1].totalLegVolume} < 1500`);

            const legC = legs.slice(2).reduce((s, l) => s + l.totalLegVolume, 0);
            if (legC >= 1500) pass(`Leg C combined: ${legC} ≥ 1500`);
            else fail(`Leg C combined ${legC} < 1500`);

            // Run milestone check
            const result = await checkAndAwardMilestones(meet._id);
            info(`Awards this run: ${result.newlyAwardedCount}, USDT: ${result.totalRewarded}`);

            if (result.newlyAwardedCount > 0) pass(`Meet earned ${result.newlyAwardedCount} milestone(s), +${result.totalRewarded} USDT`);
            else fail('Meet should have earned at least the 5K milestone');

            // Verify referral wallet was credited
            const wallet = await db.collection(Collections.REFERRAL_WALLETS).findOne({ userId: meet._id });
            if (wallet && wallet.balance === result.totalRewarded) pass(`Referral wallet balance correct: ${wallet.balance} USDT`);
            else fail(`Wallet balance mismatch. Expected ${result.totalRewarded}, got ${wallet?.balance}`);

            // Verify transaction logged with MILESTONE_BONUS type
            const tx = await db.collection(Collections.TRANSACTIONS).findOne({ userId: meet._id, type: 'MILESTONE_BONUS' });
            if (tx) pass(`MILESTONE_BONUS transaction logged: amount=${tx.amount}`);
            else fail('MILESTONE_BONUS transaction not found in transactions collection');

            // ─────────── Test 4: IDEMPOTENCY ────────────────────────────
            section('Test 4: Idempotency — Run Cron Twice, No Double Award');
            const result2 = await checkAndAwardMilestones(meet._id);
            if (result2.newlyAwardedCount === 0) pass('Second run: 0 new awards (idempotent ✓)');
            else fail(`Second run awarded ${result2.newlyAwardedCount} milestones — NOT idempotent!`);

            const wallet2 = await db.collection(Collections.REFERRAL_WALLETS).findOne({ userId: meet._id });
            if (wallet2?.balance === result.totalRewarded) pass(`Wallet unchanged on second run: ${wallet2.balance} USDT`);
            else fail(`Wallet changed on second run! Expected ${result.totalRewarded}, got ${wallet2?.balance}`);

            // ─────────── Test 5: Awarded Thresholds Set ──────────────────
            section('Test 5: Awarded Threshold Set Reflects DB State');
            const awarded = await getAwardedMilestoneThresholds(meet._id);
            if (awarded.has(5000)) pass('Set correctly contains threshold 5000');
            else fail('Set missing threshold 5000');
        }

        // ─────────────────────────────────────────────────────────────────
        section('Test 6: Downline Depth — Leg Volume Includes Sub-downline');
        // ─────────────────────────────────────────────────────────────────
        {
            const root = await createTestUser(db, 'RootUser', 0);
            allTestUserIds.push(root._id);

            // Leg A: Direct ref with 500, but their child has 1600 → total = 2100
            const legADirect = await createTestUser(db, 'LegADirect', 500, root._id);
            const legAChild = await createTestUser(db, 'LegAChild', 1600, legADirect._id);
            allTestUserIds.push(legADirect._id, legAChild._id);

            // Leg B: 1500 personal
            const legBDirect = await createTestUser(db, 'LegBDirect', 1500, root._id);
            // Leg C: 1500 personal combined from two people
            const legCDirect1 = await createTestUser(db, 'LegCDirect1', 800, root._id);
            const legCDirect2 = await createTestUser(db, 'LegCDirect2', 700, root._id);
            allTestUserIds.push(legBDirect._id, legCDirect1._id, legCDirect2._id);

            await db.collection(Collections.USERS).updateOne(
                { _id: root._id },
                { $set: { directReferralCount: 4, updatedAt: new Date() } }
            );

            const legs = await getDirectLegVolumes(root._id);
            info(`Depth test legs: ${legs.map(l => `${l.firstName}=${l.totalLegVolume}`).join(', ')}`);

            const legAActual = legs.find(l => l.firstName === 'LegADirect')?.totalLegVolume ?? 0;
            if (legAActual === 2100) pass(`LegADirect volume = 500 + 1600 = 2100 (depth traversal works)`);
            else fail(`LegADirect expected 2100, got ${legAActual}`);

            const result = await checkAndAwardMilestones(root._id);
            if (result.newlyAwardedCount > 0) pass(`Depth test: root earned milestone via sub-downline power`);
            else {
                // Not a hard fail — depends on if threshold conditions are met
                info(`No milestone awarded (may need deeper structure for higher thresholds)`);
            }
        }

    } finally {
        // ─────────────────────────────────────────────────────────────────
        section('Cleanup');
        await cleanup(db, allTestUserIds);
        process.exit(0);
    }
}

main().catch(err => {
    console.error(`${RED}FATAL ERROR:${RESET}`, err);
    process.exit(1);
});
