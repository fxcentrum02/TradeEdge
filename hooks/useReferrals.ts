'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ReferralStats } from '@/types';

let globalReferralsCache: { data: any; time: number } = { data: null, time: 0 };
const CLIENT_CACHE_TTL_MS = 30000;

export function useReferrals() {
    const [stats, setStats] = useState<ReferralStats | null>(globalReferralsCache.data?.stats ?? null);
    const [referralCode, setReferralCode] = useState<string>(globalReferralsCache.data?.referralCode ?? '');
    const [referralLink, setReferralLink] = useState<string>(globalReferralsCache.data?.referralLink ?? '');
    const [telegramLink, setTelegramLink] = useState<string>(globalReferralsCache.data?.telegramLink ?? '');
    const [isLoading, setIsLoading] = useState(!globalReferralsCache.data);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async (forceRefresh = false) => {
        const now = Date.now();
        if (!forceRefresh && globalReferralsCache.data && (now - globalReferralsCache.time < CLIENT_CACHE_TTL_MS)) {
            setStats(globalReferralsCache.data.stats);
            setReferralCode(globalReferralsCache.data.referralCode);
            setReferralLink(globalReferralsCache.data.referralLink);
            setTelegramLink(globalReferralsCache.data.telegramLink);
            setIsLoading(false);
            return;
        }

        try {
            setIsLoading(true);
            const res = await fetch('/api/referrals?view=stats');
            const data = await res.json();
            if (data.success) {
                setStats(data.data.stats);
                setReferralCode(data.data.referralCode);
                setReferralLink(data.data.referralLink);
                setTelegramLink(data.data.telegramLink);
                globalReferralsCache = { data: data.data, time: Date.now() };
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
        refresh: () => fetchStats(true),
        fetchReferralList,
        fetchEarnings,
    };
}
