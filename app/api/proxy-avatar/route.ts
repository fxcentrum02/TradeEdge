import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const url = searchParams.get('url');

        if (!url) {
            return new NextResponse('Missing url parameter', { status: 400 });
        }

        // Security check: Only allow Telegram domains to prevent arbitrary open proxy usage
        const allowedPrefixes = [
            'https://t.me/i/userpic/',
            'https://api.telegram.org/',
            'https://telegram.org/'
        ];
        
        const isAllowed = allowedPrefixes.some(prefix => url.startsWith(prefix));
        if (!isAllowed) {
            return new NextResponse('Forbidden target URL', { status: 403 });
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            next: { revalidate: 86400 } // Cache in Next.js server for 24 hours
        });

        if (!response.ok) {
            return new NextResponse(`Failed to fetch image: ${response.statusText}`, { status: response.status });
        }

        const blob = await response.blob();
        const contentType = response.headers.get('Content-Type') || 'image/jpeg';

        // Return the image data with proper headers and caching
        return new NextResponse(blob, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, s-maxage=86400',
            },
        });
    } catch (error) {
        console.error('[proxy-avatar] Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
