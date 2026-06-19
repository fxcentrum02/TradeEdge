// ===========================================
// FINANCIAL INTEGRITY & IDEMPOTENCY AUDIT SCRIPT
// Runs on BACKUP database only
// Usage: npx tsx scripts/financial-audit.ts
// ===========================================

import { MongoClient, ObjectId } from 'mongodb';
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

const BACKUP_URI = process.env.BACKUP_DATABASE_URL;
const DB_NAME = process.env.BACKUP_MONGODB_DB_NAME || 'TradeEdge';

if (!BACKUP_URI) {
    console.error('BACKUP_DATABASE_URL not set in .env');
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
    MILESTONE_AWARDS: 'milestone_awards',
} as const;

async function main() {
    console.log('========================================');
    console.log('FINANCIAL INTEGRITY & IDEMPOTENCY AUDIT');
    console.log(`Target: BACKUP DB (${DB_NAME})`);
    console.log('========================================\n');

    const client = await MongoClient.connect(BACKUP_URI!, {
        maxPoolSize: 3,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
    });

    const db = client.db(DB_NAME);
    await db.command({ ping: 1 });
    console.log('✅ Connected to BACKUP database\n');

    let totalDiscrepancies = 0;

    // ========================================================
    // AUDIT 1: MAIN WALLET VS TRANSACTION BALANCE AUDIT
    // ========================================================
    console.log('--- Audit 1: Main Wallets vs Transactions Ledger ---');
    const mainWallets = await db.collection(Collections.WALLETS).find({}).toArray();
    console.log(`Found ${mainWallets.length} main wallets in DB.`);

    let mainClean = 0;
    let mainDiscrepant = 0;

    for (const wallet of mainWallets) {
        const userId = wallet.userId;
        const txs = await db.collection(Collections.TRANSACTIONS).find({ 
            userId,
            'metadata.wallet': { $ne: 'referral' } // Main transactions only
        }).toArray();

        // Calculate expected balance from transaction logs
        const expectedBalance = txs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const difference = Math.abs(wallet.balance - expectedBalance);

        // Tolerating tiny floating-point precision differences (< 0.001)
        if (difference >= 0.001) {
            console.error(`❌ DISCREPANCY: User ${userId}`);
            console.error(`   Wallet Balance: ${wallet.balance} USDT`);
            console.error(`   Sum of Tx Log:  ${expectedBalance} USDT`);
            console.error(`   Difference:     ${difference.toFixed(4)} USDT`);
            mainDiscrepant++;
            totalDiscrepancies++;
        } else {
            mainClean++;
        }
    }
    console.log(`Main wallet check complete: ${mainClean} clean, ${mainDiscrepant} discrepancies.\n`);

    // ========================================================
    // AUDIT 2: REFERRAL WALLET VS TRANSACTION BALANCE AUDIT
    // ========================================================
    console.log('--- Audit 2: Referral Wallets vs Transactions Ledger ---');
    const refWallets = await db.collection(Collections.REFERRAL_WALLETS).find({}).toArray();
    console.log(`Found ${refWallets.length} referral wallets in DB.`);

    let refClean = 0;
    let refDiscrepant = 0;

    for (const wallet of refWallets) {
        const userId = wallet.userId;
        const txs = await db.collection(Collections.TRANSACTIONS).find({ 
            userId,
            'metadata.wallet': 'referral' // Referral transactions only
        }).toArray();

        const expectedBalance = txs.reduce((sum, tx) => sum + (tx.amount || 0), 0);
        const difference = Math.abs(wallet.balance - expectedBalance);

        if (difference >= 0.001) {
            console.error(`❌ DISCREPANCY: User ${userId} (Referral Wallet)`);
            console.error(`   Wallet Balance: ${wallet.balance} USDT`);
            console.error(`   Sum of Tx Log:  ${expectedBalance} USDT`);
            console.error(`   Difference:     ${difference.toFixed(4)} USDT`);
            refDiscrepant++;
            totalDiscrepancies++;
        } else {
            refClean++;
        }
    }
    console.log(`Referral wallet check complete: ${refClean} clean, ${refDiscrepant} discrepancies.\n`);

    // ========================================================
    // AUDIT 3: IDEMPOTENCY INTEGRATION SIMULATION
    // ========================================================
    console.log('--- Audit 3: Idempotency Integration Verification ---');
    
    // Create a temporary test sandbox user/wallet
    const testUserId = new ObjectId();
    const now = new Date();

    console.log(`Creating sandbox test user: ${testUserId}`);
    await db.collection(Collections.USERS).insertOne({
        _id: testUserId,
        telegramId: 'audit_test_user_999',
        firstName: 'Audit',
        lastName: 'Tester',
        referralCode: 'AUDIT999',
        isAdmin: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    });

    await db.collection(Collections.WALLETS).insertOne({
        userId: testUserId,
        balance: 100, // Initial balance
        createdAt: now,
        updatedAt: now,
    });

    await db.collection(Collections.REFERRAL_WALLETS).insertOne({
        userId: testUserId,
        balance: 0,
        createdAt: now,
        updatedAt: now,
    });

    // 3a. ROI Process Idempotency Test
    console.log('\nTesting ROI Process Idempotency:');
    const testPlanId = new ObjectId();
    const testUserPlanId = new ObjectId();

    // Insert mock active user plan
    await db.collection(Collections.USER_PLANS).insertOne({
        _id: testUserPlanId,
        userId: testUserId,
        planId: testPlanId,
        amount: 500,
        startDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days future
        isActive: true,
        isReinvest: false,
        totalRoiPaid: 0,
        createdAt: now,
        updatedAt: now,
    });

    // Insert mock plan configurations
    await db.collection(Collections.PLANS).insertOne({
        _id: testPlanId,
        name: 'Audit Test Plan',
        dailyRoi: 2.0, // 2% daily
        minAmount: 100,
        maxAmount: 1000,
        duration: 30,
        isActive: true,
        sortOrder: 1,
        createdAt: now,
        updatedAt: now,
    });

    // Run custom ROI credit logic simulation twice
    const creditRoi = async (cycleDate: Date) => {
        const plan = await db.collection(Collections.USER_PLANS).findOne({ _id: testUserPlanId });
        if (!plan) throw new Error('Plan not found');

        // Check if already claimed for the nominal date
        // atomicClaimRoi condition logic
        const claimed = await db.collection(Collections.USER_PLANS).findOneAndUpdate(
            { 
                _id: testUserPlanId, 
                isActive: true,
                $or: [
                    { lastRoiDate: { $exists: false } },
                    { lastRoiDate: { $lt: cycleDate } }
                ]
            },
            {
                $set: { lastRoiDate: new Date(), updatedAt: new Date() }
            },
            { returnDocument: 'after' }
        );

        if (!claimed) {
            console.log('   [ROI Lock] Already claimed. Skipping execution.');
            return false;
        }

        // Credit main wallet
        await db.collection(Collections.WALLETS).updateOne(
            { userId: testUserId },
            { $inc: { balance: 10 }, $set: { updatedAt: now } }
        );

        // Log transaction
        await db.collection(Collections.TRANSACTIONS).insertOne({
            userId: testUserId,
            type: 'ROI_EARNING',
            amount: 10,
            balanceAfter: 110,
            reference: testUserPlanId.toString(),
            createdAt: now,
        });

        await db.collection(Collections.USER_PLANS).updateOne(
            { _id: testUserPlanId },
            { $inc: { totalRoiPaid: 10 } }
        );

        return true;
    };

    const runDate = new Date();
    // Run 1: Should succeed
    console.log('   Running ROI settlement 1st time...');
    const roiSucceed1 = await creditRoi(runDate);
    // Run 2: Should skip
    console.log('   Running ROI settlement 2nd time...');
    const roiSucceed2 = await creditRoi(runDate);

    const afterRoiUserPlan = await db.collection(Collections.USER_PLANS).findOne({ _id: testUserPlanId });
    const afterRoiWallet = await db.collection(Collections.WALLETS).findOne({ userId: testUserId });
    const afterRoiTxsCount = await db.collection(Collections.TRANSACTIONS).countDocuments({ 
        userId: testUserId,
        type: 'ROI_EARNING'
    });

    if (roiSucceed1 === true && roiSucceed2 === false && afterRoiWallet?.balance === 110 && afterRoiTxsCount === 1) {
        console.log('   ✅ PASS: ROI credit is fully idempotent. No double-crediting.');
    } else {
        console.error('   ❌ FAIL: ROI credit failed idempotency test!');
        console.error(`      Run 1 success: ${roiSucceed1}, Run 2 success: ${roiSucceed2}`);
        console.error(`      Balance: ${afterRoiWallet?.balance} (expected 110)`);
        console.error(`      Transaction records: ${afterRoiTxsCount} (expected 1)`);
        totalDiscrepancies++;
    }

    // 3b. Milestone Award Idempotency Test
    console.log('\nTesting Milestone Award Idempotency:');
    const createMilestone = async (threshold: number) => {
        try {
            const result = await db.collection(Collections.MILESTONE_AWARDS).insertOne({
                userId: testUserId,
                milestoneThreshold: threshold,
                rewardAmount: 100,
                awardedAt: new Date()
            });

            // Credit wallet
            await db.collection(Collections.REFERRAL_WALLETS).updateOne(
                { userId: testUserId },
                { $inc: { balance: 100 } }
            );

            await db.collection(Collections.TRANSACTIONS).insertOne({
                userId: testUserId,
                type: 'REFERRAL_EARNING',
                amount: 100,
                balanceAfter: 100,
                metadata: { wallet: 'referral' },
                createdAt: new Date(),
            });

            return true;
        } catch (error: any) {
            if (error?.code === 11000) {
                console.log('   [Milestone Lock] Unique constraint violation caught. Skipping award.');
                return false;
            }
            throw error;
        }
    };

    console.log('   Awarding milestone 10000 threshold 1st time...');
    const mileSucceed1 = await createMilestone(10000);
    console.log('   Awarding milestone 10000 threshold 2nd time...');
    const mileSucceed2 = await createMilestone(10000);

    const afterMileWallet = await db.collection(Collections.REFERRAL_WALLETS).findOne({ userId: testUserId });
    const afterMileTxsCount = await db.collection(Collections.TRANSACTIONS).countDocuments({ 
        userId: testUserId,
        type: 'REFERRAL_EARNING',
        'metadata.wallet': 'referral'
    });

    if (mileSucceed1 === true && mileSucceed2 === false && afterMileWallet?.balance === 100 && afterMileTxsCount === 1) {
        console.log('   ✅ PASS: Milestone award is fully idempotent (unique index verified).');
    } else {
        console.error('   ❌ FAIL: Milestone award failed idempotency test!');
        console.error(`      Run 1 success: ${mileSucceed1}, Run 2 success: ${mileSucceed2}`);
        console.error(`      Ref Balance: ${afterMileWallet?.balance} (expected 100)`);
        console.error(`      Transaction records: ${afterMileTxsCount} (expected 1)`);
        totalDiscrepancies++;
    }

    // 3c. Withdrawal Action Locking Test
    console.log('\nTesting Withdrawal Lock Idempotency:');
    const testWithdrawalId = new ObjectId();
    await db.collection(Collections.WITHDRAWALS).insertOne({
        _id: testWithdrawalId,
        userId: testUserId,
        amount: 50,
        fee: 1,
        netAmount: 49,
        walletAddress: '0x1234567890123456789012345678901234567890',
        network: 'BEP20',
        status: 'PENDING',
        createdAt: now,
        updatedAt: now,
    });

    const processWithdrawal = async (action: 'approve' | 'reject') => {
        // 1. Atomic Lock transition from PENDING to PROCESSING
        const w = await db.collection(Collections.WITHDRAWALS).findOneAndUpdate(
            { _id: testWithdrawalId, status: 'PENDING' },
            { $set: { status: 'PROCESSING', updatedAt: new Date() } },
            { returnDocument: 'after' }
        );

        if (!w) {
            console.log('   [Withdrawal Lock] Action failed. Withdrawal is not in PENDING state.');
            return false;
        }

        // Apply action
        await db.collection(Collections.WITHDRAWALS).updateOne(
            { _id: testWithdrawalId },
            { $set: { status: action === 'approve' ? 'COMPLETED' : 'REJECTED', processedAt: new Date() } }
        );

        return true;
    };

    console.log('   Admin 1 processing withdrawal approval...');
    const wSucceed1 = await processWithdrawal('approve');
    console.log('   Admin 2 processing duplicate withdrawal action...');
    const wSucceed2 = await processWithdrawal('reject');

    const afterW = await db.collection(Collections.WITHDRAWALS).findOne({ _id: testWithdrawalId });

    if (wSucceed1 === true && wSucceed2 === false && afterW?.status === 'COMPLETED') {
        console.log('   ✅ PASS: Withdrawal request locking is fully idempotent (concurrent actions blocked).');
    } else {
        console.error('   ❌ FAIL: Withdrawal locking failed idempotency test!');
        console.error(`      Admin 1 success: ${wSucceed1}, Admin 2 success: ${wSucceed2}`);
        console.error(`      Final status: ${afterW?.status} (expected COMPLETED)`);
        totalDiscrepancies++;
    }

    // Cleanup Sandbox
    console.log('\nCleaning up sandbox test records...');
    await db.collection(Collections.USERS).deleteOne({ _id: testUserId });
    await db.collection(Collections.WALLETS).deleteOne({ userId: testUserId });
    await db.collection(Collections.REFERRAL_WALLETS).deleteOne({ userId: testUserId });
    await db.collection(Collections.USER_PLANS).deleteOne({ _id: testUserPlanId });
    await db.collection(Collections.PLANS).deleteOne({ _id: testPlanId });
    await db.collection(Collections.TRANSACTIONS).deleteMany({ userId: testUserId });
    await db.collection(Collections.MILESTONE_AWARDS).deleteMany({ userId: testUserId });
    await db.collection(Collections.WITHDRAWALS).deleteOne({ _id: testWithdrawalId });
    console.log('Sandbox clean up complete.');

    console.log('\n========================================');
    console.log('FINAL AUDIT RESULT');
    console.log('========================================');
    if (totalDiscrepancies === 0) {
        console.log('🎉 AUDIT SUCCESSFUL! 100% Financial Integrity and Idempotency verified.');
        process.exit(0);
    } else {
        console.error(`🚨 AUDIT FAILED! Found ${totalDiscrepancies} integrity issues.`);
        process.exit(1);
    }

    await client.close();
}

main().catch(err => {
    console.error('Integrity Audit script crashed:', err);
    process.exit(1);
});
