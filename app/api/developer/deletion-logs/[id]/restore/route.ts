// ===========================================
// DEVELOPER RESTORE USER FROM DELETION LOG API
// ===========================================

import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { verifyDeletionPassword } from '@/lib/constants';
import { DeletionLogService } from '@/lib/services/deletion-log.service';
import { getAdminSessionFromRequest } from '@/lib/auth';
import type { AdminSessionPayload } from '@/types';

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        if (!id) {
            return NextResponse.json({ success: false, error: 'Log ID parameter is required' }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const password = body?.password || request.headers.get('x-dev-password') || '';

        // 1. Password Verification
        const auth = verifyDeletionPassword(password);
        if (!auth.valid) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized: Valid security authorization password required' },
                { status: 401 }
            );
        }

        // 2. Admin Session or Developer System Session
        let session = await getAdminSessionFromRequest(request);
        if (!session) {
            session = {
                adminId: 'dev_authorized_system',
                email: 'system@tradeedge.internal',
                role: 'superadmin'
            } as AdminSessionPayload;
        }

        const db = await getDB();
        const result = await DeletionLogService.restoreUserFromSnapshot(
            db,
            id,
            session,
            {
                personName: auth.personName!,
                passwordKey: auth.passwordKey!
            }
        );

        return NextResponse.json({
            success: true,
            message: result.message,
            data: result.user,
            authorizedPerson: auth.personName
        });
    } catch (error: any) {
        console.error('Error restoring user from deletion log:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to restore user from deletion snapshot' },
            { status: 500 }
        );
    }
}
