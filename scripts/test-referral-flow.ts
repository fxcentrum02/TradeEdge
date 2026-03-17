// ===========================================
// TEST SCRIPT: Referral Flow Simulation
// Usage: npx tsx scripts/test-referral-flow.ts
// ===========================================

import { getDB } from '../lib/db';
import { Collections } from '../lib/db/collections';
import { generateReferralCode } from '../lib/utils';
import { distributeReferralCommissions } from '../lib/referral';
import { findReferralWalletByUserId, transferToMainWallet } from '../lib/repositories/referral-wallet.repository';
import { findWalletByUserId, getOrCreateWallet } from '../lib/repositories/wallet.repository';
import { createUserPlan } from '../lib/repositories/user-plan.repository';
import { findPlanForAmount } from '../lib/repositories/plan.repository';
import { ObjectId } from 'mongodb';

async function main() {
    console.log('========================================');
    console.log('REFERRAL FLOW TEST');
    console.log('========================================\n');

    const db = await getDB();

    // Step 1: Create referrer user (the upline)
    console.log('--- Step 1: Creating referrer user ---');
    const referrerId = new ObjectId();
    const referrerCode = generateReferralCode();
    await db.collection(Collections.USERS).insertOne({
        _id: referrerId,
        telegramId: 'test_referrer_001',
        telegramUsername: 'TestReferrer',
        firstName: 'Referrer',
        lastName: 'User',
        referralCode: referrerCode,
        directReferralCount: 0,
        totalReferralCount: 0,
        totalEarnings: 0,
        tradePower: 0,
        isAdmin: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    await getOrCreateWallet(referrerId);
    console.log(`  Referrer created: ${referrerId} (code: ${referrerCode})`);

    // Step 2: Create referred user (referred BY the referrer above)
    console.log('\n--- Step 2: Creating referred user ---');
    const referredId = new ObjectId();
    await db.collection(Collections.USERS).insertOne({
        _id: referredId,
        telegramId: 'test_referred_001',
        telegramUsername: 'TestReferred',
        firstName: 'Referred',
        lastName: 'User',
        referralCode: generateReferralCode(),
        referredById: referrerId,
        directReferralCount: 0,
        totalReferralCount: 0,
        totalEarnings: 0,
        tradePower: 0,
        isAdmin: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    await getOrCreateWallet(referredId);
    console.log(`  Referred user created: ${referredId} (referredBy: ${referrerId})`);

    // Step 3: Referred user buys MP of 100 USDT (first purchase, > 50 → triggers 10 USDT bonus)
    console.log('\n--- Step 3: First purchase (100 USDT) → expect 10 USDT bonus ---');
    const plan = await findPlanForAmount(100);
    if (!plan) {
        console.error('  ERROR: No plan tier found for 100 USDT. Please seed plans first.');
        return;
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + plan.duration);

    const userPlan1 = await createUserPlan({
        userId: referredId,
        planId: plan._id,
        amount: 100,
        startDate,
        endDate,
        isActive: true,
        isReinvest: false,
        totalRoiPaid: 0,
    });

    const commissions1 = await distributeReferralCommissions(referredId, userPlan1!._id, 100, false);
    console.log('  Commissions distributed:', JSON.stringify(commissions1, null, 2));

    const refWallet1 = await findReferralWalletByUserId(referrerId);
    console.log(`  Referrer referral wallet balance: ${refWallet1?.balance} USDT`);
    console.log(`  Expected: 10 USDT (first purchase bonus)`);

    // Step 4: Referred user buys MP again (200 USDT) → should get 1% = 2 USDT, NOT 10
    console.log('\n--- Step 4: Second purchase (200 USDT) → expect 1% = 2 USDT ---');
    const userPlan2 = await createUserPlan({
        userId: referredId,
        planId: plan._id,
        amount: 200,
        startDate,
        endDate,
        isActive: true,
        isReinvest: false,
        totalRoiPaid: 0,
    });

    const commissions2 = await distributeReferralCommissions(referredId, userPlan2!._id, 200, false);
    console.log('  Commissions distributed:', JSON.stringify(commissions2, null, 2));

    const refWallet2 = await findReferralWalletByUserId(referrerId);
    console.log(`  Referrer referral wallet balance: ${refWallet2?.balance} USDT`);
    console.log(`  Expected: 12 USDT (10 bonus + 2 from 1%)`);

    // Step 5: Test reinvest (should NOT trigger commissions)
    console.log('\n--- Step 5: Reinvest (150 USDT) → expect NO commissions ---');
    const userPlan3 = await createUserPlan({
        userId: referredId,
        planId: plan._id,
        amount: 150,
        startDate,
        endDate,
        isActive: true,
        isReinvest: true,
        totalRoiPaid: 0,
    });

    const commissions3 = await distributeReferralCommissions(referredId, userPlan3!._id, 150, true);
    console.log('  Commissions distributed:', JSON.stringify(commissions3, null, 2));

    const refWallet3 = await findReferralWalletByUserId(referrerId);
    console.log(`  Referrer referral wallet balance: ${refWallet3?.balance} USDT`);
    console.log(`  Expected: 12 USDT (unchanged, reinvest skipped)`);

    // Step 6: Test transfer to main wallet
    console.log('\n--- Step 6: Transfer referral wallet → main wallet ---');
    const transferResult = await transferToMainWallet(referrerId);
    console.log(`  Transfer result: ${JSON.stringify(transferResult)}`);

    const mainWallet = await findWalletByUserId(referrerId);
    const refWalletFinal = await findReferralWalletByUserId(referrerId);
    console.log(`  Main wallet balance: ${mainWallet?.balance} USDT`);
    console.log(`  Referral wallet balance: ${refWalletFinal?.balance} USDT`);
    console.log(`  Expected: main = 12, referral = 0`);

    // Cleanup
    console.log('\n--- Cleanup ---');
    await db.collection(Collections.USERS).deleteMany({ telegramId: { $in: ['test_referrer_001', 'test_referred_001'] } });
    await db.collection(Collections.WALLETS).deleteMany({ userId: { $in: [referrerId, referredId] } });
    await db.collection(Collections.REFERRAL_WALLETS).deleteMany({ userId: { $in: [referrerId, referredId] } });
    await db.collection(Collections.USER_PLANS).deleteMany({ userId: { $in: [referrerId, referredId] } });
    await db.collection(Collections.REFERRAL_EARNINGS).deleteMany({ $or: [{ userId: referrerId }, { fromUserId: referredId }] });
    await db.collection(Collections.TRANSACTIONS).deleteMany({ userId: { $in: [referrerId, referredId] } });
    console.log('  Test data cleaned up.');

    console.log('\n========================================');
    console.log('TEST COMPLETE');
    console.log('========================================');
    process.exit(0);
}

main().catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
});
