'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Withdrawal, WithdrawalRequest } from '@/types';

export function useWithdrawals() {
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWithdrawals = useCallback(async (page = 1, limit = 20) => {
        try {
            setIsLoading(true);
            const res = await fetch(`/api/withdrawals?page=${page}&limit=${limit}`);
            const data = await res.json();
            if (data.success) {
                setWithdrawals(data.data.items);
                return data.data;
            } else {
                setError(data.error);
            }
        } catch {
            setError('Failed to fetch withdrawals');
        } finally {
            setIsLoading(false);
        }
        return null;
    }, []);

    const createWithdrawal = useCallback(async (request: WithdrawalRequest) => {
        try {
            const res = await fetch('/api/withdrawals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request),
            });
            const data = await res.json();
            if (data.success) {
                await fetchWithdrawals();
                return { success: true, data: data.data };
            }
            return { success: false, error: data.error };
        } catch {
            return { success: false, error: 'Failed to create withdrawal' };
        }
    }, [fetchWithdrawals]);

    useEffect(() => {
        fetchWithdrawals();
    }, [fetchWithdrawals]);

    return {
        withdrawals,
        isLoading,
        error,
        refresh: fetchWithdrawals,
        createWithdrawal,
    };
}
