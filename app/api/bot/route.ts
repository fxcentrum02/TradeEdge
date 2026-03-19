import { NextRequest, NextResponse } from 'next/server';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const BOT_USERNAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || 'infinityy_global_bot';
const MINI_APP_NAME = process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME || 'infinity_global';

import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';

export async function POST(request: NextRequest) {
    console.log('[BOT] Webhook endpoint hit');
    try {
        const body = await request.json();
        console.log('[BOT] Webhook received:', JSON.stringify(body, null, 2));
        
        // Handle Telegram message
        if (body.message && body.message.text) {
            const chatId = body.message.chat.id;
            const text = body.message.text;

            console.log(`[BOT] Message from ${chatId}: ${text}`);

            // Handle /start [referralCode]
            if (text.startsWith('/start')) {
                const parts = text.split(' ');
                const referralCode = parts.length > 1 ? parts[1] : '';
                
                console.log(`[BOT] Processing /start. Referral code extracted: "${referralCode}"`);

                let startAppLink = `https://t.me/${BOT_USERNAME}/${MINI_APP_NAME}`;
                if (referralCode) {
                    startAppLink += `?startapp=${referralCode}`;
                    
                    // Save pending referral intent for static button support
                    try {
                        const db = await getDB();
                        await db.collection(Collections.PENDING_REFERRALS).updateOne(
                            { telegramId: String(chatId) },
                            { 
                                $set: { 
                                    updatedAt: new Date() 
                                },
                                $setOnInsert: { 
                                    referralCode, 
                                    createdAt: new Date() 
                                }
                            },
                            { upsert: true }
                        );
                        console.log(`[BOT] Saved pending referral for user ${chatId}: ${referralCode}`);
                    } catch (dbError) {
                        console.error('[BOT] Failed to save pending referral:', dbError);
                    }
                }

                console.log(`[BOT] Generated startapp link for user ${chatId}: ${startAppLink}`);

                const welcomeMessage = `Welcome to Trade Edge! 🚀 (Ref: ${referralCode || 'none'})\n\nClick the button below to launch the Mini App and start earning.`;

                const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: welcomeMessage,
                        reply_markup: {
                            inline_keyboard: [[
                                {
                                    text: "🚀 Start Web App",
                                    url: startAppLink
                                }
                            ]]
                        }
                    }),
                });

                const responseData = await response.json();
                console.log('[BOT] Telegram API response:', JSON.stringify(responseData, null, 2));

                if (!response.ok) {
                    console.error('[BOT] Failed to send message:', responseData);
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('[BOT] Error handling webhook:', error);
        return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
    }
}
