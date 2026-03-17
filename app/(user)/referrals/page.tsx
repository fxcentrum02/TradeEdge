'use client';

import { useEffect, useState } from 'react';
import {
    Box, Card, CardContent, Typography, Skeleton, Avatar, Chip, Paper,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Drawer, List, ListItem, ListItemAvatar, ListItemText, Divider, Button,
    IconButton, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareIcon from '@mui/icons-material/Share';
import CloseIcon from '@mui/icons-material/Close';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import LockIcon from '@mui/icons-material/Lock';
import HistoryIcon from '@mui/icons-material/History';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FilterListIcon from '@mui/icons-material/FilterList';
import { formatCurrency, formatDateTime, getInitials } from '@/lib/utils';
import type { ReferralStats } from '@/types';
import { useAuth } from '@/context/AuthContext';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';

export default function ReferralsPage() {
    const { authFetch } = useAuth();
    const [activeTab, setActiveTab] = useState(0);
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedTier, setSelectedTier] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);
    const [claiming, setClaiming] = useState(false);
    const [claimSuccess, setClaimSuccess] = useState<string | null>(null);
    const [claimDialogOpen, setClaimDialogOpen] = useState(false);
    const [claimAmount, setClaimAmount] = useState<string>('');
    const [claimError, setClaimError] = useState<string | null>(null);

    // Insights state
    const [insights, setInsights] = useState<any[]>([]);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

    // History state
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyFilter, setHistoryFilter] = useState('all');
    const [totalHistory, setTotalHistory] = useState(0);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const res = await authFetch('/api/referrals');
            const data = await res.json();
            if (data.success) setStats(data.data);
        } catch (error) {
            console.error('Referrals error:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async (page: number, filter: string) => {
        try {
            setHistoryLoading(true);
            const res = await authFetch(`/api/referrals/history?page=${page}&filter=${filter}`);
            const data = await res.json();
            if (data.success) {
                setHistory(data.data.items);
                setTotalHistory(data.data.total);
            }
        } catch (error) {
            console.error('History error:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        if (activeTab === 1) {
            fetchHistory(historyPage, historyFilter);
        } else if (activeTab === 2) {
            fetchInsights();
        }
    }, [activeTab, historyPage, historyFilter, startDate, endDate]);

    const fetchInsights = async () => {
        try {
            setInsightsLoading(true);
            const res = await authFetch(`/api/referrals/insights?start=${startDate}&end=${endDate}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setInsights(data);
            }
        } catch (error) {
            console.error('Insights error:', error);
        } finally {
            setInsightsLoading(false);
        }
    };

    const handleTabChange = (_: any, newValue: number) => {
        setActiveTab(newValue);
    };

    const handleTierClick = (tier: number, userCount: number) => {
        if (tier === 1 && userCount > 0) {
            setSelectedTier(tier);
            setDrawerOpen(true);
        }
    };

    const copyReferralLink = async () => {
        const link = stats?.telegramLink || stats?.referralLink;
        if (link) {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleClaimClick = () => {
        setClaimAmount((stats?.referralWalletBalance || 0).toString());
        setClaimDialogOpen(true);
        setClaimError(null);
    };

    const handleClaim = async () => {
        const balance = stats?.referralWalletBalance || 0;
        const requestedAmount = parseFloat(claimAmount);
        const MIN_CLAIM = 50;
        const TOLERANCE = 0.001;

        if (isNaN(requestedAmount) || requestedAmount < (MIN_CLAIM - TOLERANCE)) {
            setClaimError(`Minimum ${MIN_CLAIM} USDT required to claim.`);
            return;
        }

        if (requestedAmount > balance + TOLERANCE) {
            setClaimError(`Amount exceeds your referral balance.`);
            return;
        }

        // Capping logic
        const totalActiveTP = stats?.tradePower || 0;
        const multiplier = stats?.referralClaimMultiplier || 1;
        const totalClaimed = stats?.totalClaimed || 0;
        const maxAllowedLifetime = totalActiveTP * multiplier;
        const currentlyAvailableToClaim = Math.max(0, maxAllowedLifetime - totalClaimed);

        if (requestedAmount > currentlyAvailableToClaim + TOLERANCE) {
            setClaimError(`Your claim is capped at ${currentlyAvailableToClaim.toFixed(2)} USDT based on your active Trade Power (${totalActiveTP} USDT) x ${multiplier}. You have already claimed ${totalClaimed.toFixed(2)} USDT.`);
            return;
        }

        try {
            setClaiming(true);
            setClaimError(null);
            const res = await authFetch('/api/wallet/transfer-referral', { 
                method: 'POST',
                body: JSON.stringify({ amount: requestedAmount })
            });
            const data = await res.json();

            if (data.success) {
                setClaimSuccess(data.message);
                setClaimDialogOpen(false);
                
                // Refresh stats to show updated balance
                try {
                    const statsRes = await authFetch('/api/referrals');
                    const statsData = await statsRes.json();
                    if (statsData.success) {
                        setStats(statsData.data);
                    }
                } catch (refreshError) {
                    console.error('Stats refresh error:', refreshError);
                }

                setTimeout(() => setClaimSuccess(null), 5000);
            } else {
                throw new Error(data.error || 'Failed to claim');
            }
        } catch (error: any) {
            console.error('Claim error:', error);
            setClaimError(error.message || 'An error occurred while claiming. Please try again later.');
        } finally {
            setClaiming(false);
        }
    };

    const shareToTelegram = () => {
        if (!stats?.telegramLink) return;
        const text = `Join me on Trade Edge and earn daily ROI! Use my referral link 👇\n${stats.telegramLink}`;
        // Use Telegram WebApp native share if available
        const tg = (window as any).Telegram?.WebApp;
        if (tg?.openTelegramLink) {
            tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(stats.telegramLink)}&text=${encodeURIComponent('Join me and earn daily! 💰')}`);
        } else {
            window.open(`https://t.me/share/url?url=${encodeURIComponent(stats.telegramLink)}&text=${encodeURIComponent(text)}`, '_blank');
        }
    };

    if (loading) {
        return (
            <Box sx={{ py: 2 }}>
                <Skeleton variant="rounded" height={100} sx={{ mb: 2, borderRadius: 3 }} />
                <Skeleton variant="rounded" height={80} sx={{ mb: 2, borderRadius: 3 }} />
                <Skeleton variant="rounded" height={300} sx={{ borderRadius: 3 }} />
            </Box>
        );
    }

    return (
        <Box sx={{ pb: 10 }}>
            {/* Page Header */}
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon fontSize="small" sx={{ color: '#8b5cf6' }} />
                Friends
            </Typography>

            {/* Tabs */}
            <Paper sx={{ mb: 3, borderRadius: 3, overflow: 'hidden' }}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    variant="fullWidth"
                    indicatorColor="primary"
                    textColor="primary"
                    sx={{
                        '& .MuiTab-root': {
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            textTransform: 'none',
                            py: 1.5
                        }
                    }}
                >
                    <Tab icon={<TrendingUpIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Tiered Earnings" />
                    <Tab icon={<HistoryIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="History" />
                    <Tab icon={<FilterListIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Insights" />
                </Tabs>
            </Paper>

            {activeTab === 0 && (
                <>
                    {/* Explanatory Text */}
                    <Paper sx={{ p: 2, mb: 3, borderRadius: 3, bgcolor: '#fdfcfe', border: '1px solid #f3e8ff' }}>
                        <Typography variant="subtitle2" fontWeight={800} color="#7c3aed" gutterBottom>
                            Referral Program Rewards
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.6 }}>
                            Earn massive rewards by building your network! Our 20-tier referral program allows you to earn a percentage of the daily ROI earned by your friends and their downline.
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                <Box sx={{ mt: 0.5, width: 16, height: 16, borderRadius: '50%', bgcolor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981' }} />
                                </Box>
                                <Box>
                                    <Typography variant="caption" fontWeight={700} color="#1e293b">20-Tier ROI Commissions</Typography>
                                    <Typography variant="caption" display="block" color="text.secondary">Earn a percentage of the daily ROI earned by your entire network up to 20 levels deep!</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                <Box sx={{ mt: 0.5, width: 16, height: 16, borderRadius: '50%', bgcolor: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#f59e0b' }} />
                                </Box>
                                <Box>
                                    <Typography variant="caption" fontWeight={700} color="#1e293b">Dynamic Tier Unlocking</Typography>
                                    <Typography variant="caption" display="block" color="text.secondary">Tier 1 is always unlocked. Tiers 2-20 unlock as your personal and direct team investment grows (100 USDT per Tier).</Typography>
                                </Box>
                            </Box>
                        </Box>
                    </Paper>

                    {/* Referral Bonus Banner */}
                    <Card
                        sx={{
                            mb: 2,
                            borderRadius: 3,
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                            color: 'white',
                            overflow: 'hidden',
                        }}
                    >
                        <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="caption" sx={{ opacity: 0.9, mb: 0.5, display: 'block' }}>
                                        Referral Bonus
                                    </Typography>
                                    <Typography variant="h5" fontWeight={800}>
                                        {formatCurrency(stats?.referralWalletBalance || 0)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.65rem' }}>
                                        Total Lifetime Earned: {formatCurrency(stats?.totalEarnings || 0)}
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        onClick={handleClaimClick}
                                        disabled={claiming || !stats?.referralWalletBalance || stats.referralWalletBalance < (50 - 0.001)}
                                        sx={{
                                            bgcolor: claiming ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
                                            color: 'white',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: 2,
                                            px: 2,
                                            py: 0.5,
                                            fontWeight: 600,
                                            textTransform: 'none',
                                            fontSize: '0.8rem',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
                                            '&:disabled': { color: 'rgba(255,255,255,0.5)' }
                                        }}
                                    >
                                        {claiming ? 'Processing...' : 'Claim'}
                                    </Button>
                                    {(!stats?.referralWalletBalance || stats.referralWalletBalance < 50) && (
                                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontSize: '0.6rem', opacity: 0.7 }}>
                                            Min 50 USDT
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                            {claimSuccess && (
                                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#10b981', fontWeight: 600 }}>
                                    {claimSuccess}
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                    {/* Share Referral Link */}
                    <Paper
                        sx={{
                            mb: 2,
                            p: 1.5,
                            borderRadius: 3,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                        }}
                    >
                        <Typography variant="caption" color="text.secondary">Your Referral Link (Telegram)</Typography>
                        <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{
                                fontFamily: 'monospace',
                                bgcolor: '#f1f5f9',
                                p: 0.5,
                                px: 1,
                                borderRadius: 1,
                                mt: 0.5,
                                mb: 1.5,
                                wordBreak: 'break-all',
                                fontSize: '0.7rem',
                            }}
                        >
                            {stats?.telegramLink || '...'}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<ContentCopyIcon />}
                                onClick={copyReferralLink}
                                sx={{
                                    flex: 1,
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    color: copied ? '#10b981' : undefined,
                                    borderColor: copied ? '#10b981' : undefined,
                                }}
                            >
                                {copied ? 'Copied!' : 'Copy Link'}
                            </Button>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<ShareIcon />}
                                onClick={shareToTelegram}
                                sx={{
                                    flex: 1,
                                    bgcolor: '#3b82f6',
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    '&:hover': { bgcolor: '#2563eb' },
                                }}
                            >
                                Share on Telegram
                            </Button>
                        </Box>
                    </Paper>

                    {/* Stats Cards */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 2 }}>
                        <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                            <CardContent sx={{ textAlign: 'center', py: 1.5, px: 1 }}>
                                <Avatar sx={{ bgcolor: '#ecfdf5', color: '#10b981', mx: 'auto', mb: 0.5, width: 28, height: 28 }}>
                                    <PeopleIcon sx={{ fontSize: 16 }} />
                                </Avatar>
                                <Typography variant="subtitle1" fontWeight={800}>
                                    {stats?.totalReferrals || 0}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                                    Direct Refs
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                            <CardContent sx={{ textAlign: 'center', py: 1.5, px: 1 }}>
                                <Avatar sx={{ bgcolor: '#eff6ff', color: '#3b82f6', mx: 'auto', mb: 0.5, width: 28, height: 28 }}>
                                    <PeopleIcon sx={{ fontSize: 16 }} />
                                </Avatar>
                                <Typography variant="subtitle1" fontWeight={800}>
                                    {stats?.totalDownlineCount || 0}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                                    Total Downline
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                            <CardContent sx={{ textAlign: 'center', py: 1.5, px: 1 }}>
                                <Avatar sx={{ bgcolor: '#fef3c7', color: '#f59e0b', mx: 'auto', mb: 0.5, width: 28, height: 28 }}>
                                    <MonetizationOnIcon sx={{ fontSize: 16 }} />
                                </Avatar>
                                <Typography variant="subtitle1" fontWeight={800}>
                                    {formatCurrency(stats?.totalDownlineTradePower || 0)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                                    Downline MP
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>

                    {/* Tier Table */}
                    <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                            Tiered Earnings (20 Levels)
                        </Typography>
                        <Chip
                            label={`${stats?.tier20TotalCount || 0} users`}
                            size="small"
                            sx={{ bgcolor: '#f1f5f9', fontWeight: 600, fontSize: '0.65rem', height: 20 }}
                        />
                    </Box>
                    <Card sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                        <TableCell sx={{ fontWeight: 800 }}>Tier</TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 800 }}>Users (A/T)</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 800 }}>Investment</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 800 }}>Earnings</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {stats?.tiers.map((tier) => (
                                        <TableRow
                                            key={tier.tier}
                                            onClick={() => handleTierClick(tier.tier, tier.userCount)}
                                            sx={{
                                                cursor: tier.tier === 1 && tier.userCount > 0 ? 'pointer' : 'default',
                                                '&:hover': { bgcolor: tier.tier === 1 && tier.userCount > 0 ? '#f1f5f9' : 'transparent' },
                                                opacity: tier.isUnlocked ? 1 : 0.6,
                                                bgcolor: tier.isUnlocked ? 'inherit' : '#f8fafc'
                                            }}
                                        >
                                            <TableCell sx={{ fontWeight: 700 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    Tier {tier.tier}
                                                    {!tier.isUnlocked && <LockIcon sx={{ fontSize: '0.8rem', color: 'error.main', ml: 0.5 }} />}
                                                </Box>
                                            </TableCell>
                                            <TableCell align="center">
                                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <Typography variant="body2" fontWeight={700}>
                                                        {tier.activeUserCount} / {tier.userCount}
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                                                {formatCurrency(tier.totalInvested)}
                                            </TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 700, color: tier.isUnlocked ? '#10b981' : 'text.secondary' }}>
                                                {formatCurrency(tier.totalEarnings)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Card>
                    {/* Tier Percentages Breakdown */}
                    <Box sx={{ mt: 3, mb: 1, px: 1 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary" gutterBottom display="block">
                            ROI Commission Structure (by Tier)
                        </Typography>
                        <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #f1f5f9', bgcolor: '#fff' }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1.5 }}>
                                {[
                                    20, 15, 10, 5, 5, 
                                    4, 4, 3, 3, 2, 
                                    2, 1.5, 1.5, 1, 1.5, 
                                    1.5, 2, 2, 3, 3
                                ].map((pct, i) => (
                                    <Box key={i} sx={{ textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', display: 'block', fontWeight: 600 }}>
                                            T{i + 1}
                                        </Typography>
                                        <Typography variant="body2" fontWeight={800} color="#7c3aed">
                                            {pct}%
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Paper>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block', fontStyle: 'italic', px: 1 }}>
                            * You earn these percentages based on the daily ROI earned by your network in each respective tier.
                        </Typography>
                    </Box>
                </>
            )}

            {activeTab === 1 && (
                <>
                    {/* History Filter */}
                    <Box sx={{ mb: 2, display: 'flex', gap: 1, overflow: 'auto', pb: 1, px: 0.5 }}>
                        {['all', 'today', 'yesterday', 'week'].map((f) => (
                            <Chip
                                key={f}
                                label={f.charAt(0).toUpperCase() + f.slice(1)}
                                onClick={() => {
                                    setHistoryFilter(f);
                                    setHistoryPage(1);
                                }}
                                sx={{
                                    bgcolor: historyFilter === f ? '#8b5cf6' : '#f1f5f9',
                                    color: historyFilter === f ? 'white' : 'text.secondary',
                                    fontWeight: 700,
                                    '&:hover': { bgcolor: historyFilter === f ? '#7c3aed' : '#e2e8f0' }
                                }}
                            />
                        ))}
                    </Box>

                    {/* History List */}
                    {historyLoading && history.length === 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: 3 }} />
                            ))}
                        </Box>
                    ) : history.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#f8fafc' }}>
                            <HistoryIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                            <Typography variant="body1" fontWeight={600} color="text.secondary">No earning history found</Typography>
                            <Typography variant="caption" color="text.secondary">Your referral earnings will appear here</Typography>
                        </Paper>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {history.map((record) => (
                                <Card key={record.id} sx={{ borderRadius: 3, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
                                    <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Box>
                                                <Typography variant="body2" fontWeight={800} color="#1e293b">
                                                    +{formatCurrency(record.amount)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                                    {formatDateTime(record.createdAt)}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={`Level ${record.tier}`}
                                                size="small"
                                                sx={{ bgcolor: '#f5f3ff', color: '#7c3aed', fontWeight: 800, fontSize: '0.65rem', height: 20 }}
                                            />
                                        </Box>
                                        <Divider sx={{ my: 1, borderStyle: 'dashed' }} />
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem', bgcolor: '#f1f5f9', color: '#64748b' }}>
                                                {getInitials(record.fromUser?.firstName, record.fromUser?.lastName)}
                                            </Avatar>
                                            <Typography variant="caption" fontWeight={600} color="text.secondary">
                                                From {record.fromUser?.firstName || record.fromUser?.telegramUsername || 'Anonymous'}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                </Card>
                            ))}

                            {/* Pagination */}
                            {totalHistory > history.length && (
                                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                                    <Button
                                        size="small"
                                        disabled={historyLoading}
                                        onClick={() => setHistoryPage(prev => prev + 1)}
                                        sx={{ textTransform: 'none', fontWeight: 700, color: '#8b5cf6' }}
                                    >
                                        {historyLoading ? 'Loading...' : 'Load More'}
                                    </Button>
                                </Box>
                            )}
                        </Box>
                    )}
                </>
            )}

            {activeTab === 2 && (
                <>
                    {/* Insights Header & Range Picker */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" fontWeight={800} color="text.secondary" gutterBottom>
                            Tier Earnings by Date Range
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <TextField
                                type="date"
                                label="From"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                size="small"
                                fullWidth
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                            <TextField
                                type="date"
                                label="To"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                size="small"
                                fullWidth
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                        </Box>
                    </Box>

                    {/* Insights Grid */}
                    {insightsLoading ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                            {[...Array(6)].map((_, i) => (
                                <Skeleton key={i} variant="rounded" height={90} sx={{ borderRadius: 3 }} />
                            ))}
                        </Box>
                    ) : insights.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#f8fafc' }}>
                            <FilterListIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                            <Typography variant="body1" fontWeight={600} color="text.secondary">No earnings in this range</Typography>
                            <Typography variant="caption" color="text.secondary">Try selecting a different date range</Typography>
                        </Paper>
                    ) : (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                            {/* We show all 20 tiers, highlighting those with data */}
                            {[...Array(20)].map((_, i) => {
                                const tierNum = i + 1;
                                const insight = insights.find(ins => ins.tier === tierNum);
                                const hasEarning = (insight?.totalEarnings || 0) > 0;
                                
                                return (
                                    <Card 
                                        key={tierNum} 
                                        sx={{ 
                                            borderRadius: 3, 
                                            boxShadow: hasEarning ? '0 4px 12px rgba(139, 92, 246, 0.1)' : 'none',
                                            border: hasEarning ? '1px solid #ddd6fe' : '1px solid #f1f5f9',
                                            bgcolor: hasEarning ? '#fff' : '#fcfcff'
                                        }}
                                    >
                                        <CardContent sx={{ p: 1.5, pb: '12px !important' }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                                                <Typography variant="caption" fontWeight={800} color={hasEarning ? '#7c3aed' : 'text.secondary'}>
                                                    TIER {tierNum}
                                                </Typography>
                                                {hasEarning && (
                                                    <Chip 
                                                        label={`${insight?.userCount || 0} users`} 
                                                        size="small" 
                                                        sx={{ height: 16, fontSize: '0.6rem', bgcolor: '#f5f3ff', color: '#7c3aed', fontWeight: 700 }}
                                                    />
                                                )}
                                            </Box>
                                            <Typography variant="subtitle1" fontWeight={800} color={hasEarning ? '#1e293b' : '#94a3b8'}>
                                                {formatCurrency(insight?.totalEarnings || 0)}
                                            </Typography>
                                            {!hasEarning && (
                                                <Typography variant="caption" color="#cbd5e1" fontWeight={600}>
                                                    No earnings
                                                </Typography>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </Box>
                    )}
                </>
            )}

            {/* Bottom Drawer for Direct Referrals */}
            <Drawer
                anchor="bottom"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                PaperProps={{
                    sx: {
                        borderRadius: '24px 24px 0 0',
                        maxHeight: '70vh',
                    },
                }}
            >
                <Box sx={{ p: 3 }}>
                    {/* Drawer Handle */}
                    <Box
                        sx={{
                            width: 40,
                            height: 4,
                            bgcolor: '#e5e7eb',
                            borderRadius: 2,
                            mx: 'auto',
                            mb: 2,
                        }}
                    />

                    {/* Header */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <EmojiEventsIcon sx={{ color: '#f59e0b' }} />
                            <Typography variant="h6" fontWeight={700}>
                                Direct Referrals (Tier 1)
                            </Typography>
                        </Box>
                        <IconButton onClick={() => setDrawerOpen(false)}>
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {/* Referral List */}
                    {stats?.directReferrals.length === 0 ? (
                        <Typography variant="body1" color="text.secondary" textAlign="center" py={4}>
                            No direct referrals yet
                        </Typography>
                    ) : (
                        <List sx={{ maxHeight: '50vh', overflow: 'auto', px: 1 }}>
                            {stats?.directReferrals.map((ref, index) => (
                                <Box key={ref.id} sx={{ mb: 1 }}>
                                    <ListItem
                                        disablePadding
                                        sx={{
                                            py: 1.5,
                                            px: 1,
                                            borderRadius: 3,
                                            bgcolor: '#f8fafc',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1.5,
                                            border: '1px solid #f1f5f9'
                                        }}
                                    >
                                        <Avatar
                                            src={ref.photoUrl || undefined}
                                            sx={{ 
                                                width: 44, 
                                                height: 44, 
                                                bgcolor: '#8b5cf6', 
                                                fontWeight: 800,
                                                fontSize: '1rem',
                                                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.2)'
                                            }}
                                        >
                                            {getInitials(ref.firstName || ref.telegramUsername || 'U')}
                                        </Avatar>
                                        <ListItemText
                                            primary={
                                                <Typography variant="body2" fontWeight={800} sx={{ color: '#1e293b' }}>
                                                    {ref.firstName || ref.telegramUsername || 'Unknown'}
                                                </Typography>
                                            }
                                            secondary={
                                                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                                                    <Chip
                                                        label={`MP: ${formatCurrency(ref.tradePower)}`}
                                                        size="small"
                                                        sx={{ bgcolor: '#eff6ff', color: '#3b82f6', fontSize: '0.6rem', height: 18, fontWeight: 600 }}
                                                    />
                                                    <Chip
                                                        label={`Total: ${formatCurrency(ref.totalInvested)}`}
                                                        size="small"
                                                        sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontSize: '0.6rem', height: 18, fontWeight: 600 }}
                                                    />
                                                    <Chip
                                                        label={ref.isActive ? 'Active' : 'Inactive'}
                                                        size="small"
                                                        sx={{
                                                            bgcolor: ref.isActive ? '#dcfce7' : '#fee2e2',
                                                            color: ref.isActive ? '#16a34a' : '#ef4444',
                                                            fontSize: '0.6rem',
                                                            height: 18,
                                                            fontWeight: 700
                                                        }}
                                                    />
                                                </Box>
                                            }
                                            sx={{ m: 0, flex: 1 }}
                                        />
                                        <Box sx={{ textAlign: 'right', minWidth: 'fit-content', pl: 1 }}>
                                            <Typography variant="body2" fontWeight={900} color="#10b981" lineHeight={1.1}>
                                                {formatCurrency(ref.earnings)}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                                earned
                                            </Typography>
                                        </Box>
                                    </ListItem>
                                </Box>
                            ))}
                        </List>
                    )}
                </Box>
            </Drawer>

            {/* Claim Dialog */}
            <Dialog 
                open={claimDialogOpen} 
                onClose={() => !claiming && setClaimDialogOpen(false)}
                PaperProps={{
                    sx: { borderRadius: 4, width: '100%', maxWidth: 400, m: 2 }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>Claim Referral Bonus</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Enter the amount you want to claim. The minimum amount is 10 USDT.
                    </Typography>
                    
                    <Box sx={{ mb: 2, p: 2, bgcolor: '#f1f5f9', borderRadius: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">Available Balance</Typography>
                            <Typography variant="caption" fontWeight={700}>{formatCurrency(stats?.referralWalletBalance || 0)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="caption" color="text.secondary">Claimable Limit</Typography>
                            <Typography variant="caption" fontWeight={700} color="#7c3aed">
                                {formatCurrency(Math.max(0, (stats?.tradePower || 0) * (stats?.referralClaimMultiplier || 1) - (stats?.totalClaimed || 0)))}
                            </Typography>
                        </Box>
                    </Box>

                    <TextField
                        fullWidth
                        label="Amount (USDT)"
                        variant="outlined"
                        type="number"
                        value={claimAmount}
                        onChange={(e) => setClaimAmount(e.target.value)}
                        disabled={claiming}
                        error={!!claimError}
                        helperText={claimError}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                borderRadius: 3,
                                fontWeight: 600
                            }
                        }}
                    />
                </DialogContent>
                <DialogActions sx={{ p: 2, pt: 0 }}>
                    <Button 
                        onClick={() => setClaimDialogOpen(false)} 
                        disabled={claiming}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                    >
                        Cancel
                    </Button>
                    <Button 
                        variant="contained" 
                        onClick={handleClaim} 
                        disabled={claiming}
                        sx={{ 
                            textTransform: 'none', 
                            fontWeight: 700, 
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                            boxShadow: '0 4px 12px rgba(124, 58, 237, 0.3)'
                        }}
                    >
                        {claiming ? 'Claiming...' : 'Confirm Claim'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
