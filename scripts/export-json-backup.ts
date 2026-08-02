// ==========================================================
// SCRIPT: Export Live/Backup MongoDB Database to Local JSON Dump
// Usage: npx tsx scripts/export-json-backup.ts
// ==========================================================

import { MongoClient } from 'mongodb';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

// Load .env manually
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

const URIs = [
    process.env.DATABASE_URL,
    process.env.BACKUP_DATABASE_URL,
    'mongodb+srv://tradeedge321_db_user:5Lih1i7NGI1ycG5n@cluster0.2izsdza.mongodb.net/TradeEdge'
].filter(Boolean) as string[];

async function exportJsonBackup() {
    console.log('🚀 Starting physical JSON export from Database...');
    
    let client: MongoClient | null = null;
    let selectedUri = '';

    for (const uri of URIs) {
        try {
            console.log(`[DB] Attempting connection to: ${uri.replace(/:([^@]+)@/, ':****@')}`);
            client = await MongoClient.connect(uri, {
                connectTimeoutMS: 15000,
                serverSelectionTimeoutMS: 15000,
            });
            selectedUri = uri;
            console.log('✅ Connection established!');
            break;
        } catch (err) {
            console.warn(`[DB] Connection failed: ${(err as Error).message}`);
        }
    }

    if (!client) {
        console.error('❌ Could not connect to database (IP whitelist or TLS handshake blocked by MongoDB Atlas).');
        console.log('👉 Please ensure your current IP address is allowed in MongoDB Atlas Network Access.');
        process.exit(1);
    }

    try {
        const dbName = process.env.MONGODB_DB_NAME || 'TradeEdge';
        const db = client.db(dbName);
        const collections = await db.listCollections().toArray();
        const colNames = collections
            .map(c => c.name)
            .filter(name => !name.startsWith('system.'));

        const backupDir = resolve(__dirname, '../backup_dump');
        mkdirSync(backupDir, { recursive: true });
        console.log(`📁 Target directory: ${backupDir}\n`);

        let totalDocsExported = 0;

        for (const colName of colNames) {
            process.stdout.write(`📦 Exporting collection "${colName}"... `);
            const docs = await db.collection(colName).find({}).toArray();
            totalDocsExported += docs.length;

            const filePath = join(backupDir, `${colName}.json`);
            writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
            const sizeKB = (Buffer.byteLength(JSON.stringify(docs)) / 1024).toFixed(2);
            console.log(`Done! ${docs.length} docs saved -> ${colName}.json (${sizeKB} KB)`);
        }

        console.log('\n============================================');
        console.log('🎉 Physical JSON Backup Completed Successfully!');
        console.log(`   Total Documents Exported: ${totalDocsExported}`);
        console.log(`   Output Folder: ${backupDir}`);
        console.log('============================================');

    } catch (err) {
        console.error('❌ Error exporting database:', err);
    } finally {
        await client.close();
        console.log('🔌 Database connection closed.');
    }
}

exportJsonBackup().catch(console.error);
