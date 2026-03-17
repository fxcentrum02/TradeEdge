// ===========================================
// EDGE COMPATIBLE SESSION UTILITIES
// ===========================================

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_CONFIG } from './constants';
import type { AdminSessionPayload } from '@/types';

const secretKey = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key-change-me');

// ===========================================
// ADMIN JWT AUTHENTICATION
// ===========================================

export async function createAdminSessionToken(payload: Omit<AdminSessionPayload, 'exp'>): Promise<string> {
    const exp = Math.floor(Date.now() / 1000) + (SESSION_CONFIG.MAX_AGE_DAYS * 24 * 60 * 60);

    return new SignJWT({ ...payload, exp })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_CONFIG.MAX_AGE_DAYS}d`)
        .sign(secretKey);
}

export async function verifyAdminSessionToken(token: string): Promise<AdminSessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, secretKey);
        return payload as unknown as AdminSessionPayload;
    } catch {
        return null;
    }
}

/**
 * Get admin session from cookie only.
 */
export async function getAdminSession(): Promise<AdminSessionPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_CONFIG.COOKIE_NAME)?.value;

    if (!token) {
        return null;
    }

    const session = await verifyAdminSessionToken(token);
    if (!session) {
        console.log(`[AUTH] Admin session verification failed for token`);
    }
    return session;
}

/**
 * Get admin session from a NextRequest.
 */
export async function getAdminSessionFromRequest(request: NextRequest): Promise<AdminSessionPayload | null> {
    const cookieStore = request.cookies.get(SESSION_CONFIG.COOKIE_NAME)?.value;
    const token = cookieStore;

    if (!token) {
        return null;
    }

    const session = await verifyAdminSessionToken(token);
    return session;
}

export function setAdminSessionCookie(response: NextResponse, token: string): void {
    const isLocalhost = process.env.NODE_ENV !== 'production';

    response.cookies.set(SESSION_CONFIG.COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_CONFIG.MAX_AGE_DAYS * 24 * 60 * 60,
        path: '/',
    });
}

export function clearAdminSessionCookie(response: NextResponse): void {
    response.cookies.set(SESSION_CONFIG.COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
    });
}
