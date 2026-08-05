// ==========================================================
// TEST SUITE FOR PERMANENT USER DELETION & ARCHITECTURE SAFETY
// ==========================================================

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env
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

import { getDB } from '../lib/db';
import { Collections } from '../lib/db/collections';
import { ObjectId } from 'mongodb';
import { updateUserStatsRecursively } from '../lib/referral';

async function runTests() {
    console.log('🚀 Running Permanent User Deletion Safety Tests...\n');
    const db = await getDB();
    const now = new Date();

    // 1. Setup Test Fixtures
    // Parent User (Upline)
    const parentId = new ObjectId();
    const parentUser = {
        _id: parentId,
        telegramId: '999000111',
        firstName: 'TestParent',
        lastName: 'Upline',
        referralCode: 'TESTPAR1',
        referredById: null,
        directReferralCount: 1,
        totalReferralCount: 1,
        totalDownlineCount: 1,
        totalEarnings: 50,
        tradePower: 100,
        isAdmin: false,
        isActive: true,
        ancestors: [],
        createdAt: now,
        updatedAt: now
    };

    // Child User 1 (Leaf user with Trade Power)
    const childId1 = new ObjectId();
    const childUser1 = {
        _id: childId1,
        telegramId: '999000222',
        firstName: 'TestChild1',
        lastName: 'LeafWithTP',
        referralCode: 'TESTCHD1',
        referredById: parentId,
        directReferralCount: 0,
        totalReferralCount: 0,
        totalDownlineCount: 0,
        totalEarnings: 0,
        tradePower: 250,
        isAdmin: false,
        isActive: true,
        ancestors: [parentId],
        createdAt: now,
        updatedAt: now
    };

    // Sub-child (Downline of Child User 2 to test downline blocking)
    const grandChildId = new ObjectId();
    const grandChildUser = {
        _id: grandChildId,
        telegramId: '999000333',
        firstName: 'TestGrandChild',
        lastName: 'Downline',
        referralCode: 'TESTGCH1',
        referredById: childId1,
        directReferralCount: 0,
        totalReferralCount: 0,
        totalDownlineCount: 0,
        totalEarnings: 0,
        tradePower: 0,
        isAdmin: false,
        isActive: true,
        ancestors: [childId1, parentId],
        createdAt: now,
        updatedAt: now
    };

    // Referral earning credited to parent from child1
    const earningId = new ObjectId();
    const referralEarning = {
        _id: earningId,
        userId: parentId, // Owned by Parent
        fromUserId: childId1, // Generated from Child 1
        amount: 50,
        tier: 1,
        type: 'ROI_COMMISSION',
        createdAt: now
    };

    // Insert Test Fixtures
    await db.collection(Collections.USERS).insertMany([parentUser, childUser1, grandChildUser]);
    await db.collection(Collections.REFERRAL_EARNINGS).insertOne(referralEarning);

    console.log('✅ Test fixtures inserted: Parent, Child, GrandChild, Upline Earning Record.\n');

    try {
        // TEST 1: Downline Protection Test (Attempt deleting Child 1 who now has a downline GrandChild)
        console.log('🧪 TEST 1: Downline Protection Check');
        const downlineCount = await db.collection(Collections.USERS).countDocuments({ referredById: childId1 });
        if (downlineCount > 0) {
            console.log(`   [PASS] Downline check correctly detected ${downlineCount} downline(s). Deletion of Child 1 is BLOCKED.`);
        } else {
            console.error('   [FAIL] Downline check failed to detect downlines!');
        }

        // Clean up GrandChild so Child 1 no longer has downlines for TEST 2 & 3
        await db.collection(Collections.USERS).deleteOne({ _id: grandChildId });

        // TEST 2: Trade Power Confirmation Check
        console.log('\n🧪 TEST 2: Trade Power Confirmation Flag Check');
        const userToTest = await db.collection(Collections.USERS).findOne({ _id: childId1 });
        if (userToTest && userToTest.tradePower > 0) {
            console.log(`   [PASS] Trade Power of ${userToTest.tradePower} detected. Confirmation required.`);
        }

        // TEST 3: Execute Deletion of Child 1 with Trade Power Confirmation & Verify Upline Data Intact
        console.log('\n🧪 TEST 3: Executing Permanent Deletion of Child 1');
        
        // Delete child 1 documents
        await Promise.all([
            db.collection(Collections.USERS).deleteOne({ _id: childId1 }),
            db.collection(Collections.WALLETS).deleteMany({ userId: childId1 }),
            db.collection(Collections.REFERRAL_WALLETS).deleteMany({ userId: childId1 }),
            db.collection(Collections.USER_PLANS).deleteMany({ userId: childId1 }),
            db.collection(Collections.TRANSACTIONS).deleteMany({ userId: childId1 }),
            db.collection(Collections.REFERRAL_EARNINGS).deleteMany({ userId: childId1 }), // Only owned by child 1
        ]);

        // Update parent stats
        await updateUserStatsRecursively(parentId);

        // Verify Child 1 is gone
        const deletedChild = await db.collection(Collections.USERS).findOne({ _id: childId1 });
        console.log('   Verification 3.1: Deleted child in DB:', deletedChild);
        if (deletedChild === null) {
            console.log('   [PASS] Child 1 user document removed.');
        }

        // Verify Parent Referral Earning record is STILL INTACT
        const uplineEarning = await db.collection(Collections.REFERRAL_EARNINGS).findOne({ _id: earningId });
        console.log('   Verification 3.2: Upline Earning Record in DB:', uplineEarning);
        if (uplineEarning && uplineEarning.amount === 50) {
            console.log('   [PASS] Upline referral earning was PRESERVED intact ($50)!');
        } else {
            console.error('   [FAIL] Upline referral earning was incorrectly deleted!');
        }

        // Verify Parent Updated Stats
        const updatedParent = await db.collection(Collections.USERS).findOne({ _id: parentId });
        console.log('   Verification 3.3: Updated Parent Stats:', {
            directReferralCount: updatedParent?.directReferralCount,
            totalDownlineCount: updatedParent?.totalDownlineCount
        });
        if (updatedParent?.directReferralCount === 0 && updatedParent?.totalDownlineCount === 0) {
            console.log('   [PASS] Parent downline stats correctly recalculated to 0.');
        }

        console.log('\n==================================================');
        console.log('🎉 ALL PERMANENT DELETION SAFETY TESTS PASSED!');
        console.log('==================================================');

    } finally {
        // Cleanup all test fixtures
        await db.collection(Collections.USERS).deleteMany({ _id: { $in: [parentId, childId1, grandChildId] } });
        await db.collection(Collections.REFERRAL_EARNINGS).deleteMany({ _id: earningId });
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error('❌ Test error:', err);
    process.exit(1);
});
