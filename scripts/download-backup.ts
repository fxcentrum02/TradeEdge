// ==========================================================
// PHYSICAL DATABASE BACKUP SCRIPT
// Downloads all collections from backup DB to local JSON files
// Usage: npx tsx scripts/download-backup.ts
// ==========================================================

import { MongoClient } from 'mongodb';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

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

const BACKUP_URI = process.env.BACKUP_DATABASE_URL;
const DB_NAME = process.env.BACKUP_MONGODB_DB_NAME || 'TradeEdge';

async function downloadBackup() {
    if (!BACKUP_URI) {
        console.error('❌ Error: BACKUP_DATABASE_URL is not set in .env');
        process.exit(1);
    }
    
    console.log('🚀 Initiating Local Database Export...');
    console.log(`Connecting to: ${BACKUP_URI.replace(/:([^@]+)@/, ':****@')}`);
    
    const client = await MongoClient.connect(BACKUP_URI);
    
    try {
        const db = client.db(DB_NAME);
        const collections = await db.listCollections().toArray();
        const colNames = collections.map(c => c.name).filter(name => !name.startsWith('system.'));
        
        // Define backup output folder
        const backupDir = resolve(__dirname, '../backup_dump');
        mkdirSync(backupDir, { recursive: true });
        console.log(`📁 Local backup folder created at: ${backupDir}\n`);
        
        for (const colName of colNames) {
            console.log(`📦 Exporting "${colName}"...`);
            const docs = await db.collection(colName).find({}).toArray();
            console.log(`   Fetched ${docs.length} documents.`);
            
            const filePath = join(backupDir, `${colName}.json`);
            // Format with 2 spaces indentation
            writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf-8');
            console.log(`   💾 Saved to backup_dump/${colName}.json (${(Buffer.byteLength(JSON.stringify(docs))/1024).toFixed(2)} KB)`);
        }
        
        console.log('\n============================================');
        console.log('✅ Physical database backup downloaded successfully!');
        console.log('   All files reside in the "backup_dump/" directory.');
        console.log('============================================');
        
    } catch (err) {
        console.error('❌ Export failed:', err);
    } finally {
        await client.close();
    }
}

downloadBackup().catch(console.error);
