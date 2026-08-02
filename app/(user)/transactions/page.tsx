'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box, Typography, Paper, List, ListItem, ListItemText,
    Divider, CircularProgress, Chip, Avatar, Stack, TextField, Button
} from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/lib/utils';
import type { Transaction, TransactionType } from '@/types';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import StarIcon from '@mui/icons-material/Star';
import PaymentsIcon from '@mui/icons-material/Payments';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

// Transaction Type Map for UI
const TRANSACTION_UI_MAP: Record<TransactionType, { label: string; color: string; icon: any }> = {
    'DEPOSIT': { label: 'Deposit/Mining Power Buy', color: '#10b981', icon: <AddIcon sx={{ fontSize: 16 }} /> },
    'PLAN_PURCHASE': { label: 'Compounding Power', color: '#ef4444', icon: <RemoveIcon sx={{ fontSize: 16 }} /> },
    'REFERRAL_EARNING': { label: 'Referral', color: '#10b981', icon: <StarIcon sx={{ fontSize: 16 }} /> },
    'REFERRAL_TRANSFER': { label: 'Claim', color: '#3b82f6', icon: <PaymentsIcon sx={{ fontSize: 16 }} /> },
    'ROI_EARNING': { label: 'ROI Credit', color: '#10b981', icon: <AddIcon sx={{ fontSize: 16 }} /> },
    'REINVEST': { label: 'Compounding Power', color: '#f59e0b', icon: <RemoveIcon sx={{ fontSize: 16 }} /> },
    'WITHDRAWAL': { label: 'Withdraw', color: '#ef4444', icon: <RemoveIcon sx={{ fontSize: 16 }} /> },
    'WITHDRAWAL_FEE': { label: 'Fee', color: '#ef4444', icon: <RemoveIcon sx={{ fontSize: 16 }} /> },
    'ADMIN_CREDIT': { label: 'Bonus', color: '#10b981', icon: <AddIcon sx={{ fontSize: 16 }} /> },
    'ADMIN_DEBIT': { label: 'Debit', color: '#ef4444', icon: <RemoveIcon sx={{ fontSize: 16 }} /> },
};

export default function TransactionsPage() {
    const { authFetch } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [activeType, setActiveType] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Observer for Infinite Scroll
    const observer = useRef<IntersectionObserver | null>(null);
    const lastElementRef = useCallback((node: HTMLDivElement | null) => {
        if (loading || loadingMore) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prev => prev + 1);
            }
        });

        if (node) observer.current.observe(node);
    }, [loading, loadingMore, hasMore]);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset pagination when filters change
    useEffect(() => {
        setPage(1);
        setTransactions([]);
        setHasMore(true);
    }, [activeType, debouncedSearch]);

    const fetchTransactions = useCallback(async (pageNum: number) => {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        try {
            setError(null);
            const res = await authFetch(`/api/transactions?page=${pageNum}&limit=20&type=${activeType}&search=${debouncedSearch}`);
            
            if (!res.ok) {
                throw new Error(`Failed to fetch: ${res.statusText}`);
            }

            const data = await res.json();

            if (data.success && data.data) {
                const newItems = data.data.items || [];
                if (pageNum === 1) {
                    setTransactions(newItems);
                } else {
                    setTransactions(prev => [...prev, ...newItems]);
                }
                setHasMore(data.data.hasMore && newItems.length > 0);
            } else {
                setHasMore(false);
                if (pageNum === 1) setError(data.error || 'Failed to load transactions');
            }
        } catch (err: any) {
            console.error('Failed to fetch transactions:', err);
            setHasMore(false);
            if (pageNum === 1) setError(err.message || 'Network error occurred');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [authFetch, activeType, debouncedSearch]);

    useEffect(() => {
        fetchTransactions(page);
    }, [page, fetchTransactions]);

    return (
        <Box sx={{ pb: 10 }}>
            {/* Header */}
            <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar sx={{ bgcolor: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', border: '1px solid rgba(6, 182, 212, 0.3)', width: 48, height: 48 }}>
                    <HistoryIcon />
                </Avatar>
                <Box>
                    <Typography variant="h5" fontWeight={800} color="#f8fafc">
                        History
                    </Typography>
                    <Typography variant="body2" color="#94a3b8">
                        All your wallet activities
                    </Typography>
                </Box>
            </Box>

            {/* Smart Filters */}
            <Box sx={{ mb: 3 }}>
                <TextField
                    fullWidth
                    placeholder="Search by description..."
                    variant="outlined"
                    size="small"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{
                        mb: 2,
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            bgcolor: 'rgba(30, 41, 59, 0.8)',
                            color: '#ffffff',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            '& fieldset': { border: 'none' },
                            '&:hover': { border: '1px solid rgba(6, 182, 212, 0.4)' },
                            '&.Mui-focused': { border: '1px solid #06b6d4' },
                            '& input::placeholder': { color: '#64748b', opacity: 1 },
                        }
                    }}
                />
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                        overflowX: 'auto',
                        pb: 1,
                        px: 0.5,
                        '&::-webkit-scrollbar': { display: 'none' },
                        msOverflowStyle: 'none',
                        scrollbarWidth: 'none'
                    }}
                >
                    {['ALL', 'ROI_EARNING', 'REFERRAL_EARNING', 'WITHDRAWAL', 'DEPOSIT', 'REINVEST'].map(type => (
                        <Chip
                            key={type}
                            label={type === 'ALL' ? 'All' : (TRANSACTION_UI_MAP[type as TransactionType]?.label || type)}
                            onClick={() => setActiveType(type)}
                            sx={{
                                borderRadius: 2,
                                fontWeight: 700,
                                textTransform: 'none',
                                px: 1.2,
                                height: 34,
                                background: activeType === type ? 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)' : 'rgba(30, 41, 59, 0.6)',
                                color: activeType === type ? '#ffffff' : '#94a3b8',
                                border: activeType === type ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                                boxShadow: activeType === type ? '0 4px 14px rgba(6, 182, 212, 0.35)' : 'none',
                                transition: 'all 0.15s ease',
                            }}
                        />
                    ))}
                </Stack>
            </Box>

            <Paper
                elevation={0}
                sx={{
                    borderRadius: 2,
                    overflow: 'hidden',
                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
                }}
            >
                {loading && page === 1 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress sx={{ color: '#06b6d4' }} />
                    </Box>
                ) : error ? (
                    <Box sx={{ py: 8, textAlign: 'center', px: 2 }}>
                        <Typography color="#f87171" gutterBottom sx={{ fontWeight: 600 }}>{error}</Typography>
                        <Button 
                            variant="outlined" 
                            size="small" 
                            onClick={() => fetchTransactions(1)}
                            sx={{ borderRadius: 2.5, mt: 1, textTransform: 'none', color: '#06b6d4', borderColor: '#06b6d4' }}
                        >
                            Try Again
                        </Button>
                    </Box>
                ) : transactions.length === 0 ? (
                    <Box sx={{ py: 8, textAlign: 'center' }}>
                        <Typography color="#94a3b8">No transactions yet.</Typography>
                    </Box>
                ) : (
                    <List disablePadding>
                        {transactions.map((tx, index) => {
                            const ui = TRANSACTION_UI_MAP[tx.type] || { label: tx.type, color: '#64748b', icon: null };
                            const isPositive = tx.amount > 0;
                            const amountColor = isPositive ? '#34d399' : '#f87171';

                            return (
                                <Box key={tx.id}>
                                    {index > 0 && <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.06)' }} />}
                                    <ListItem sx={{ py: 2 }}>
                                        <ListItemText
                                            primaryTypographyProps={{ component: 'div' }}
                                            secondaryTypographyProps={{ component: 'div' }}
                                            primary={
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Box
                                                            sx={{
                                                                width: 28,
                                                                height: 28,
                                                                borderRadius: '8px',
                                                                bgcolor: ui.color + '25',
                                                                color: ui.color,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                border: `1px solid ${ui.color}40`,
                                                            }}
                                                        >
                                                            {ui.icon}
                                                        </Box>
                                                        <Typography variant="subtitle2" fontWeight={700} color="#f1f5f9">
                                                            {ui.label}
                                                        </Typography>
                                                    </Box>
                                                    <Typography variant="subtitle2" fontWeight={800} sx={{ color: amountColor }}>
                                                        {isPositive ? '+' : ''}{tx.amount.toFixed(2)} USDT
                                                    </Typography>
                                                </Box>
                                            }
                                            secondary={
                                                <Box>
                                                    <Typography variant="caption" color="#94a3b8" sx={{ display: 'block', mb: 0.5 }}>
                                                        {tx.description || 'Transaction processed'}
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.7rem' }}>
                                                            {new Date(tx.createdAt).toLocaleString()}
                                                        </Typography>
                                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                                            <AccountBalanceWalletIcon sx={{ fontSize: 12, color: '#64748b' }} />
                                                            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600 }}>
                                                                {tx.balanceAfter.toFixed(2)}
                                                            </Typography>
                                                        </Stack>
                                                    </Box>
                                                </Box>
                                            }
                                        />
                                    </ListItem>
                                </Box>
                            );
                        })}
                    </List>
                )}

                {hasMore && (
                    <Box ref={lastElementRef} sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        {loadingMore && <CircularProgress size={24} sx={{ color: '#06b6d4' }} />}
                    </Box>
                )}

                {!hasMore && transactions.length > 0 && (
                    <Box sx={{ py: 3, textAlign: 'center' }}>
                        <Typography variant="caption" color="#64748b" sx={{ fontWeight: 600 }}>
                            End of history
                        </Typography>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}
