import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyAdminSessionToken } from '@/lib/session';
import { SESSION_CONFIG } from '@/lib/constants';

// We just protect the frontend `/admin` routes here (excluding login).
// API routes are already protected at the route level via `getAdminSessionFromRequest`.

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Only run on non-API /admin routes
    if (pathname.startsWith('/admin') && !pathname.startsWith('/api') && pathname !== '/admin/login') {
        const token = request.cookies.get(SESSION_CONFIG.COOKIE_NAME)?.value;

        if (!token) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }

        const session = await verifyAdminSessionToken(token);

        if (!session) {
            return NextResponse.redirect(new URL('/admin/login', request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/admin/:path*'],
};
