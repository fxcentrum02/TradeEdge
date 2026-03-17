// ===========================================
// SCRIPT: Set Telegram Webhook
// Usage: npx tsx scripts/set-webhook.ts <YOUR_URL>
// ===========================================

const urlArg = process.argv[2];

if (!urlArg) {
    console.error('❌ Error: Please provide your webhook URL.');
    console.log('Usage: npx tsx scripts/set-webhook.ts https://your-domain.com/api/bot');
    process.exit(1);
}

const botToken = '8012027261:AAFLqZSuB5pXRqnlLbRpZXDlcQLQk8kOV1A';
const webhookUrl = urlArg.endsWith('/api/bot') ? urlArg : `${urlArg.replace(/\/$/, '')}/api/bot`;

async function setWebhook() {
    console.log(`🚀 Setting webhook to: ${webhookUrl}...`);
    
    try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook?url=${webhookUrl}`);
        const data = await response.json();
        
        if (data.ok) {
            console.log('✅ Webhook set successfully!');
            console.log('Payload:', JSON.stringify(data, null, 2));
            
            console.log('\n--- Status Check ---');
            const statusRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
            const statusData = await statusRes.json();
            console.log(JSON.stringify(statusData, null, 2));
        } else {
            console.error('❌ Failed to set webhook:');
            console.error(JSON.stringify(data, null, 2));
        }
    } catch (error: any) {
        console.error('❌ Network error:', error.message);
    }
}

setWebhook();
