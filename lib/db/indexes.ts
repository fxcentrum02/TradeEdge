// ===========================================
// DATABASE INDEXES SETUP
// ===========================================

import { getDB } from '../db';
import { Collections } from './collections';

export async function createIndexes() {
    const db = await getDB();

    console.log('Creating MongoDB indexes...');

    // USERS collection
    await db.collection(Collections.USERS).createIndex(
        { telegramId: 1 },
        { unique: true, name: 'telegramId_unique' }
    );
    await db.collection(Collections.USERS).createIndex(
        { referralCode: 1 },
        { unique: true, name: 'referralCode_unique' }
    );
    await db.collection(Collections.USERS).createIndex(
        { referredById: 1 },
        { name: 'referredById_index' }
    );
    await db.collection(Collections.USERS).createIndex(
        { isAdmin: 1 },
        { name: 'isAdmin_index' }
    );

    // WALLETS collection
    await db.collection(Collections.WALLETS).createIndex(
        { userId: 1 },
        { unique: true, name: 'userId_unique' }
    );

    // PLANS collection
    await db.collection(Collections.PLANS).createIndex(
        { isActive: 1 },
        { name: 'isActive_index' }
    );
    await db.collection(Collections.PLANS).createIndex(
        { sortOrder: 1 },
        { name: 'sortOrder_index' }
    );

    // USER_PLANS collection
    await db.collection(Collections.USER_PLANS).createIndex(
        { userId: 1 },
        { name: 'userId_index' }
    );
    await db.collection(Collections.USER_PLANS).createIndex(
        { isActive: 1 },
        { name: 'isActive_index' }
    );
    await db.collection(Collections.USER_PLANS).createIndex(
        { lastRoiDate: 1 },
        { name: 'lastRoiDate_index' }
    );
    await db.collection(Collections.USER_PLANS).createIndex(
        { userId: 1, isActive: 1 },
        { name: 'userId_isActive_index' }
    );

    // PAYMENT_TICKETS collection
    await db.collection(Collections.PAYMENT_TICKETS).createIndex(
        { userId: 1 },
        { name: 'userId_index' }
    );
    await db.collection(Collections.PAYMENT_TICKETS).createIndex(
        { status: 1 },
        { name: 'status_index' }
    );
    await db.collection(Collections.PAYMENT_TICKETS).createIndex(
        { createdAt: -1 },
        { name: 'createdAt_desc_index' }
    );

    // REFERRAL_EARNINGS collection
    await db.collection(Collections.REFERRAL_EARNINGS).createIndex(
        { userId: 1 },
        { name: 'userId_index' }
    );
    await db.collection(Collections.REFERRAL_EARNINGS).createIndex(
        { userId: 1, tier: 1 },
        { name: 'userId_tier_index' }
    );
    await db.collection(Collections.REFERRAL_EARNINGS).createIndex(
        { fromUserId: 1 },
        { name: 'fromUserId_index' }
    );

    // TRANSACTIONS collection
    await db.collection(Collections.TRANSACTIONS).createIndex(
        { userId: 1 },
        { name: 'userId_index' }
    );
    await db.collection(Collections.TRANSACTIONS).createIndex(
        { type: 1 },
        { name: 'type_index' }
    );
    await db.collection(Collections.TRANSACTIONS).createIndex(
        { createdAt: -1 },
        { name: 'createdAt_desc_index' }
    );
    await db.collection(Collections.TRANSACTIONS).createIndex(
        { userId: 1, createdAt: -1 },
        { name: 'userId_createdAt_index' }
    );

    // WITHDRAWALS collection
    await db.collection(Collections.WITHDRAWALS).createIndex(
        { userId: 1 },
        { name: 'userId_index' }
    );
    await db.collection(Collections.WITHDRAWALS).createIndex(
        { status: 1 },
        { name: 'status_index' }
    );
    await db.collection(Collections.WITHDRAWALS).createIndex(
        { createdAt: -1 },
        { name: 'createdAt_desc_index' }
    );

    console.log('✅ Indexes created successfully');
}

// Run this script to create indexes: node -r tsx lib/db/indexes.ts
if (require.main === module) {
    createIndexes()
        .then(() => {
            console.log('Indexes setup complete');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error creating indexes:', error);
            process.exit(1);
        });
}
