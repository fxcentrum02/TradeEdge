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

        // Parse init data once and reuse
        const parsedData = parseInitData(initData);
        const telegramUser = parsedData.user as TelegramUserData | undefined;

        // 1. Check PENDING_REFERRALS collection FIRST for absolute "First-Referrer Loyalty"
        if (telegramUser?.id) {
            try {
                const db = await getDB();
                const pending = await db.collection(Collections.PENDING_REFERRALS).findOne({ 
                    telegramId: String(telegramUser.id) 
                });
                if (pending?.referralCode) {
                    referralCode = pending.referralCode;
                    remoteLog('Resolved referralCode from PENDING_REFERRALS (Sticky Priority)', { referralCode });
                }
            } catch (dbError) {
                remoteLog('DB ERROR during pending referral lookup', { error: String(dbError) }, 'WARN');
            }
        }

        // 2. If no sticky referral found in DB, check the request body and initData
        if (!referralCode) {
            // Check body first (already extracted at the top)
            if (!referralCode && initData) {
                remoteLog('No sticky referral, checking initData fallback', { 
                    allKeys: Object.keys(parsedData),
                    start_param: parsedData.start_param 
                });
                if (parsedData.start_param) {
                    referralCode = parsedData.start_param as string;
                    remoteLog('Resolved referralCode from initData.start_param', { referralCode });
                }
            }

            // Save this as the "Sticky" referral if we found one now
            if (referralCode && telegramUser?.id) {
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
                    remoteLog('Saved new referral code as sticky', { referralCode });
                } catch (dbError) {
                    remoteLog('DB ERROR saving sticky referral', { error: String(dbError) }, 'WARN');
                }
            }
        }

        remoteLog('Login attempt', { 
            hasInitData: !!initData, 
            referralCode: referralCode || 'none',
            hasReferralInBody: !!body.referralCode 
        });

        // Validate the Telegram HMAC signature
        const isValid = validateInitData(initData);

        remoteLog('Init data validation', {
            isValid,
            keys: Object.keys(parsedData),
            isDev: process.env.NODE_ENV !== 'production',
        });

        // In production: require valid signature
        // In development: allow through even if validation fails (for local testing)
        if (!isValid && process.env.NODE_ENV === 'production') {
            remoteLog('Validation failed in production', null, 'ERROR');
            return NextResponse.json({ success: false, error: 'Invalid init data' }, { status: 401 });
        }

        if (!isValid) {
            remoteLog('Validation failed but allowing in dev mode', null, 'WARN');
        }

        remoteLog('Telegram user from initData', { id: telegramUser?.id, username: telegramUser?.username });

        if (!telegramUser?.id) {
            remoteLog('User ID missing in telegram data', null, 'ERROR');
            return NextResponse.json({ success: false, error: 'User data not found in initData' }, { status: 400 });
        }

        // Find or create user
        let user;
        try {
            user = await findUserByTelegramId(String(telegramUser.id));
            remoteLog('DB lookup', { found: !!user, telegramId: telegramUser.id });
        } catch (dbError) {
            remoteLog('DB ERROR: findUserByTelegramId', { error: String(dbError) }, 'ERROR');
            return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
        }

        let isNewUser = false;

        // Generate a unique session ID for this login
        const currentSessionId = crypto.randomUUID();

        if (!user) {
            isNewUser = true;
            remoteLog('Creating new user', { telegramId: telegramUser.id, username: telegramUser.username });

            // Resolve referrer
            let referredById = undefined;
            if (referralCode) {
                remoteLog('Processing referral code', { referralCode });
                try {
                    const referrer = await findUserByReferralCode(referralCode);
                    if (referrer) {
                        referredById = referrer._id;
                        remoteLog('Referrer found', { referrerId: referredById.toString(), referrerUsername: referrer.telegramUsername });
                    } else {
                        remoteLog('Referral code not found in DB', { referralCode }, 'WARN');
                    }
                } catch (refError) {
                    remoteLog('Referral lookup error', { error: String(refError) }, 'WARN');
                }
            } else {
                remoteLog('No referral code provided (startParam was empty)');
            }

            // Check if admin
            const adminIds = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
            const isAdmin = adminIds.includes(String(telegramUser.id));
            remoteLog('Admin check', { telegramId: telegramUser.id, isAdmin });

            try {
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
                remoteLog('User created', { userId: user?._id?.toString() });
            } catch (createError) {
                remoteLog('DB ERROR: createUser', { error: String(createError) }, 'ERROR');
                return NextResponse.json({ success: false, error: 'Failed to create user' }, { status: 500 });
            }

            if (!user) {
                remoteLog('createUser returned null', null, 'ERROR');
                return NextResponse.json({ success: false, error: 'User creation failed' }, { status: 500 });
            }

            // Create wallet for new user
            try {
                await getOrCreateWallet(user._id);
                remoteLog('Wallet created');
            } catch (walletError) {
                remoteLog('Wallet creation error (non-fatal)', { error: String(walletError) }, 'WARN');
            }

            // Update referral counts
            if (referredById) {
                try {
                    await updateUserStatsRecursively(referredById);
                } catch { /* non-fatal */ }
            }

        } else {
            // Existing user: update latest Telegram profile info and set new session ID
            remoteLog('Existing user login', { userId: user._id.toString(), hasReferrer: !!user.referredById });
            try {
                const updates: any = {
                    telegramUsername: telegramUser.username || user.telegramUsername,
                    firstName: telegramUser.first_name || user.firstName,
                    lastName: telegramUser.last_name || user.lastName,
                    photoUrl: telegramUser.photo_url || user.photoUrl,
                    lastIp: ip,
                    currentSessionId,
                    updatedAt: new Date(),
                };

                // Late referral binding: if user has no referrer and a referral code is provided, bind now
                if (referralCode) {
                    if (!user.referredById) {
                        remoteLog('Late referral binding attempt', { referralCode, userId: user._id.toString() });
                        try {
                            const referrer = await findUserByReferralCode(referralCode);
                            if (referrer && referrer._id.toString() !== user._id.toString()) {
                                updates.referredById = referrer._id;
                                remoteLog('Late referral bound', { referrerId: referrer._id.toString(), referrerUsername: referrer.telegramUsername });

                                // Update referrer's chain stats
                                try { await updateUserStatsRecursively(referrer._id); } catch { /* non-fatal */ }
                            } else if (referrer) {
                                remoteLog('Self-referral blocked', null, 'WARN');
                            }
                        } catch (refError) {
                            remoteLog('Late referral binding error', { error: String(refError) }, 'WARN');
                        }
                    } else {
                        remoteLog('Referral binding skipped: User already has a referrer', {
                            userId: user._id.toString(),
                            existingReferrer: user.referredById.toString(),
                            providedCode: referralCode
                        });
                    }
                }

                await updateUser(user._id, updates);
            } catch { /* non-fatal update */ }
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
