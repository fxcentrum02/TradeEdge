import { createAdmin, findAdminByEmail } from '../lib/repositories/admin.repository';
import bcrypt from 'bcryptjs';

async function seed() {
    console.log('--- Admin Seed Script ---');
    try {
        const email = 'admin@example.com';
        const passwordStr = process.argv[2] || 'Admin123!';

        const existingAdmin = await findAdminByEmail(email);

        if (existingAdmin) {
            console.log(`Admin ${email} already exists. Skipping.`);
            process.exit(0);
        }

        const passwordHash = await bcrypt.hash(passwordStr, 10);

        const admin = await createAdmin({
            email,
            passwordHash,
            name: 'Super Admin',
            role: 'superadmin',
            isActive: true,
        });

        console.log('Successfully created admin!');
        console.log(`Email: ${email}`);
        console.log(`Password: ${passwordStr}`);
        console.log(`ID: ${admin.id}`);
        process.exit(0);
    } catch (err) {
        console.error('Error seeding admin:', err);
        process.exit(1);
    }
}

seed();
