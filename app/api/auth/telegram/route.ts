// ===========================================
// TELEGRAM AUTHENTICATION API (MongoDB Native)
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getOrCreateWallet } from '@/lib/wallet';
import { updateUserStatsRecursively } from '@/lib/referral';
import { generateReferralCode } from '@/lib/utils';
import type { ApiResponse, User } from '@/types';
import { findUserByTelegramId, findUserByReferralCode, createUser, updateUser } from '@/lib/repositories/user.repository';
import { remoteLog } from '@/lib/logger';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';

interface TelegramAuthRequest {
    initData: string;
    referralCode?: string;
}

interface TelegramUserData {
    id?: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
}

/**
 * POST /api/auth/telegram - Authenticate via Telegram WebApp
 * Handles both production (real initData with HMAC) and development modes.
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ user: User }>>> {
    try {
        const body: TelegramAuthRequest = await request.json();
        let { initData, referralCode } = body;

        // Get Client IP
        const forwarded = request.headers.get('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0] : (request as any).ip || '127.0.0.1';

        if (!initData) {
            return NextResponse.json({ success: false, error: 'Init data required' }, { status: 400 });
        }

        const parsedData = parseInitData(initData);
        const telegramUser = parsedData.user as TelegramUserData | undefined;

        if (!telegramUser?.id) {
            remoteLog('User ID missing in telegram data', null, 'ERROR');
            return NextResponse.json({ success: false, error: 'User data not found in initData' }, { status: 400 });
        }

        // 1. Initial user lookup (Fast path)
        let user: any = await findUserByTelegramId(String(telegramUser.id));

        // 2. Resolve Referral logic ONLY if user is new or doesn't have a referrer yet
        if (!user || !user.referredById) {
            // Check PENDING_REFERRALS collection FIRST for absolute "First-Referrer Loyalty"
            try {
                const db = await getDB();
                const pending = await db.collection(Collections.PENDING_REFERRALS).findOne({ 
                    telegramId: String(telegramUser.id) 
                });
                if (pending?.referralCode) {
                    referralCode = pending.referralCode;
                }
            } catch (dbError) {
                remoteLog('DB ERROR during pending referral lookup', { error: String(dbError) }, 'WARN');
            }

            // Fallback to initData.start_param
            if (!referralCode && parsedData.start_param) {
                referralCode = parsedData.start_param as string;
            }

            // Save sticky referral for new users
            if (referralCode && !user) {
                try {
                    const db = await getDB();
                    await db.collection(Collections.PENDING_REFERRALS).updateOne(
                        { telegramId: String(telegramUser.id) },
                        { 
                            $set: { updatedAt: new Date() },
                            $setOnInsert: { referralCode, createdAt: new Date() }
                        },
                        { upsert: true }
                    );
                } catch {}
            }
        }

        // Validate the Telegram HMAC signature
        const isValid = validateInitData(initData);

        // In production: require valid signature
        if (!isValid && process.env.NODE_ENV === 'production') {
            return NextResponse.json({ success: false, error: 'Invalid init data' }, { status: 401 });
        }

        if (!isValid) {
            // Validation failed but allowing in dev mode (for local testing)
        }

        if (!telegramUser?.id) {
            return NextResponse.json({ success: false, error: 'User data not found in initData' }, { status: 400 });
        }

        let isNewUser = false;

        // Generate a unique session ID for this login
        const currentSessionId = crypto.randomUUID();

        if (!user) {
            isNewUser = true;

            // Resolve referrer from code
            let referredById = undefined;
            if (referralCode) {
                try {
                    const referrer = await findUserByReferralCode(referralCode);
                    if (referrer) referredById = referrer._id;
                } catch {}
            }

            // Check if admin
            const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
            const isAdmin = adminIds.includes(String(telegramUser.id));

            user = await createUser({
                telegramId: String(telegramUser.id),
                telegramUsername: telegramUser.username || undefined,
                firstName: telegramUser.first_name || undefined,
                lastName: telegramUser.last_name || undefined,
                photoUrl: telegramUser.photo_url || undefined,
                referralCode: generateReferralCode(),
                referredById,
                directReferralCount: 0,
                totalReferralCount: 0,
                totalDownlineCount: 0,
                totalEarnings: 0,
                tradePower: 0,
                lastIp: ip,
                isAdmin,
                isActive: true,
                currentSessionId,
            });

            if (!user) {
                return NextResponse.json({ success: false, error: 'User creation failed' }, { status: 500 });
            }

            // Background tasks: wallet and stats
            await getOrCreateWallet(user._id).catch(() => {});
            if (referredById) {
                updateUserStatsRecursively(referredById).catch(() => {});
            }

        } else {
            // Existing user: check if profile update is needed
            const updates: any = {};
            if (telegramUser.username && telegramUser.username !== user.telegramUsername) updates.telegramUsername = telegramUser.username;
            if (telegramUser.first_name && telegramUser.first_name !== user.firstName) updates.firstName = telegramUser.first_name;
            if (telegramUser.last_name && telegramUser.last_name !== user.lastName) updates.lastName = telegramUser.last_name;
            if (telegramUser.photo_url && telegramUser.photo_url !== user.photoUrl) updates.photoUrl = telegramUser.photo_url;
            if (ip && ip !== user.lastIp) updates.lastIp = ip;
            
            // Late referral binding
            if (referralCode && !user.referredById) {
                try {
                    const referrer = await findUserByReferralCode(referralCode);
                    if (referrer && referrer._id.toString() !== user._id.toString()) {
                        updates.referredById = referrer._id;
                        updateUserStatsRecursively(referrer._id).catch(() => {});
                    }
                } catch {}
            }

            // Always update session ID and timestamp
            updates.currentSessionId = currentSessionId;
            updates.updatedAt = new Date();

            await updateUser(user._id, updates).catch(() => {});
        }

        const userResponse: User = {
            ...user,
            id: user._id.toString(),
            referredById: user.referredById ? user.referredById.toString() : null,
            telegramUsername: user.telegramUsername ?? null,
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            photoUrl: user.photoUrl ?? null,
            directReferralCount: user.directReferralCount,
            totalReferralCount: user.totalReferralCount,
            totalEarnings: user.totalEarnings,
            tradePower: user.tradePower,
        } as unknown as User;

        const response = NextResponse.json({
            success: true,
            data: { user: userResponse },
            message: isNewUser ? 'Welcome! Account created.' : 'Welcome back!',
        });

        // Set session ID cookie (max age 7 days match common pattern)
        response.cookies.set('user_session_id', currentSessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
            path: '/',
        });

        remoteLog('Login success', { isNewUser, userId: user._id.toString(), username: userResponse.telegramUsername });

        return response;

    } catch (error) {
        console.error('[AUTH] Unexpected auth error:', error);
        remoteLog('UNEXPECTED AUTH ERROR', { error: String(error) }, 'ERROR');
        return NextResponse.json({ success: false, error: 'Authentication failed' }, { status: 500 });
    }
}

// Parse Telegram WebApp initData string
function parseInitData(initData: string): Record<string, unknown> {
    const params = new URLSearchParams(initData);
    const data: Record<string, unknown> = {};

    for (const [key, value] of params.entries()) {
        if (key === 'user') {
            try { data[key] = JSON.parse(value); } catch { data[key] = value; }
        } else {
            data[key] = value;
        }
    }

    return data;
}

// Validate Telegram HMAC signature
function validateInitData(initData: string): boolean {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.error('[AUTH] TELEGRAM_BOT_TOKEN not set');
        return false;
    }

    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (!hash) return false;

        params.delete('hash');
        const dataCheckString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join('\n');

        const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
        const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        return calculatedHash === hash;
    } catch {
        return false;
    }
}
