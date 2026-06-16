import { MongoClient } from 'mongodb';

const mainUrl = 'mongodb+srv://fxcentrum02_db_user:K0TgbYmWXmgXejWw@cluster0.zx8ih1.mongodb.net/TradeEdge';
const backupUrl = 'mongodb+srv://fxcentrum02_db_user:K0TgbYmWXmgXejWw@cluster1.2nvx93g.mongodb.net/TradeEdge';
const targetUrl = 'mongodb+srv://tradeedge321_db_user:5Lih1i7NGI1ycG5n@cluster0.2izsdza.mongodb.net/TradeEdge';

async function checkDb(url: string, label: string) {
    console.log(`\n--- Checking ${label} ---`);
    console.log(`URI: ${url.replace(/:([^@]+)@/, ':****@')}`);
    
    let client: MongoClient | null = null;
    try {
        client = await MongoClient.connect(url, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
        });
        const db = client.db('TradeEdge');
        console.log(`✅ ${label} connected successfully!`);
        
        const collections = await db.listCollections().toArray();
        console.log(`Collections found: ${collections.map(c => c.name).join(', ')}`);
        
        let latestDate: Date | null = null;
        let latestCollection = '';
        
        for (const collInfo of collections) {
            const name = collInfo.name;
            if (name.startsWith('system.')) continue;
            
            const coll = db.collection(name);
            const count = await coll.countDocuments();
            console.log(` - Collection "${name}": ${count} documents`);
            
            if (count > 0) {
                const dateFields = ['createdAt', 'updatedAt', 'date', 'timestamp', 'awardedAt', 'lastRoiDate'];
                for (const field of dateFields) {
                    try {
                        const doc = await coll.findOne({}, { sort: { [field]: -1 } });
                        if (doc && doc[field]) {
                            const val = doc[field];
                            let dateVal: Date | null = null;
                            if (val instanceof Date) {
                                dateVal = val;
                            } else if (typeof val === 'string' || typeof val === 'number') {
                                const parsed = new Date(val);
                                if (!isNaN(parsed.getTime())) {
                                    dateVal = parsed;
                                }
                            }
                            
                            if (dateVal) {
                                if (!latestDate || dateVal.getTime() > latestDate.getTime()) {
                                    latestDate = dateVal;
                                    latestCollection = name;
                                }
                            }
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }
        }
        
        if (latestDate) {
            console.log(`📅 Latest record in ${label}: ${latestDate.toISOString()} (in collection "${latestCollection}")`);
        } else {
            console.log(`📅 No date records found in ${label}`);
        }
        
    } catch (error: any) {
        console.error(`❌ ${label} connection FAILED:`, error.message || error);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

async function run() {
    await checkDb(mainUrl, 'Main DB (Suspended)');
    await checkDb(backupUrl, 'Backup DB');
    await checkDb(targetUrl, 'Target DB');
}

run().catch(console.error);
