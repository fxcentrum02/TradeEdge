import { ObjectId } from 'mongodb';
import { getDB } from '../lib/db';
import { Collections } from '../lib/db/collections';
import { findUserByTelegramId, createUser, updateUser, findUserByReferralCode } from '../lib/repositories/user.repository';
import { updateUserStatsRecursively, getReferralStats } from '../lib/referral';
import { generateReferralCode } from '../lib/utils';
import { getOrCreateWallet } from '../lib/wallet';

async function testReferralLogic() {
    console.log('--- Starting Referral Logic Verification ---');
    const db = await getDB();

    // 1. Cleanup old test data
    const testTgId = 'TEST_USER_999';
    const referrerTgId = 'REFERRER_888';
    
    await db.collection(Collections.USERS).deleteMany({ telegramId: { $in: [testTgId, referrerTgId] } });
    await db.collection(Collections.PENDING_REFERRALS).deleteMany({ telegramId: testTgId });

    console.log('1. Creating a Referrer...');
    const referrer = await createUser({
        telegramId: referrerTgId,
        telegramUsername: 'referrer_user',
        firstName: 'Ref',
        lastName: 'Errer',
        referralCode: 'REF_CODE_123',
        directReferralCount: 0,
        totalReferralCount: 0,
        totalDownlineCount: 0,
        totalEarnings: 0,
        tradePower: 0,
        isActive: true,
        isAdmin: false,
    });
    console.log('   Referrer created:', referrer?._id.toString());

    // 2. Simulate Sign-up with Referral Code (Fast Path should be skipped for new users)
    console.log('2. Simulating New User Sign-up with Referral Code...');
    const telegramUser = { id: testTgId, username: 'test_user', first_name: 'Test' };
    const referralCode = 'REF_CODE_123';

    // Logic from /api/auth/telegram (simplified for test)
    let user = await findUserByTelegramId(String(telegramUser.id));
    console.log('   A. Initial lookup (should be null):', !!user);

    if (!user) {
        // Referral binding logic
        let referredById = undefined;
        const referrerFound = await findUserByReferralCode(referralCode);
        if (referrerFound) {
            referredById = referrerFound._id;
            console.log('   B. Referrer resolved:', referredById.toString());
        }

        user = await createUser({
            telegramId: String(telegramUser.id),
            telegramUsername: telegramUser.username,
            firstName: telegramUser.first_name,
            referralCode: generateReferralCode(),
            referredById,
            isActive: true,
        } as any);
        console.log('   C. New user created:', user?._id.toString());

        if (referredById) {
            console.log('   D. Updating referral stats recursively...');
            await updateUserStatsRecursively(referredById);
        }
    }

    // 3. Verify Referrer Stats
    const updatedReferrer = await db.collection(Collections.USERS).findOne({ _id: referrer?._id });
    console.log('3. Verifying Referrer Stats...');
    console.log('   Direct Referral Count (expected 1):', updatedReferrer?.directReferralCount);
    
    if (updatedReferrer?.directReferralCount !== 1) {
        throw new Error('FAILED: Referrer stats not updated correctly!');
    }

    // 4. Simulate Existing User Login (FAST PATH)
    console.log('4. Simulating Existing User Login (Fast Path)...');
    const existingUser = await findUserByTelegramId(String(telegramUser.id));
    console.log('   A. Initial lookup (should be found):', !!existingUser);

    if (existingUser && existingUser.referredById) {
        console.log('   B. User has referredById. Skipping referral logic... (This is the optimization)');
    } else {
        throw new Error('FAILED: Existing user with referrer should trigger fast path!');
    }

    // 5. Verify getReferralStats bulk aggregation
    console.log('5. Verifying getReferralStats (Bulk Aggregation)...');
    const stats = await getReferralStats(existingUser!._id);
    console.log('   Stats retrieved successfully. Tier 1 user count:', stats.tiers[0].userCount);
    // Note: Since we only have the current user in the tree, their stats (T1) should be 0 unless they referred someone.
    // Let's check the referrer's stats.
    const referrerStats = await getReferralStats(referrer!._id);
    console.log('   Referrer Stats - Tier 1 user count (expected 1):', referrerStats.tiers[0].userCount);

    if (referrerStats.tiers[0].userCount !== 1) {
        throw new Error('FAILED: Referral tier stats (bulk aggregate) incorrect!');
    }

    console.log('--- Verification SUCCESSFUL ---');
    process.exit(0);
}

testReferralLogic().catch(err => {
    console.error('Verification FAILED:', err);
    process.exit(1);
});
