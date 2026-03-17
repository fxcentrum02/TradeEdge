// ===========================================
// DATABASE SEED SCRIPT - Create Initial Plans
// ===========================================

import { connectDB } from '../lib/db';
import { Collections } from '../lib/db/collections';
import { createIndexes } from '../lib/db/indexes';

async function seed() {
    console.log('🌱 Starting database seed...');

    const db = await connectDB();

    // Create indexes first
    console.log('Creating indexes...');
    await createIndexes();

    // Check if plans already exist
    const existingPlans = await db.collection(Collections.PLANS).countDocuments({});

    if (existingPlans > 0) {
        console.log('✅ Plans already exist, skipping seed');
        return;
    }

    // Insert initial plans
    console.log('Creating initial plans...');

    const plans = [
        {
            name: 'Starter Plan',
            description: 'Perfect for beginners to start earning',
            minAmount: 10,
            maxAmount: 100,
            dailyRoi: 5.5,
            duration: 30,
            isActive: true,
            sortOrder: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            name: 'Growth Plan',
            description: 'Accelerate your earnings with better returns',
            minAmount: 100,
            maxAmount: 500,
            dailyRoi: 5.5,
            duration: 30,
            isActive: true,
            sortOrder: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            name: 'Premium Plan',
            description: 'Maximum earnings for serious investors',
            minAmount: 500,
            maxAmount: 1000,
            dailyRoi: 5.5,
            duration: 30,
            isActive: true,
            sortOrder: 3,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
        {
            name: 'Elite Plan',
            description: 'VIP tier with exclusive benefits',
            minAmount: 1000,
            maxAmount: 10000,
            dailyRoi: 5.5,
            duration: 30,
            isActive: true,
            sortOrder: 4,
            createdAt: new Date(),
            updatedAt: new Date(),
        },
    ];

    await db.collection(Collections.PLANS).insertMany(plans);

    console.log(`✅ Created ${plans.length} plans`);
    console.log('🎉 Database seed completed successfully!');

    process.exit(0);
}

seed().catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
});
