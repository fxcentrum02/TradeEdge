import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse } from '@/types';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<any>>> {
    return NextResponse.json({ success: false, error: 'Leaderboard is disabled' }, { status: 404 });
}
