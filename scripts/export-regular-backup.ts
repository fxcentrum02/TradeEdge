import { MongoClient } from 'mongodb';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
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

async function exportRegularBackup() {
    const liveUri = process.env.DATABASE_URL;
    if (!liveUri) {
        throw new Error('DATABASE_URL is not set in environment or .env');
    }

    const targetDir = resolve(__dirname, '../backup_dump_regular');
    console.log(`\n======================================================`);
    console.log(`📦 EXPORTING REGULAR LIVE BACKUP (Monthly / On-Demand)`);
    console.log(`   Destination: ${targetDir}`);
    console.log(`======================================================`);

    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
    }

    const client = await MongoClient.connect(liveUri);
    const db = client.db('TradeEdge');

    const collections = await db.listCollections().toArray();
    let totalDocs = 0;
    const summary: { [col: string]: number } = {};

    for (const col of collections) {
        const colName = col.name;
        if (colName.startsWith('system.')) continue;

        const docs = await db.collection(colName).find({}).toArray();
        totalDocs += docs.length;
        summary[colName] = docs.length;

        const outPath = resolve(targetDir, `${colName}.json`);
        writeFileSync(outPath, JSON.stringify(docs, null, 2), 'utf-8');
        console.log(`  ✓ ${colName.padEnd(25)} -> ${docs.length.toString().padStart(6)} documents written`);
    }

    const metadata = {
        label: 'Regular Live Production Database Backup',
        databaseName: 'TradeEdge',
        exportedAt: new Date().toISOString(),
        totalCollections: Object.keys(summary).length,
        totalDocuments: totalDocs,
        collections: summary
    };
    writeFileSync(resolve(targetDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf-8');

    console.log(`\n🎉 Regular backup updated successfully! Total ${totalDocs} documents exported to backup_dump_regular.`);
    await client.close();
    process.exit(0);
}

exportRegularBackup().catch((err) => {
    console.error('❌ Regular backup failed:', err);
    process.exit(1);
});
