'use client';

import { useState, useEffect, useCallback } from 'react';
import type { WalletSummary, Transaction } from '@/types';

let globalWalletCache: { summary: WalletSummary | null; time: number } = { summary: null, time: 0 };
const CLIENT_CACHE_TTL_MS = 30000; // 30 seconds client TTL

export function useWallet() {
    const [summary, setSummary] = useState<WalletSummary | null>(globalWalletCache.summary);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(!globalWalletCache.summary);
    const [error, setError] = useState<string | null>(null);

    const fetchWallet = useCallback(async (forceRefresh = false) => {
        const now = Date.now();
        if (!forceRefresh && globalWalletCache.summary && (now - globalWalletCache.time < CLIENT_CACHE_TTL_MS)) {
            setSummary(globalWalletCache.summary);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const res = await fetch('/api/wallet');
            const data = await res.json();
            if (data.success) {
                setSummary(data.data);
                globalWalletCache = { summary: data.data, time: Date.now() };
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
        refresh: () => fetchWallet(true),
        fetchTransactions,
    };
}
