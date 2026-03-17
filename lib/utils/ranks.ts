/**
 * Utility to calculate user rank based on Mining Power (MP)
 */

export interface UserRank {
    name: string;
    badge: string;
    color: string;
    bgColor: string;
    threshold: number;
    nextThreshold: number | null;
}

export const RANKS: UserRank[] = [
    {
        name: 'Novice',
        badge: '🌱',
        color: '#64748b',
        bgColor: '#f1f5f9',
        threshold: 0,
        nextThreshold: 500,
    },
    {
        name: 'Trader',
        badge: '📈',
        color: '#10b981',
        bgColor: '#f0fdf4',
        threshold: 500,
        nextThreshold: 2000,
    },
    {
        name: 'Elite',
        badge: '💎',
        color: '#8b5cf6',
        bgColor: '#f5f3ff',
        threshold: 2000,
        nextThreshold: 10000,
    },
    {
        name: 'Whale',
        badge: '🐋',
        color: '#f59e0b',
        bgColor: '#fffbeb',
        threshold: 10000,
        nextThreshold: null,
    },
];

export function getUserRank(tradePower: number): UserRank {
    // Sort ranks by threshold descending to find the highest matched rank
    const matchedRank = [...RANKS]
        .sort((a, b) => b.threshold - a.threshold)
        .find(r => tradePower >= r.threshold);

    return matchedRank || RANKS[0];
}
