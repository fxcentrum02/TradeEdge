import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

async function checkMeetAhir() {
    const uri = process.env.DATABASE_URL!;
    const client = await MongoClient.connect(uri);
    const db = client.db('TradeEdge');

    console.log('=== SEARCHING FOR MEET AHIR IN LIVE DB ===');
    const user = await db.collection('users').findOne({
        $or: [
            { _id: new ObjectId('69bee42f003b9630a61cdefb') },
            { telegramUsername: 'meetahir007' },
            { firstName: { $regex: 'Meet', $options: 'i' } }
        ]
    });

    console.log('Meet Ahir user document in Live DB:', user);

    // Also check backup database cluster
    const backupUri = 'mongodb+srv://dwapartechs:Meetahir1290%40@cluster0.nbrwc5c.mongodb.net/TradeEdge';
    const backupClient = await MongoClient.connect(backupUri);
    const backupDb = backupClient.db('TradeEdge');

    console.log('\n=== SEARCHING FOR MEET AHIR IN CLUSTER0 DB ===');
    const userBackup = await backupDb.collection('users').findOne({
        $or: [
            { _id: new ObjectId('69bee42f003b9630a61cdefb') },
            { telegramUsername: 'meetahir007' },
            { firstName: { $regex: 'Meet', $options: 'i' } }
        ]
    });
    console.log('Meet Ahir user document in Cluster0 DB:', userBackup);

    // Check environment variables for bot and mini app
    console.log('\n=== BOT & REFERRAL CONFIG IN .ENV ===');
    console.log('TELEGRAM_BOT_USERNAME:', process.env.TELEGRAM_BOT_USERNAME);
    console.log('NEXT_PUBLIC_TELEGRAM_BOT_USERNAME:', process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME);
    console.log('NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME:', process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME);

    await client.close();
    await backupClient.close();
    process.exit(0);
}

checkMeetAhir().catch(console.error);
