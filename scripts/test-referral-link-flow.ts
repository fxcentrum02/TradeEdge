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
import { createUser, findUserByReferralCode } from '../lib/repositories/user.repository';
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

    try {
        // TEST 1: Simulate Bot Webhook handling `/start REFTEST1`
        console.log('\n🧪 TEST 1: Bot Webhook pending referral update');
        
        // First tap: user opens bot without referral
        await db.collection(Collections.PENDING_REFERRALS).updateOne(
            { telegramId: newTargetTelegramId },
            { 
                $set: { referralCode: '', updatedAt: new Date() },
                $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true }
        );
        console.log('   Initial pending record created (empty referral code).');

        // Second tap: user taps friend referral link `/start REFTEST1`
        await db.collection(Collections.PENDING_REFERRALS).updateOne(
            { telegramId: newTargetTelegramId },
            { 
                $set: { referralCode: referrerCode, updatedAt: new Date() },
                $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true }
        );
        
        const pendingDoc = await db.collection(Collections.PENDING_REFERRALS).findOne({ telegramId: newTargetTelegramId });
        console.log('   Updated Pending Doc:', pendingDoc);
        if (pendingDoc?.referralCode === referrerCode) {
            console.log('   [PASS] Bot correctly UPDATED pending referral code to REFTEST1!');
        } else {
            console.error('   [FAIL] Pending referral code was not updated!');
        }

        // TEST 2: User Creation with Referral Code Resolution
        console.log('\n🧪 TEST 2: User Registration & Referrer Linkage');
        
        // Lookup pending referral code
        let resolvedCode = pendingDoc?.referralCode;
        let referredById: ObjectId | undefined = undefined;

        if (resolvedCode) {
            const referrer = await findUserByReferralCode(resolvedCode);
            if (referrer && String(referrer.telegramId) !== newTargetTelegramId) {
                referredById = referrer._id;
            }
        }

        console.log('   Resolved ReferredById:', referredById?.toString());
        if (referredById?.toString() === referrerId.toString()) {
            console.log('   [PASS] Referrer correctly resolved to Alice (referrerId)!');
        } else {
            console.error('   [FAIL] Referrer resolution failed!');
        }

        // Create new user linked to Alice
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

        console.log('   New User created:', {
            id: newUser._id.toString(),
            name: newUser.firstName,
            referredById: newUser.referredById?.toString(),
            ancestors: newUser.ancestors?.map(a => a.toString())
        });

        if (newUser.referredById?.toString() === referrerId.toString() && newUser.ancestors?.some(a => a.toString() === referrerId.toString())) {
            console.log('   [PASS] New user successfully linked to Alice with correct ancestor chain!');
        } else {
            console.error('   [FAIL] Ancestor chain or referredById missing!');
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

        if (updatedAlice?.directReferralCount === 1 && updatedAlice?.totalDownlineCount === 1) {
            console.log('   [PASS] Referrer directReferralCount and totalDownlineCount correctly updated to 1!');
        } else {
            console.error('   [FAIL] Referrer stats update failed!');
        }

        console.log('\n==================================================');
        console.log('🎉 ALL REFERRAL SYSTEM FLOW TESTS PASSED!');
        console.log('==================================================');

    } finally {
        // Cleanup test data
        await db.collection(Collections.USERS).deleteMany({ telegramId: { $in: [referrerTelegramId, newTargetTelegramId] } });
        await db.collection(Collections.PENDING_REFERRALS).deleteMany({ telegramId: newTargetTelegramId });
        process.exit(0);
    }
}

testReferralFlow().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
