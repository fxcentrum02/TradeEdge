import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/session';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';

export async function POST(request: NextRequest) {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { featureTitle, fullName, email, price, action } = body;

        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';
        const userAgent = request.headers.get('user-agent') || 'Unknown Device';

        // 1. Check if this is a main-page click event (just open dialog)
        if (action === 'click') {
            if (!featureTitle) {
                return NextResponse.json({ success: false, error: 'Missing feature title' }, { status: 400 });
            }

            const db = await getDB();
            const clickDoc = {
                featureTitle,
                fullName: 'System Admin',
                email: session.email,
                price: price || 'N/A',
                status: 'clicked',
                createdAt: new Date(),
                requestedBy: session.email,
                ipAddress: ip,
                deviceInfo: userAgent,
            };

            await db.collection(Collections.FEATURE_REQUESTS).insertOne(clickDoc);

            // Dispatch "clicked main page" WhatsApp Alert
            const waPhone = process.env.WHATSAPP_PHONE;
            const waApiKey = process.env.WHATSAPP_API_KEY;
            if (waPhone && waApiKey) {
                const message = `🖱️ *Admin clicked Activate on Main Page!* \n\n` + 
                                `🔹 *Feature*: ${featureTitle}\n` +
                                `💰 *License Price*: ${price || 'N/A'}\n` +
                                `👤 *Admin Session*: ${session.email}\n` +
                                `🌐 *IP Address*: ${ip}\n` +
                                `📱 *Device*: ${userAgent}\n` +
                                `🕒 *Clicked At*: ${new Date().toLocaleString()}`;
                
                const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(waPhone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(waApiKey)}`;
                
                fetch(url).catch(err => {
                    console.error('[Notification] Failed to dispatch CallMeBot WhatsApp click alert:', err);
                });
            } else {
                console.log('[Notification] CallMeBot not configured for click alert.');
            }

            return NextResponse.json({ success: true, message: 'Click alert dispatched' });
        }

        // 2. Otherwise, this is a normal ticket creation/request submission
        if (!featureTitle || !fullName || !email) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const db = await getDB();
        const requestDoc = {
            featureTitle,
            fullName,
            email,
            price,
            status: 'activation requested',
            createdAt: new Date(),
            requestedBy: session.email,
            ipAddress: ip,
            deviceInfo: userAgent,
        };

        const result = await db.collection(Collections.FEATURE_REQUESTS).insertOne(requestDoc);

        // FREE WHATSAPP ALERTS USING CALLMEBOT FOR TICKET SUBMISSION
        const waPhone = process.env.WHATSAPP_PHONE;
        const waApiKey = process.env.WHATSAPP_API_KEY;
        if (waPhone && waApiKey) {
            const message = `🚨 *New TradeEdge Activation Requested!* \n\n` + 
                            `🔹 *Feature*: ${featureTitle}\n` +
                            `👤 *Admin Name*: ${fullName}\n` +
                            `✉️ *Email*: ${email}\n` +
                            `💰 *License Price*: ${price}\n` +
                            `🌐 *IP Address*: ${ip}\n` +
                            `📱 *Device*: ${userAgent}\n` +
                            `🕒 *Requested At*: ${new Date().toLocaleString()}`;
            
            const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(waPhone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(waApiKey)}`;
            
            fetch(url).catch(err => {
                console.error('[Notification] Failed to dispatch CallMeBot WhatsApp activation alert:', err);
            });
        } else {
            console.log('[Notification] CallMeBot not configured. Set WHATSAPP_PHONE and WHATSAPP_API_KEY in .env.');
        }

        return NextResponse.json({ success: true, id: result.insertedId });
    } catch (error: unknown) {
        console.error('Failed to create feature request:', error);
        const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
