// ===========================================
// PLAN REPOSITORY
// ===========================================

import { ObjectId } from 'mongodb';
import { getDB } from '../db';
import { Collections } from '../db/collections';
import type { PlanDocument } from '../db/types';

export async function findPlanById(id: string | ObjectId) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;
    return db.collection<PlanDocument>(Collections.PLANS).findOne({ _id });
}

export async function findActivePlans() {
    const db = await getDB();
    return db.collection<PlanDocument>(Collections.PLANS)
        .find({ isActive: true })
        .sort({ sortOrder: 1, minAmount: 1 })
        .toArray();
}

export async function findAllPlans() {
    const db = await getDB();
    return db.collection<PlanDocument>(Collections.PLANS)
        .find({})
        .sort({ sortOrder: 1, minAmount: 1 })
        .toArray();
}

/**
 * Find the applicable plan tier for a given investment amount.
 * The tier is determined by minAmount <= amount <= maxAmount (or maxAmount is null = unlimited).
 */
export async function findPlanForAmount(amount: number): Promise<PlanDocument | null> {
    const db = await getDB();
    const plans = await db.collection<PlanDocument>(Collections.PLANS)
        .find({ isActive: true })
        .sort({ minAmount: 1 })
        .toArray();

    // Find the highest matching tier
    let matched: PlanDocument | null = null;
    for (const plan of plans) {
        if (amount >= plan.minAmount) {
            if (plan.maxAmount == null || amount <= plan.maxAmount) {
                matched = plan;
                break; // Plans are sorted ascending; first match is correct
            }
        }
    }

    return matched;
}

/**
 * Validates if a new/updated plan range overlaps with any existing plan.
 * Ranges are inclusive: [minAmount, maxAmount]. maxAmount = null means Infinity.
 */
export async function validatePlanOverlap(
    minAmount: number,
    maxAmount: number | null | undefined,
    excludePlanId?: string | ObjectId
): Promise<boolean> {
    const db = await getDB();
    const plans = await db.collection<PlanDocument>(Collections.PLANS).find().toArray();

    const max1 = maxAmount == null ? Infinity : maxAmount;

    for (const plan of plans) {
        if (excludePlanId && plan._id.toString() === excludePlanId.toString()) continue;

        const max2 = plan.maxAmount == null ? Infinity : plan.maxAmount;
        
        // Two ranges [min1, max1] and [min2, max2] overlap if:
        // Math.max(min1, min2) <= Math.min(max1, max2)
        if (Math.max(minAmount, plan.minAmount) <= Math.min(max1, max2)) {
            return true; // Overlap detected
        }
    }

    return false; // No overlap
}

export async function createPlan(planData: Omit<PlanDocument, '_id' | 'createdAt' | 'updatedAt'>) {
    const db = await getDB();
    const now = new Date();

    const plan: Omit<PlanDocument, '_id'> = {
        ...planData,
        createdAt: now,
        updatedAt: now,
    };

    const result = await db.collection<PlanDocument>(Collections.PLANS).insertOne(plan as PlanDocument);
    return db.collection<PlanDocument>(Collections.PLANS).findOne({ _id: result.insertedId });
}

export async function updatePlan(id: string | ObjectId, updates: Partial<PlanDocument>) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;

    const result = await db.collection<PlanDocument>(Collections.PLANS).findOneAndUpdate(
        { _id },
        {
            $set: {
                ...updates,
                updatedAt: new Date(),
            },
        },
        { returnDocument: 'after' }
    );

    return result;
}

export async function deletePlan(id: string | ObjectId) {
    const db = await getDB();
    const _id = typeof id === 'string' ? new ObjectId(id) : id;

    return db.collection<PlanDocument>(Collections.PLANS).deleteOne({ _id });
}
