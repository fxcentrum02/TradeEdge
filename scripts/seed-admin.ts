import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { createAdmin, findAdminByEmail } from '../lib/repositories/admin.repository';

async function seed() {
    console.log('--- Admin Seed Script ---');
    try {
        const envPath = path.join(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const envFile = fs.readFileSync(envPath, 'utf8');
            envFile.split('\n').forEach(line => {
                const idx = line.indexOf('=');
                if (idx > 0) {
                    const k = line.slice(0, idx).trim();
                    const v = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
                    if (k) process.env[k] = v;
                }
            });
        }
        const email = 'admin@tradeedge.io';
        const passwordStr = process.argv[2] || 'TradeEdge#2026!Admin';

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
