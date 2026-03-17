import { NextResponse } from 'next/server';
import { findAdminByEmail } from '@/lib/repositories/admin.repository';
import { createAdminSessionToken, setAdminSessionCookie } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ success: false, error: 'Email and password are required' }, { status: 400 });
        }

        const admin = await findAdminByEmail(email);

        if (!admin || !admin.isActive) {
            return NextResponse.json({ success: false, error: 'Invalid credentials or account inactive' }, { status: 401 });
        }

        const isMatch = await bcrypt.compare(password, admin.passwordHash);

        if (!isMatch) {
            return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
        }

        const token = await createAdminSessionToken({
            adminId: admin.id,
            email: admin.email,
            role: admin.role,
        });

        const response = NextResponse.json({
            success: true,
            data: {
                admin: {
                    id: admin.id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role,
                }
            }
        });

        setAdminSessionCookie(response, token);

        return response;
    } catch (error) {
        console.error('[Admin Login] Error:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
