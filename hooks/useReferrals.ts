'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ReferralStats } from '@/types';

export function useReferrals() {
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [referralCode, setReferralCode] = useState<string>('');
    const [referralLink, setReferralLink] = useState<string>('');
    const [telegramLink, setTelegramLink] = useState<string>('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await fetch('/api/referrals?view=stats');
            const data = await res.json();
            if (data.success) {
                setStats(data.data.stats);
                setReferralCode(data.data.referralCode);
                setReferralLink(data.data.referralLink);
                setTelegramLink(data.data.telegramLink);
            } else {
                setError(data.error);
            }
        } catch {
            setError('Failed to fetch referrals');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const fetchReferralList = useCallback(async (page = 1, limit = 20) => {
        try {
            const res = await fetch(`/api/referrals?view=list&page=${page}&limit=${limit}`);
            const data = await res.json();
            if (data.success) {
                return data.data;
            }
        } catch {
            setError('Failed to fetch referral list');
        }
        return null;
    }, []);

    const fetchEarnings = useCallback(async (page = 1, limit = 20) => {
        try {
            const res = await fetch(`/api/referrals/earnings?page=${page}&limit=${limit}`);
            const data = await res.json();
            if (data.success) {
                return data.data;
            }
        } catch {
            setError('Failed to fetch earnings');
        }
        return null;
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    return {
        stats,
        referralCode,
        referralLink,
        telegramLink,
        isLoading,
        error,
        refresh: fetchStats,
        fetchReferralList,
        fetchEarnings,
    };
}
