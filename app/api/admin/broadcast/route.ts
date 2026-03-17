import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';
import type { ApiResponse } from '@/types';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 403 });
        }

        const { message, segment } = await request.json();

        if (!message) {
            return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
        }

        const db = await getDB();

        // Define filters based on segment
        let query: any = { isActive: true, isAdmin: false };
        if (segment === 'active_traders') {
            query.tradePower = { $gt: 0 };
        } else if (segment === 'inactive_users') {
            query.tradePower = { $lte: 0 };
        }

        const users = await db.collection(Collections.USERS).find(query).toArray();
        const totalUsers = users.length;

        if (totalUsers === 0) {
            return NextResponse.json({ success: false, error: 'No users found in this segment' }, { status: 404 });
        }

        // Background broadcasting (we don't wait for all to finish before returning response)
        // In a production app, this should be a background job (BullMQ, etc.)
        // For simplicity, we'll use a controlled loop with delays
        (async () => {
            let successCount = 0;
            let failCount = 0;

            for (const user of users) {
                if (!user.telegramId) continue;

                try {
                    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: user.telegramId,
                            text: message,
                            parse_mode: 'HTML',
                        }),
                    });

                    if (res.ok) {
                        successCount++;
                    } else {
                        failCount++;
                        const errorData = await res.json();
                        console.error(`Broadcast failed for ${user.telegramId}:`, errorData);
                    }
                } catch (error) {
                    failCount++;
                    console.error(`Broadcast network error for ${user.telegramId}:`, error);
                }

                // Rate limiting: Telegram allows ~30 messages per second.
                // We'll be conservative and wait 100ms between messages.
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`Broadcast completed: ${successCount} successful, ${failCount} failed.`);
        })();

        return NextResponse.json({
            success: true,
            data: {
                totalTargeted: totalUsers,
                message: `Broadcast started to ${totalUsers} users.`
            }
        });

    } catch (error) {
        console.error('[broadcast] error:', error);
        return NextResponse.json({ success: false, error: 'Failed to start broadcast' }, { status: 500 });
    }
}
