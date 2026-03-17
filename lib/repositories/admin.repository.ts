// ===========================================
// ADMIN REPOSITORY
// ===========================================

import { getDB } from '../db';
import { Collections } from '../db/collections';
import type { Admin } from '@/types';
import { ObjectId, WithId } from 'mongodb';

export type AdminDocument = Omit<Admin, 'id'> & { _id: ObjectId };

export async function findAdminByEmail(email: string): Promise<Admin | null> {
    const db = await getDB();
    const admin = await db.collection<AdminDocument>(Collections.ADMINS).findOne({ email });
    if (!admin) return null;
    return mapAdmin(admin);
}

export async function findAdminById(id: string): Promise<Admin | null> {
    const db = await getDB();
    const admin = await db.collection<AdminDocument>(Collections.ADMINS).findOne({ _id: new ObjectId(id) });
    if (!admin) return null;
    return mapAdmin(admin);
}

export async function createAdmin(data: Omit<Admin, 'id' | 'createdAt' | 'updatedAt'>): Promise<Admin> {
    const db = await getDB();
    const now = new Date();

    const newAdmin = {
        ...data,
        createdAt: now,
        updatedAt: now,
    };

    const result = await db.collection(Collections.ADMINS).insertOne(newAdmin);
    return {
        id: result.insertedId.toString(),
        ...newAdmin,
    };
}

export async function findAllAdmins(): Promise<Admin[]> {
    const db = await getDB();
    const admins = await db.collection<AdminDocument>(Collections.ADMINS).find({}).sort({ createdAt: -1 }).toArray();
    return admins.map(mapAdmin);
}

export async function updateAdmin(id: string, data: Partial<Omit<Admin, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Admin | null> {
    const db = await getDB();
    const result = await db.collection<AdminDocument>(Collections.ADMINS).findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: { ...data, updatedAt: new Date() } },
        { returnDocument: 'after' }
    );
    if (!result) return null;
    return mapAdmin(result);
}

export async function deleteAdmin(id: string): Promise<boolean> {
    const db = await getDB();
    const result = await db.collection<AdminDocument>(Collections.ADMINS).deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
}

function mapAdmin(doc: AdminDocument): Admin {
    const { _id, ...rest } = doc;
    return {
        id: _id.toString(),
        ...rest,
    };
}
