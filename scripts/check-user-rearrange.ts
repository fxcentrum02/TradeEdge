import { MongoClient } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
} catch { /* ignore */ }

async function findMissing() {
    const uri = process.env.DATABASE_URL;
    const dbName = process.env.MONGODB_DB_NAME || 'TradeEdge';
    const client = await MongoClient.connect(uri!);
    const db = client.db(dbName);
    const usersCol = db.collection('users');
    const pendingCol = db.collection('pending_referrals');

    console.log('🔍 Searching pending_referrals for 8507309761...');
    const pendingDoc = await pendingCol.findOne({ telegramId: '8507309761' });
    console.log('Pending doc:', pendingDoc);

    console.log('\n🔍 Searching users for name matching "KELAL" or "JJADAV"...');
    const userByName = await usersCol.find({
        $or: [
            { firstName: { $regex: /kelal/i } },
            { lastName: { $regex: /jadav/i } },
            { firstName: { $regex: /jjadav/i } }
        ]
    }).toArray();
    console.log('Users found by name:', userByName.map(u => ({ _id: u._id, telegramId: u.telegramId, firstName: u.firstName, lastName: u.lastName })));

    await client.close();
}

findMissing().catch(console.error);
