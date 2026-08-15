import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Collections } from '../lib/db/collections';
import { verifyDeletionPassword } from '../lib/constants';
import type { DeletionLogDocument } from '../lib/db/types';

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
} catch (e) {}

async function testDeletionLogsWithPasswords() {
    console.log('🚀 Running User Deletion Logs & Multi-Password Security Verification Test...\n');

    // 1. Test Password Validation Function
    console.log('--- 1. TESTING SECURITY PASSWORDS ---');
    const testRajesh = verifyDeletionPassword('TradeEdge002');
    console.log('TradeEdge002 check:', testRajesh);
    if (!testRajesh.valid || testRajesh.personName !== 'Rajeshbhai') {
        throw new Error('Failed to verify TradeEdge002 for Rajeshbhai');
    }

    const testKishan = verifyDeletionPassword('999Tradeedge');
    console.log('999Tradeedge check:', testKishan);
    if (!testKishan.valid || testKishan.personName !== 'Kishanbhai') {
        throw new Error('Failed to verify 999Tradeedge for Kishanbhai');
    }

    const testDev = verifyDeletionPassword('dwaparedge007@');
    console.log('dwaparedge007@ check:', testDev);
    if (!testDev.valid || testDev.personName !== 'Developer / System') {
        throw new Error('Failed to verify dwaparedge007@');
    }

    const testInvalid = verifyDeletionPassword('wrongpass123');
    console.log('wrongpass123 check:', testInvalid);
    if (testInvalid.valid) {
        throw new Error('Invalid password was mistakenly approved');
    }
    console.log('✅ Password verification logic verified 100%.\n');

    // 2. Test DB Snapshot & Deletion Log Insertion with Password Trace
    console.log('--- 2. TESTING DELETION LOG DB ENTRY WITH AUTHORIZED PASSWORD ---');
    const uri = process.env.DATABASE_URL!;
    const dbName = process.env.MONGODB_DB_NAME || 'TradeEdge';
    const client = await MongoClient.connect(uri);
    const db = client.db(dbName);

    const now = new Date();
    const referrerId = new ObjectId();
    const targetUserId = new ObjectId();
    const adminId = new ObjectId();

    const targetUser = {
        _id: targetUserId,
        telegramId: '777666555',
        telegramUsername: 'test_secured_user',
        firstName: 'Secured',
        lastName: 'Account',
        referralCode: 'SECURE77',
        tradePower: 500,
        referredById: referrerId,
        directReferralCount: 0,
        totalDownlineCount: 0,
        isActive: true,
        isDeleted: false,
        createdAt: now,
        updatedAt: now
    };

    const referrer = {
        _id: referrerId,
        telegramId: '111222333',
        telegramUsername: 'referrer_boss',
        firstName: 'Boss',
        lastName: 'Referrer',
        referralCode: 'BOSS11',
        tradePower: 1000,
        directReferralCount: 1,
        totalDownlineCount: 1,
        isActive: true,
        isDeleted: false,
        createdAt: now,
        updatedAt: now
    };

    const admin = {
        _id: adminId,
        email: 'admin_security@tradeedge.com',
        name: 'Admin Security Officer',
        role: 'superadmin',
        isActive: true,
        createdAt: now,
        updatedAt: now
    };

    await db.collection(Collections.USERS).insertMany([referrer, targetUser]);
    await db.collection(Collections.ADMINS).insertOne(admin);

    const deletionLogRecord: DeletionLogDocument = {
        deletedUserId: targetUserId,
        userSnapshot: {
            telegramId: targetUser.telegramId,
            telegramUsername: targetUser.telegramUsername,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName,
            referralCode: targetUser.referralCode,
            tradePower: targetUser.tradePower,
            totalReinvested: 0,
            walletBalance: 12.5,
            referralWalletBalance: 5,
            withdrawals: {
                totalCompletedAmount: 50,
                totalCompletedCount: 2,
                totalRequestedAmount: 50,
                totalPendingAmount: 0
            },
            referral: {
                referredById: referrerId,
                referrerName: 'Boss Referrer',
                referrerTelegramId: '111222333',
                directReferralCount: 0,
                totalDownlineCount: 0
            },
            activePlansCount: 1,
            totalPlansCount: 1,
            activePlansSnapshot: [],
            pendingWithdrawalsSnapshot: [],
            userCreatedAt: now
        },
        deletedBy: {
            adminId: adminId.toString(),
            email: admin.email,
            name: admin.name,
            role: admin.role
        },
        authorizedByPassword: {
            personName: testRajesh.personName!,
            passwordKey: testRajesh.passwordKey!
        },
        ip: '103.45.20.11',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        device: 'macOS',
        deletedAt: now,
        deletionType: 'PERMANENT'
    };

    const ins = await db.collection(Collections.DELETION_LOGS).insertOne(deletionLogRecord);
    console.log(`✅ Deletion log with authorization trace inserted with _id: ${ins.insertedId}`);

    const retrieved = await db.collection(Collections.DELETION_LOGS).findOne({ _id: ins.insertedId });
    console.log('\nRetrieved Deletion Log with Security Authorization:');
    console.log(JSON.stringify(retrieved, null, 2));

    if (
        retrieved?.authorizedByPassword?.personName !== 'Rajeshbhai' ||
        retrieved?.authorizedByPassword?.passwordKey !== 'TradeEdge002'
    ) {
        throw new Error('AuthorizedByPassword was not correctly persisted or retrieved!');
    }

    // Cleanup fixtures
    await db.collection(Collections.DELETION_LOGS).deleteOne({ _id: ins.insertedId });
    await db.collection(Collections.USERS).deleteMany({ _id: { $in: [referrerId, targetUserId] } });
    await db.collection(Collections.ADMINS).deleteMany({ _id: adminId });

    console.log('\n🎉 ALL MULTI-PASSWORD & DELETION AUTHORIZATION TESTS PASSED SUCCESSFULLY!');
    await client.close();
    process.exit(0);
}

testDeletionLogsWithPasswords().catch((err) => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
