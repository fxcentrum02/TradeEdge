'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Plan, UserPlan } from '@/types';

let globalPlansCache: { plans: Plan[]; time: number } = { plans: [], time: 0 };
const CLIENT_CACHE_TTL_MS = 60000; // 60s TTL for static plan offerings

export function usePlans() {
    const [plans, setPlans] = useState<Plan[]>(globalPlansCache.plans);
    const [userPlans, setUserPlans] = useState<UserPlan[]>([]);
    const [isLoading, setIsLoading] = useState(globalPlansCache.plans.length === 0);
    const [error, setError] = useState<string | null>(null);

    const fetchPlans = useCallback(async (forceRefresh = false) => {
        const now = Date.now();
        if (!forceRefresh && globalPlansCache.plans.length > 0 && (now - globalPlansCache.time < CLIENT_CACHE_TTL_MS)) {
            setPlans(globalPlansCache.plans);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const res = await fetch('/api/plans');
            const data = await res.json();
            if (data.success) {
                setPlans(data.data);
                globalPlansCache = { plans: data.data, time: Date.now() };
            } else {
                setError(data.error);
            }
        } catch {
            setError('Failed to fetch plans');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const activatePlan = useCallback(async (planId: string, amount?: number) => {
        try {
            const res = await fetch('/api/plans/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId, amount }),
            });
            const data = await res.json();
            if (data.success) {
                return { success: true, data: data.data };
            }
            return { success: false, error: data.error };
        } catch {
            return { success: false, error: 'Failed to activate plan' };
        }
    }, []);

    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    return {
        plans,
        userPlans,
        isLoading,
        error,
        refresh: () => fetchPlans(true),
        activatePlan,
    };
}
