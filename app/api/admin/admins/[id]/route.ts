import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/session';
import { findAdminById, updateAdmin, deleteAdmin } from '@/lib/repositories/admin.repository';
import type { ApiResponse, Admin } from '@/types';
import bcrypt from 'bcryptjs';

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<Admin>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ success: false, error: 'Unauthorized or insufficient permissions' }, { status: 403 });
        }

        const { id } = await params;
        const updates = await request.json();
        const { password, ...otherUpdates } = updates;

        const updateData: any = { ...otherUpdates };

        if (password) {
            updateData.passwordHash = await bcrypt.hash(password, 10);
        }

        const updatedAdmin = await updateAdmin(id, updateData);
        if (!updatedAdmin) {
            return NextResponse.json({ success: false, error: 'Admin not found' }, { status: 404 });
        }

        const { passwordHash, ...sanitized } = updatedAdmin;

        return NextResponse.json({ success: true, data: sanitized as Admin });
    } catch (error) {
        console.error('Failed to update admin:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update admin' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ success: false, error: 'Unauthorized or insufficient permissions' }, { status: 403 });
        }

        const { id } = await params;

        // Prevent deleting oneself
        if (id === session.adminId) {
            return NextResponse.json({ success: false, error: 'Cannot delete your own account' }, { status: 400 });
        }

        const success = await deleteAdmin(id);
        if (!success) {
            return NextResponse.json({ success: false, error: 'Admin not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete admin:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete admin' },
            { status: 500 }
        );
    }
}
