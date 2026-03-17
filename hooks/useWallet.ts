'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WalletSummary, Transaction } from '@/types';

export function useWallet() {
    const [summary, setSummary] = useState<WalletSummary | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWallet = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/wallet');
            const data = await res.json();
            if (data.success) {
                setSummary(data.data);
            } else {
                setError(data.error);
            }
        } catch {
            setError('Failed to fetch wallet');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchTransactions = useCallback(async (page = 1, limit = 20) => {
        try {
            const res = await fetch(`/api/wallet/transactions?page=${page}&limit=${limit}`);
            const data = await res.json();
            if (data.success) {
                setTransactions(data.data.items);
                return data.data;
            }
        } catch {
            setError('Failed to fetch transactions');
        }
        return null;
    }, []);

    useEffect(() => {
        fetchWallet();
    }, [fetchWallet]);

    return {
        summary,
        transactions,
        isLoading,
        error,
        refresh: fetchWallet,
        fetchTransactions,
    };
}
