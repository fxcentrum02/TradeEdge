// ===========================================
// TEST SCRIPT: 20-Tier ROI Referral Simulation
// Usage: npx tsx scripts/test-roi-referral-20-tiers.ts
// ===========================================

import { getDB } from '../lib/db';
import { Collections } from '../lib/db/collections';
import { generateReferralCode } from '../lib/utils';
import { distributeRoiCommissions, isTierUnlocked } from '../lib/referral';
import { getOrCreateWallet } from '../lib/repositories/wallet.repository';
import { createUserPlan } from '../lib/repositories/user-plan.repository';
import { findPlanById } from '../lib/repositories/plan.repository';
import { ObjectId } from 'mongodb';

async function main() {
    console.log('========================================');
    console.log('20-TIER ROI REFERRAL TEST');
    console.log('========================================\n');

    const db = await getDB();
    const userIds: ObjectId[] = [];
    const userCount = 5; // Testing with 5 levels for efficiency

    // Step 1: Create a chain of 5 users
    console.log(`--- Step 1: Creating a chain of ${userCount} users ---`);
    let referredById: ObjectId | null = null;
    const testPlanId = new ObjectId(); // Mock plan ID
    for (let i = 0; i < userCount; i++) {
        const userId = new ObjectId();
        await db.collection(Collections.USERS).insertOne({
            _id: userId,
            telegramId: `test_user_roi_${i}`,
            telegramUsername: `UserROI${i}`,
            firstName: `User`,
            lastName: `${i}`,
            referralCode: generateReferralCode(),
            referredById: referredById,
            directReferralCount: 0,
            totalReferralCount: 0,
            totalEarnings: 0,
            tradePower: 0, 
            isAdmin: false,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        await getOrCreateWallet(userId);
        userIds.push(userId);
        referredById = userId;
        console.log(`  User ${i} created: ${userId}`);
    }

    // Step 2: Set up investments for unlocking
    console.log('\n--- Step 2: Setting up investments for unlocking ---');
    // Give EVERY user enough investment to unlock their tiers
    for (let i = 0; i < userCount; i++) {
        await db.collection(Collections.USER_PLANS).insertOne({
            userId: userIds[i],
            planId: testPlanId,
            amount: 1000,
            startDate: new Date(),
            endDate: new Date(Date.now() + 30 * 86400000),
            isActive: true,
            isReinvest: false,
            totalRoiPaid: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        // Also update their tradePower for display/stats
        await db.collection(Collections.USERS).updateOne({ _id: userIds[i] }, { $set: { tradePower: 1000 } });
    }

    console.log(`  All users (0-4) now have 1000 USDT investment each.`);
    console.log(`  Each should have unlocked up to Tier 10+ (minimum needed for Tier 4 is 400).`);
    const tier1Unlocked = await isTierUnlocked(userIds[0], 1);
    const tier2Unlocked = await isTierUnlocked(userIds[0], 2);
    const tier14Unlocked = await isTierUnlocked(userIds[0], 14);
    
    console.log(`  Tier 1 unlocked for User 0? ${tier1Unlocked}`);
    console.log(`  Tier 2 unlocked for User 0? ${tier2Unlocked}`);
    console.log(`  Tier 14 unlocked for User 0? ${tier14Unlocked}`);

    // Step 3: User 4 earns ROI, distribute commissions
    console.log('\n--- Step 3: User 4 earns 100 USDT ROI → distributing commissions ---');
    const roiAmount = 100;
    const sourcePlanId = new ObjectId();
    const distributions = await distributeRoiCommissions(userIds[4], roiAmount, sourcePlanId);
    
    console.log('  Distributions:', JSON.stringify(distributions, null, 2));

    // Verify expectations:
    // User 3 (Tier 1) gets 20% of 100 = 20 USDT
    // User 2 (Tier 2) gets 15% of 100 = 15 USDT
    // User 1 (Tier 3) gets 10% of 100 = 10 USDT
    // User 0 (Tier 4) gets 5% of 100 = 5 USDT
    
    const expected = [
        { tier: 1, userId: userIds[3].toString(), amount: 20 },
        { tier: 2, userId: userIds[2].toString(), amount: 15 },
        { tier: 3, userId: userIds[1].toString(), amount: 10 },
        { tier: 4, userId: userIds[0].toString(), amount: 5 },
    ];

    let success = true;
    for (const exp of expected) {
        const found = distributions.find(d => d.tier === exp.tier && d.userId === exp.userId && d.amount === exp.amount);
        if (!found) {
            console.error(`  ERROR: Expected distribution not found or incorrect: Tier ${exp.tier}`);
            success = false;
        } else {
            console.log(`  SUCCESS: Tier ${exp.tier} received ${exp.amount} USDT.`);
        }
    }

    if (success) {
        console.log('\nALL VERIFICATION STEPS PASSED!');
    } else {
        console.log('\nSOME VERIFICATION STEPS FAILED.');
    }

    // Cleanup
    console.log('\n--- Cleanup ---');
    await db.collection(Collections.USERS).deleteMany({ telegramId: { $regex: 'test_user_roi' } });
    await db.collection(Collections.WALLETS).deleteMany({ userId: { $in: userIds } });
    await db.collection(Collections.REFERRAL_WALLETS).deleteMany({ userId: { $in: userIds } });
    await db.collection(Collections.USER_PLANS).deleteMany({ userId: { $in: userIds } });
    await db.collection(Collections.REFERRAL_EARNINGS).deleteMany({ fromUserId: { $in: userIds } });
    await db.collection(Collections.TRANSACTIONS).deleteMany({ userId: { $in: userIds } });
    console.log('  Test data cleaned up.');

    process.exit(success ? 0 : 1);
}

main().catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
});
