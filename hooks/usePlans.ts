'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Plan, UserPlan } from '@/types';

export function usePlans() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [userPlans, setUserPlans] = useState<UserPlan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPlans = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/plans');
            const data = await res.json();
            if (data.success) {
                setPlans(data.data);
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
        refresh: fetchPlans,
        activatePlan,
    };
}
