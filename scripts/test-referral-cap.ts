
import { getDB } from '../lib/db';
import { Collections } from '../lib/db/collections';
import { generateReferralCode } from '../lib/utils';
import { creditReferralWallet, transferToMainWallet, findReferralWalletByUserId } from '../lib/repositories/referral-wallet.repository';
import { findWalletByUserId, getOrCreateWallet } from '../lib/repositories/wallet.repository';
import { createUserPlan } from '../lib/repositories/user-plan.repository';
import { updateSettings } from '../lib/repositories/settings.repository';
import { ObjectId } from 'mongodb';

async function main() {
    console.log('========================================');
    console.log('REFERRAL CAP TEST');
    console.log('========================================\n');

    const db = await getDB();
    const userId = new ObjectId();

    try {
        // Step 1: Setup User
        await db.collection(Collections.USERS).insertOne({
            _id: userId,
            telegramId: 'test_user_cap',
            referralCode: generateReferralCode(),
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
        console.log(`- Created test user: ${userId}`);

        // Step 2: Set Multiplier to 2x
        await updateSettings({ referralClaimMultiplier: 2 });
        console.log('- Set referral multiplier to 2x');

        // Step 3: Add Active Plan (100 USDT)
        // This gives user 100 USDT Trade Power. With 2x multiplier, they can claim 200 USDT total.
        await createUserPlan({
            userId,
            planId: new ObjectId(),
            amount: 100,
            startDate: new Date(),
            endDate: new Date(Date.now() + 86400000 * 30),
            isActive: true,
            isReinvest: false,
            totalRoiPaid: 0,
        });
        console.log('- Added 100 USDT active plan (Max Claim allowed: 200 USDT)');

        // Step 4: Credit Referral Wallet with 250 USDT
        await creditReferralWallet(userId, 250, 'Test referral income');
        console.log('- Credited referral wallet with 250 USDT');

        // Step 5: First Claim (Should claim 200 USDT, leaving 50 USDT in ref wallet)
        console.log('\n--- Scenario 1: Claim within 2x multiplier (100 TP * 2 = 200) ---');
        const claim1 = await transferToMainWallet(userId);
        console.log('  Claim 1 result:', JSON.stringify(claim1));
        
        const refWallet1 = await findReferralWalletByUserId(userId);
        const mainWallet1 = await findWalletByUserId(userId);
        console.log(`  Referral Balance: ${refWallet1?.balance} (Expected: 50)`);
        console.log(`  Main Balance: ${mainWallet1?.balance} (Expected: 200)`);

        // Step 6: Add 50 USDT more to Ref Wallet (Total to claim now: 100 USDT)
        await creditReferralWallet(userId, 50, 'More referral income');
        console.log('\n- Credited 50 USDT more to referral wallet (Total available in wallet: 100 USDT)');

        // Step 7: Second Claim (Should fail or claim 0 because limit is reached)
        console.log('\n--- Scenario 2: Claim when limit already reached ---');
        const claim2 = await transferToMainWallet(userId);
        console.log('  Claim 2 result:', JSON.stringify(claim2));
        console.log('  (Expected Error about being capped)');

        // Step 8: Add More Trade Power (Increase to 300 USDT total)
        // Now total allowed: 300 * 2 = 600 USDT. Already claimed: 200. Remaining: 400.
        await createUserPlan({
            userId,
            planId: new ObjectId(),
            amount: 200,
            startDate: new Date(),
            endDate: new Date(Date.now() + 86400000 * 30),
            isActive: true,
            isReinvest: false,
            totalRoiPaid: 0,
        });
        console.log('\n- Increased Active Trade Power to 300 USDT (Max Claim allowed: 600 USDT)');

        // Step 9: Third Claim (Should claim the remaining 100 USDT)
        console.log('\n--- Scenario 3: Claim after increasing Trade Power ---');
        const claim3 = await transferToMainWallet(userId);
        console.log('  Claim 3 result:', JSON.stringify(claim3));
        
        const refWallet3 = await findReferralWalletByUserId(userId);
        const mainWallet3 = await findWalletByUserId(userId);
        console.log(`  Referral Balance: ${refWallet3?.balance} (Expected: 0)`);
        console.log(`  Main Balance: ${mainWallet3?.balance} (Expected: 300)`);

    } finally {
        console.log('\n--- Cleanup ---');
        await db.collection(Collections.USERS).deleteOne({ _id: userId });
        await db.collection(Collections.WALLETS).deleteMany({ userId });
        await db.collection(Collections.REFERRAL_WALLETS).deleteMany({ userId });
        await db.collection(Collections.USER_PLANS).deleteMany({ userId });
        await db.collection(Collections.TRANSACTIONS).deleteMany({ userId });
        console.log('  Cleaned up test data.');
    }

    process.exit(0);
}

main().catch(console.error);
