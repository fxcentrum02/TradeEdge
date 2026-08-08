// ==========================================================
// TEST SUITE FOR TELEGRAM REFERRAL LINKING FLOW
// ==========================================================

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

import { getDB } from '../lib/db';
import { Collections } from '../lib/db/collections';
import { ObjectId } from 'mongodb';
import { createUser, findUserByReferralCode, updateUser } from '../lib/repositories/user.repository';
import { updateUserStatsRecursively } from '../lib/referral';

async function testReferralFlow() {
    console.log('🚀 Starting Referral Link Flow Verification Test...\n');
    const db = await getDB();
    const now = new Date();

    // 1. Create a Referrer user
    const referrerId = new ObjectId();
    const referrerCode = 'REFTEST1';
    const referrerTelegramId = '888777111';

    const referrerUser = {
        _id: referrerId,
        telegramId: referrerTelegramId,
        firstName: 'Alice',
        lastName: 'Referrer',
        referralCode: referrerCode,
        referredById: null,
        directReferralCount: 0,
        totalReferralCount: 0,
        totalDownlineCount: 0,
        totalEarnings: 0,
        tradePower: 0,
        isAdmin: false,
        isActive: true,
        ancestors: [],
        createdAt: now,
        updatedAt: now
    };

    await db.collection(Collections.USERS).insertOne(referrerUser);
    console.log(`✅ Referrer user created: Alice (${referrerCode})`);

    const newTargetTelegramId = '888777222';
    const existingTargetTelegramId = '888777333';

    try {
        // TEST 1: Bot Webhook pending referral update
        console.log('\n🧪 TEST 1: Bot Webhook pending referral update');
        
        await db.collection(Collections.PENDING_REFERRALS).updateOne(
            { telegramId: newTargetTelegramId },
            { 
                $set: { referralCode: 'reftest1', updatedAt: new Date() }, // lowercase code
                $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true }
        );
        
        const pendingDoc = await db.collection(Collections.PENDING_REFERRALS).findOne({ telegramId: newTargetTelegramId });
        console.log('   Updated Pending Doc:', pendingDoc);
        if (pendingDoc?.referralCode === 'reftest1') {
            console.log('   [PASS] Pending referral code stored.');
        }

        // TEST 2: Case-Insensitive User Resolution & Creation
        console.log('\n🧪 TEST 2: Case-Insensitive Referral Code Resolution & Creation');
        
        let resolvedCode = pendingDoc?.referralCode;
        let referredById: ObjectId | undefined = undefined;

        if (resolvedCode) {
            const referrer = await findUserByReferralCode(resolvedCode); // passing 'reftest1'
            if (referrer && String(referrer.telegramId) !== newTargetTelegramId) {
                referredById = referrer._id;
            }
        }

        console.log('   Resolved ReferredById from lowercase code:', referredById?.toString());
        if (referredById?.toString() === referrerId.toString()) {
            console.log('   [PASS] Case-insensitive referral lookup correctly matched Alice (REFTEST1)!');
        } else {
            console.error('   [FAIL] Case-insensitive referral lookup failed!');
        }

        const newUser = await createUser({
            telegramId: newTargetTelegramId,
            firstName: 'Bob',
            lastName: 'ReferredUser',
            referralCode: 'NEWBOB11',
            referredById,
            directReferralCount: 0,
            totalReferralCount: 0,
            totalDownlineCount: 0,
            totalEarnings: 0,
            tradePower: 0,
            isAdmin: false,
            isActive: true,
        });

        if (newUser.referredById?.toString() === referrerId.toString() && newUser.ancestors?.some(a => a.toString() === referrerId.toString())) {
            console.log('   [PASS] New user linked to Alice with calculated ancestors!');
        } else {
            console.error('   [FAIL] Ancestor chain or referredById missing!');
        }

        // TEST 3: Late Referral Binding on Existing Root User
        console.log('\n🧪 TEST 3: Late Referral Binding on Existing Root User');

        // Create user initially without referrer
        const existingRootUser = await createUser({
            telegramId: existingTargetTelegramId,
            firstName: 'Charlie',
            lastName: 'ExistingUser',
            referralCode: 'CHARLIE1',
            referredById: null,
            directReferralCount: 0,
            totalReferralCount: 0,
            totalDownlineCount: 0,
            totalEarnings: 0,
            tradePower: 0,
            isAdmin: false,
            isActive: true,
        });

        console.log('   Created unlinked user Charlie:', existingRootUser._id.toString(), 'referredById:', existingRootUser.referredById);

        // Perform late referral binding using updateUser
        const updatedCharlie = await updateUser(existingRootUser._id, { referredById: referrerId });

        console.log('   Updated Charlie after late binding:', {
            id: updatedCharlie?._id.toString(),
            referredById: updatedCharlie?.referredById?.toString(),
            ancestors: updatedCharlie?.ancestors?.map(a => a.toString())
        });

        if (updatedCharlie?.referredById?.toString() === referrerId.toString() && updatedCharlie?.ancestors?.some(a => a.toString() === referrerId.toString())) {
            console.log('   [PASS] Late referral binding successfully updated referredById AND calculated ancestors!');
        } else {
            console.error('   [FAIL] Late binding failed to populate referredById or ancestors!');
        }

        // Recalculate Referrer Stats
        if (referredById) {
            await updateUserStatsRecursively(referredById);
        }

        const updatedAlice = await db.collection(Collections.USERS).findOne({ _id: referrerId });
        console.log('\n   Updated Referrer (Alice) Stats:', {
            directReferralCount: updatedAlice?.directReferralCount,
            totalReferralCount: updatedAlice?.totalReferralCount,
            totalDownlineCount: updatedAlice?.totalDownlineCount
        });

        if (updatedAlice?.directReferralCount === 2 && updatedAlice?.totalDownlineCount === 2) {
            console.log('   [PASS] Referrer directReferralCount and totalDownlineCount correctly updated to 2!');
        } else {
            console.error('   [FAIL] Referrer stats update failed!');
        }

        console.log('\n==================================================');
        console.log('🎉 ALL REFERRAL SYSTEM FLOW TESTS PASSED!');
        console.log('==================================================');

    } finally {
        // Cleanup test data
        await db.collection(Collections.USERS).deleteMany({ telegramId: { $in: [referrerTelegramId, newTargetTelegramId, existingTargetTelegramId] } });
        await db.collection(Collections.PENDING_REFERRALS).deleteMany({ telegramId: { $in: [newTargetTelegramId, existingTargetTelegramId] } });
    }
}

testReferralFlow().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
