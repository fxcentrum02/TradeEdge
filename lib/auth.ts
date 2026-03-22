// ===========================================
// AUTHENTICATION UTILITIES
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const botToken = process.env.TELEGRAM_BOT_TOKEN || '';

export * from './session';

// ===========================================
// TELEGRAM INIT DATA VERIFICATION (USER AUTH)
// ===========================================

export interface TelegramInitDataParsed {
    user?: {
        id: number;
        is_bot?: boolean;
        first_name: string;
        last_name?: string;
        username?: string;
        language_code?: string;
        is_premium?: boolean;
        added_to_attachment_menu?: boolean;
        allows_write_to_pm?: boolean;
        photo_url?: string;
    };
    query_id?: string;
    auth_date: number;
    hash: string;
    start_param?: string;
}

/**
 * Verifies the integrity of telegram WebApp initData 
 * based on Telegram's cryptographic signature docs.
 */
export function verifyTelegramWebAppData(telegramInitData: string): TelegramInitDataParsed | null {
    try {
        const initData = new URLSearchParams(telegramInitData);
        const hash = initData.get('hash');

        if (!hash || !botToken) {
            return null;
        }

        initData.delete('hash');
        const params = Array.from(initData.entries());
        params.sort(([a], [b]) => a.localeCompare(b));
        const dataCheckString = params.map(([k, v]) => `${k}=${v}`).join('\n');

        const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
        const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        if (calculatedHash === hash) {
            const userStr = initData.get('user');
            const authDate = parseInt(initData.get('auth_date') || '0', 10);

            // Check expiry (e.g., max 24 hours old to prevent replay)
            const isExpired = (Date.now() / 1000 - authDate) > 86400;
            if (isExpired) return null;

            return {
                user: userStr ? JSON.parse(decodeURIComponent(userStr)) : undefined,
                query_id: initData.get('query_id') || undefined,
                auth_date: authDate,
                hash,
                start_param: initData.get('start_param') || undefined,
            };
        }
    } catch (err) {
        console.error('Failed to parse telegram header:', err);
    }

    return null;
}

import { getDB } from './db';
import { Collections } from './db/collections';
import type { UserDocument } from './db/types';

export async function getTelegramUserFromRequest(request: NextRequest): Promise<UserDocument | null> {
    const initData = request.headers.get('x-telegram-init-data');
    if (!initData) return null;

    let telegramId: string | null = null;

    const parsedData = verifyTelegramWebAppData(initData);
    if (!parsedData && process.env.NODE_ENV === 'production') {
        return null;
    }

    if (parsedData && parsedData.user?.id) {
        telegramId = String(parsedData.user.id);
    } else if (process.env.NODE_ENV !== 'production') {
        try {
            const params = new URLSearchParams(initData);
            const userStr = params.get('user');
            if (userStr) {
                const userObj = JSON.parse(decodeURIComponent(userStr));
                if (userObj.id) telegramId = String(userObj.id);
            }
        } catch { }
    }

    if (!telegramId) return null;

    const db = await getDB();
    const user = await db.collection(Collections.USERS).findOne({ telegramId }) as UserDocument | null;
    if (!user) return null;

    // ========================================================
    // SESSION VERIFICATION: Prevent concurrent logins
    // ========================================================
    const sessionId = request.cookies.get('user_session_id')?.value;
    
    // If user has a session ID in DB, they must provide the matching one in cookie
    // This invalidates old sessions if they log in elsewhere.
    if (user.currentSessionId && sessionId !== user.currentSessionId) {
        console.log(`[AUTH] Session mismatch for user ${user._id}. Expected ${user.currentSessionId}, got ${sessionId}`);
        return null;
    }

    return user;
}
