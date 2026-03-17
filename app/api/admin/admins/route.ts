import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/session';
import { findAllAdmins, createAdmin, findAdminByEmail } from '@/lib/repositories/admin.repository';
import type { ApiResponse, Admin } from '@/types';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Admin[]>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const admins = await findAllAdmins();

        // Sanitize password hashes
        const sanitizedAdmins = admins.map(admin => {
            const { passwordHash, ...rest } = admin;
            return rest as Admin;
        });

        return NextResponse.json({ success: true, data: sanitizedAdmins as Admin[] });
    } catch (error) {
        console.error('Failed to get admins:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch admins' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<Admin>>> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session || session.role !== 'superadmin') {
            return NextResponse.json({ success: false, error: 'Unauthorized or insufficient permissions' }, { status: 403 });
        }

        const { email, password, name, role, isActive = true } = await request.json();

        if (!email || !password || !name || !role) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        const existing = await findAdminByEmail(email);
        if (existing) {
            return NextResponse.json({ success: false, error: 'Admin with this email already exists' }, { status: 400 });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const newAdmin = await createAdmin({
            email,
            passwordHash,
            name,
            role,
            isActive
        });

        const { passwordHash: _ph, ...sanitized } = newAdmin;

        return NextResponse.json({ success: true, data: sanitized as Admin });
    } catch (error) {
        console.error('Failed to create admin:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create admin' },
            { status: 500 }
        );
    }
}
