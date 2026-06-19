// ===========================================
// WITHDRAWAL SERVICE INTEGRATION TEST
// Runs on BACKUP database only
// Usage: npx tsx scripts/test-withdrawal-service.ts
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

// Force DATABASE_URL to backup database URL for safety
const BACKUP_URI = process.env.BACKUP_DATABASE_URL;
const DB_NAME = process.env.BACKUP_MONGODB_DB_NAME || 'TradeEdge';
process.env.DATABASE_URL = BACKUP_URI;

if (!BACKUP_URI) {
    console.error('BACKUP_DATABASE_URL not set in .env');
    process.exit(1);
}

// Import services and repositories after setting process.env.DATABASE_URL
import { WithdrawalService } from '../lib/services/withdrawal.service';
import { getSettings, updateSettings } from '../lib/repositories/settings.repository';
import { findWalletByUserId } from '../lib/repositories/wallet.repository';
import { findUserById } from '../lib/repositories/user.repository';

const Collections = {
    USERS: 'users',
    WALLETS: 'wallets',
    WITHDRAWALS: 'withdrawals',
    TRANSACTIONS: 'transactions',
    SETTINGS: 'settings',
};

async function main() {
    console.log('========================================');
    console.log('WITHDRAWAL SERVICE INTEGRATION TEST');
    console.log(`Target DB: BACKUP (${DB_NAME})`);
    console.log('========================================\n');

    const client = await MongoClient.connect(BACKUP_URI!, {
        maxPoolSize: 3,
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
    });
    const db = client.db(DB_NAME);
    await db.command({ ping: 1 });
    console.log('✅ Connected to backup database');

    const testUserId = new ObjectId();
    const testAdminId = new ObjectId();
    const now = new Date();

    // 1. Setup mock user and wallet
    await db.collection(Collections.USERS).insertOne({
        _id: testUserId,
        telegramId: 'withdrawal_test_user_888',
        firstName: 'Withdrawal',
        lastName: 'Tester',
        referralCode: 'WITHDRAW888',
        isAdmin: false,
        isActive: true,
        createdAt: now,
        updatedAt: now,
    });

    await db.collection(Collections.WALLETS).insertOne({
        userId: testUserId,
        balance: 100, // starts with 100 USDT
        createdAt: now,
        updatedAt: now,
    });

    console.log(`Created test user ${testUserId} with 100 USDT balance.`);

    // Capture initial settings state to restore later
    const originalSettings = await getSettings();

    try {
        // ========================================================
        // TEST 1: EVM Address Validation
        // ========================================================
        console.log('\n--- Test 1: EVM Address Validation ---');
        const userDoc = await findUserById(testUserId);
        
        // Invalid address (wrong length)
        const invalidRes1 = await WithdrawalService.requestWithdrawal(
            userDoc!,
            20,
            '0xInvalidAddress'
        );
        if (invalidRes1.success === false && invalidRes1.error?.includes('Invalid wallet address')) {
            console.log('✅ Pass: Correctly rejected invalid address format');
        } else {
            console.error('❌ Fail: Accepted invalid address format', invalidRes1);
        }

        // ========================================================
        // TEST 2: Minimum Amount & Balance Checks
        // ========================================================
        console.log('\n--- Test 2: Minimum Amount & Balance Checks ---');
        
        // Try requesting less than minimum (default settings minimum is 10)
        const minAmountRes = await WithdrawalService.requestWithdrawal(
            userDoc!,
            5,
            '0x1234567890123456789012345678901234567890'
        );
        if (minAmountRes.success === false && minAmountRes.error?.includes('Minimum')) {
            console.log('✅ Pass: Correctly rejected request below min threshold');
        } else {
            console.error('❌ Fail: Allowed request below min threshold', minAmountRes);
        }

        // Try requesting more than wallet balance (100 USDT)
        const overLimitRes = await WithdrawalService.requestWithdrawal(
            userDoc!,
            150,
            '0x1234567890123456789012345678901234567890'
        );
        if (overLimitRes.success === false && overLimitRes.error === 'Insufficient balance') {
            console.log('✅ Pass: Correctly rejected request exceeding balance');
        } else {
            console.error('❌ Fail: Allowed request exceeding balance', overLimitRes);
        }

        // ========================================================
        // TEST 3: Maintenance Mode Lock
        // ========================================================
        console.log('\n--- Test 3: Maintenance Mode Check ---');
        await updateSettings({ maintenanceMode: true });
        
        const maintenanceRes = await WithdrawalService.requestWithdrawal(
            userDoc!,
            20,
            '0x1234567890123456789012345678901234567890'
        );
        if (maintenanceRes.success === false && maintenanceRes.status === 503) {
            console.log('✅ Pass: Blocked withdrawal request during maintenance mode');
        } else {
            console.error('❌ Fail: Allowed withdrawal request during maintenance mode', maintenanceRes);
        }

        // Re-enable withdrawals
        await updateSettings({ maintenanceMode: false });

        // ========================================================
        // TEST 4: Successful Request & Cooldown
        // ========================================================
        console.log('\n--- Test 4: Successful Request & Cooldown ---');
        
        // Configure FIXED fee for test
        await updateSettings({
            withdrawalFeeType: 'FIXED',
            withdrawalFeeValue: 2, // 2 USDT fee
        });

        // Request 50 USDT withdrawal
        const successRes = await WithdrawalService.requestWithdrawal(
            userDoc!,
            50,
            '0x1234567890123456789012345678901234567890'
        );

        const updatedWallet = await findWalletByUserId(testUserId);
        const latestUserDoc = await findUserById(testUserId);

        if (
            successRes.success && 
            successRes.data.fee === 2 && 
            successRes.data.netAmount === 48 && 
            updatedWallet?.balance === 50
        ) {
            console.log('✅ Pass: Request created, wallet debited (100 -> 50), correct fee applied');
        } else {
            console.error('❌ Fail: Successful request verification failed', { successRes, updatedWallet });
        }

        // Try requesting again immediately (should hit 24h cooldown)
        const cooldownRes = await WithdrawalService.requestWithdrawal(
            latestUserDoc!,
            20,
            '0x1234567890123456789012345678901234567890'
        );

        if (cooldownRes.success === false && cooldownRes.error?.includes('cooldown')) {
            console.log('✅ Pass: Cooldown correctly blocked concurrent requests');
        } else {
            console.error('❌ Fail: Bypassed cooldown constraint', cooldownRes);
        }

        // ========================================================
        // TEST 5: Admin Processing (Approval)
        // ========================================================
        console.log('\n--- Test 5: Admin Approval ---');
        const withdrawalId = successRes.data._id;

        const approveRes = await WithdrawalService.adminProcessWithdrawal(
            withdrawalId,
            'approve',
            testAdminId.toString(),
            '0xHashApprovedString'
        );

        const checkApproved = await db.collection(Collections.WITHDRAWALS).findOne({ _id: new ObjectId(withdrawalId) });

        if (approveRes.success && checkApproved?.status === 'COMPLETED' && checkApproved.txHash === '0xHashApprovedString') {
            console.log('✅ Pass: Admin approved withdrawal, status moved to COMPLETED, txHash recorded');
        } else {
            console.error('❌ Fail: Admin approval failed', { approveRes, checkApproved });
        }

        // ========================================================
        // TEST 6: Admin Processing (Rejection & Refund)
        // ========================================================
        console.log('\n--- Test 6: Admin Rejection & Refund ---');

        // Create a new request for rejection testing
        // bypass cooldown checks by directly updating user doc in DB
        await db.collection(Collections.USERS).updateOne({ _id: testUserId }, { $unset: { lastWithdrawalAt: "" } });
        const freshUserDoc = await findUserById(testUserId);

        const rejectTestRequest = await WithdrawalService.requestWithdrawal(
            freshUserDoc!,
            30, // debits 30, balance becomes 20
            '0x1234567890123456789012345678901234567890'
        );

        const rejectWithdrawalId = rejectTestRequest.data._id;

        // Reject it
        const rejectRes = await WithdrawalService.adminProcessWithdrawal(
            rejectWithdrawalId,
            'reject',
            testAdminId.toString(),
            undefined,
            'Rejected due to test'
        );

        const checkRejected = await db.collection(Collections.WITHDRAWALS).findOne({ _id: new ObjectId(rejectWithdrawalId) });
        const finalWallet = await findWalletByUserId(testUserId);

        if (
            rejectRes.success && 
            checkRejected?.status === 'REJECTED' && 
            finalWallet?.balance === 50 // refunded 30 (20 + 30 = 50)
        ) {
            console.log('✅ Pass: Withdrawal rejected, status set to REJECTED, 30 USDT refunded to wallet');
        } else {
            console.error('❌ Fail: Admin rejection/refund failed', { rejectRes, checkRejected, finalWallet });
        }

    } finally {
        // Cleanup Sandbox
        console.log('\n--- Cleaning up sandbox test records ---');
        await db.collection(Collections.USERS).deleteOne({ _id: testUserId });
        await db.collection(Collections.WALLETS).deleteOne({ userId: testUserId });
        await db.collection(Collections.WITHDRAWALS).deleteMany({ userId: testUserId });
        await db.collection(Collections.TRANSACTIONS).deleteMany({ userId: testUserId });
        
        // Restore original settings
        await db.collection(Collections.SETTINGS).replaceOne({ _id: 'global_settings_singleton' as any }, originalSettings as any);
        console.log('Sandbox clean up complete.');
    }

    await client.close();
    console.log('\n========================================');
    console.log('WITHDRAWAL TEST COMPLETE');
    console.log('========================================');
}

main().catch(err => {
    console.error('Test crashed:', err);
    process.exit(1);
});
