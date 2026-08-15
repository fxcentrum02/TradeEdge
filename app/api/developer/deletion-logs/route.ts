import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { DeletionLogService } from '@/lib/services/deletion-log.service';
import { verifyDeletionPassword } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { password } = body;

        const auth = verifyDeletionPassword(password);
        if (!auth.valid) {
            return NextResponse.json({ success: false, error: 'Unauthorized: Invalid password' }, { status: 401 });
        }

        const db = await getDB();
        const logs = await DeletionLogService.getDeletionLogs(db);

        return NextResponse.json({ success: true, data: logs, authorizedPerson: auth.personName });
    } catch (error: unknown) {
        console.error('Failed to retrieve deletion logs:', error);
        return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
