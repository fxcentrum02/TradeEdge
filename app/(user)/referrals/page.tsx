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
import { formatCurrency, formatDateTime, getInitials, getAvatarUrl } from '@/lib/utils';
import type { ReferralStats } from '@/types';
import { useAuth } from '@/context/AuthContext';
import ReferralTierMatrix from './_components/ReferralTierMatrix';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { MilestoneStatus, MilestonePageData } from '@/app/api/referrals/milestones/route';

export default function ReferralsPage() {
    const { authFetch, swrFetch, clearCache } = useAuth();
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

    // Milestones state
    const [milestoneData, setMilestoneData] = useState<MilestonePageData | null>(null);
    const [milestonesLoading, setMilestonesLoading] = useState(false);

    // History state
    const [history, setHistory] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyFilter, setHistoryFilter] = useState('all');
    const [totalHistory, setTotalHistory] = useState(0);

    const fetchStats = async (forceRefresh = false) => {
        if (forceRefresh) {
            clearCache('/api/referrals');
        }
        await swrFetch('/api/referrals', setStats, setLoading);
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
        if (activeTab === 0) {
            fetchStats(false);
        } else if (activeTab === 1) {
            fetchHistory(historyPage, historyFilter);
        }
    }, [activeTab, historyPage, historyFilter]);

    useEffect(() => {
        if (activeTab === 2) {
            fetchInsights();
        }
    }, [activeTab, startDate, endDate]);

    useEffect(() => {
        if (activeTab === 3) {
            fetchMilestones();
        }
    }, [activeTab]);

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

    const fetchMilestones = async () => {
        try {
            setMilestonesLoading(true);
            const res = await authFetch('/api/referrals/milestones');
            const data = await res.json();
            if (data.success) setMilestoneData(data.data);
        } catch (error) {
            console.error('Milestones error:', error);
        } finally {
            setMilestonesLoading(false);
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
        const MIN_CLAIM = stats?.minReferralWithdrawalAmount || 10;
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
                fetchStats(true);

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
            <Typography variant="h6" fontWeight={800} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, color: '#f8fafc' }}>
                <PeopleIcon fontSize="small" sx={{ color: '#06b6d4' }} />
                Friends & Referrals
            </Typography>

            {/* Tabs */}
            <Paper
                elevation={0}
                sx={{
                    mb: 3,
                    borderRadius: 2,
                    overflow: 'hidden',
                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)',
                }}
            >
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    variant="fullWidth"
                    sx={{
                        '& .MuiTab-root': {
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            textTransform: 'none',
                            py: 1.6,
                            color: '#94a3b8',
                            '&.Mui-selected': { color: '#06b6d4 !important' },
                        },
                        '& .MuiTabs-indicator': { bgcolor: '#06b6d4', height: 3 },
                    }}
                >
                    <Tab icon={<TrendingUpIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Tiered Earnings" />
                    <Tab icon={<HistoryIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="History" />
                    <Tab icon={<FilterListIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Insights" />
                    <Tab icon={<EmojiEventsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Milestones" />
                </Tabs>
            </Paper>

            {activeTab === 0 && (
                <>
                    {/* Explanatory Text */}
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2.2,
                            mb: 3,
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.9) 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
                        }}
                    >
                        <Typography variant="subtitle2" fontWeight={800} color="#38bdf8" gutterBottom sx={{ letterSpacing: '0.2px' }}>
                            Referral Program Rewards
                        </Typography>
                        <Typography variant="body2" color="#94a3b8" sx={{ mb: 1.5, lineHeight: 1.6 }}>
                            Earn massive rewards by building your network! Our 20-tier referral program allows you to earn a percentage of the daily ROI earned by your friends and their downline.
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                <Box sx={{ mt: 0.5, width: 16, height: 16, borderRadius: '50%', bgcolor: 'rgba(52, 211, 153, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#34d399' }} />
                                </Box>
                                <Box>
                                    <Typography variant="caption" fontWeight={700} color="#f8fafc">20-Tier ROI Commissions</Typography>
                                    <Typography variant="caption" display="block" color="#94a3b8">Earn a percentage of the daily ROI earned by your entire network up to 20 levels deep!</Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                <Box sx={{ mt: 0.5, width: 16, height: 16, borderRadius: '50%', bgcolor: 'rgba(251, 191, 36, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#fbbf24' }} />
                                </Box>
                                <Box>
                                    <Typography variant="caption" fontWeight={700} color="#f8fafc">Dynamic Tier Unlocking</Typography>
                                    <Typography variant="caption" display="block" color="#94a3b8">Tier 1 is always unlocked. Tiers 2-20 unlock as your personal and direct team investment grows (100 USDT per Tier).</Typography>
                                </Box>
                            </Box>
                        </Box>
                    </Paper>

                    {/* Referral Bonus Banner */}
                    <Card
                        sx={{
                            mb: 2,
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                            color: 'white',
                            overflow: 'hidden',
                            boxShadow: '0 12px 36px rgba(79, 70, 229, 0.35)',
                        }}
                    >
                        <CardContent sx={{ p: 2.5 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box>
                                    <Typography variant="caption" sx={{ opacity: 0.9, mb: 0.5, display: 'block', fontWeight: 600 }}>
                                        Referral Bonus
                                    </Typography>
                                    <Typography variant="h4" fontWeight={900}>
                                        {formatCurrency(stats?.referralWalletBalance || 0)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.68rem' }}>
                                        Total Lifetime Earned: {formatCurrency(stats?.totalEarnings || 0)}
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                    <Button
                                        variant="contained"
                                        size="small"
                                        onClick={handleClaimClick}
                                        disabled={claiming || !stats?.referralWalletBalance || stats.referralWalletBalance < ((stats?.minReferralWithdrawalAmount || 10) - 0.001)}
                                        sx={{
                                            bgcolor: claiming ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.25)',
                                            color: 'white',
                                            backdropFilter: 'blur(10px)',
                                            borderRadius: 2,
                                            px: 2.4,
                                            py: 0.8,
                                            fontWeight: 700,
                                            textTransform: 'none',
                                            fontSize: '0.85rem',
                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' },
                                            '&:disabled': { color: 'rgba(255,255,255,0.4)' }
                                        }}
                                    >
                                        {claiming ? 'Processing...' : 'Claim'}
                                    </Button>
                                    {(!stats?.referralWalletBalance || stats.referralWalletBalance < (stats?.minReferralWithdrawalAmount || 10)) && (
                                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, fontSize: '0.66rem', opacity: 0.8 }}>
                                            Min {stats?.minReferralWithdrawalAmount || 10} USDT
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                            {claimSuccess && (
                                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#34d399', fontWeight: 700 }}>
                                    {claimSuccess}
                                </Typography>
                            )}
                        </CardContent>
                    </Card>

                    {/* Share Referral Link */}
                    <Paper
                        elevation={0}
                        sx={{
                            mb: 2,
                            p: 2,
                            borderRadius: 2,
                            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
                        }}
                    >
                        <Typography variant="caption" color="#94a3b8" fontWeight={600}>Your Referral Link (Telegram)</Typography>
                        <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{
                                fontFamily: 'monospace',
                                bgcolor: 'rgba(56, 189, 248, 0.1)',
                                color: '#38bdf8',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                p: 1,
                                px: 1.2,
                                borderRadius: 2,
                                mt: 0.8,
                                mb: 1.5,
                                wordBreak: 'break-all',
                                fontSize: '0.72rem',
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
                                    fontWeight: 700,
                                    color: copied ? '#34d399' : '#38bdf8',
                                    borderColor: copied ? '#34d399' : 'rgba(56, 189, 248, 0.4)',
                                    py: 0.8,
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
                                    background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    py: 0.8,
                                    boxShadow: '0 6px 18px rgba(6, 182, 212, 0.35)',
                                }}
                            >
                                Share on Telegram
                            </Button>
                        </Box>
                    </Paper>

                    {/* Stats Cards */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.2, mb: 2 }}>
                        <Card sx={{ borderRadius: 2, background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)' }}>
                            <CardContent sx={{ textAlign: 'center', py: 1.8, px: 1 }}>
                                <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', mx: 'auto', mb: 0.5, width: 32, height: 32 }}>
                                    <PeopleIcon sx={{ fontSize: 18 }} />
                                </Avatar>
                                <Typography variant="subtitle1" fontWeight={900} color="#ffffff">
                                    {stats?.totalReferrals || 0}
                                </Typography>
                                <Typography variant="caption" color="#94a3b8" sx={{ fontSize: '0.62rem', fontWeight: 600 }}>
                                    Direct Refs
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card sx={{ borderRadius: 2, background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)' }}>
                            <CardContent sx={{ textAlign: 'center', py: 1.8, px: 1 }}>
                                <Avatar sx={{ bgcolor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', mx: 'auto', mb: 0.5, width: 32, height: 32 }}>
                                    <PeopleIcon sx={{ fontSize: 18 }} />
                                </Avatar>
                                <Typography variant="subtitle1" fontWeight={900} color="#ffffff">
                                    {stats?.totalDownlineCount || 0}
                                </Typography>
                                <Typography variant="caption" color="#94a3b8" sx={{ fontSize: '0.62rem', fontWeight: 600 }}>
                                    Total Downline
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card sx={{ borderRadius: 2, background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)' }}>
                            <CardContent sx={{ textAlign: 'center', py: 1.8, px: 1 }}>
                                <Avatar sx={{ bgcolor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', mx: 'auto', mb: 0.5, width: 32, height: 32 }}>
                                    <MonetizationOnIcon sx={{ fontSize: 18 }} />
                                </Avatar>
                                <Typography variant="subtitle1" fontWeight={900} color="#ffffff">
                                    {formatCurrency(stats?.totalDownlineTradePower || 0)}
                                </Typography>
                                <Typography variant="caption" color="#94a3b8" sx={{ fontSize: '0.62rem', fontWeight: 600 }}>
                                    Downline MP
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>

                    {/* Tier Table & Percentage Breakdown */}
                    <ReferralTierMatrix
                        tierBreakdown={stats?.tiers || []}
                        tier20TotalCount={stats?.tier20TotalCount || 0}
                        onTierClick={handleTierClick}
                    />
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
                                    borderRadius: 3,
                                    fontWeight: 700,
                                    textTransform: 'none',
                                    px: 1.2,
                                    height: 32,
                                    background: historyFilter === f ? 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)' : 'rgba(30, 41, 59, 0.6)',
                                    color: historyFilter === f ? '#ffffff' : '#94a3b8',
                                    border: historyFilter === f ? 'none' : '1px solid rgba(255, 255, 255, 0.08)',
                                    boxShadow: historyFilter === f ? '0 4px 14px rgba(6, 182, 212, 0.35)' : 'none',
                                }}
                            />
                        ))}
                    </Box>

                    {/* History List */}
                    {historyLoading && history.length === 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {[1, 2, 3, 4, 5].map((i) => (
                                <Skeleton key={i} variant="rounded" height={80} sx={{ borderRadius: 2 }} />
                            ))}
                        </Box>
                    ) : history.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <HistoryIcon sx={{ fontSize: 48, color: '#64748b', mb: 1 }} />
                            <Typography variant="body1" fontWeight={700} color="#f8fafc">No earning history found</Typography>
                            <Typography variant="caption" color="#94a3b8">Your referral earnings will appear here</Typography>
                        </Paper>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {history.map((record) => (
                                <Card key={record.id} sx={{ borderRadius: 2, background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 12px 32px rgba(0,0,0,0.35)' }}>
                                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Box>
                                                <Typography variant="body2" fontWeight={900} color="#34d399">
                                                    +{formatCurrency(record.amount)}
                                                </Typography>
                                                <Typography variant="caption" color="#94a3b8" sx={{ display: 'block', mt: 0.2 }}>
                                                    {formatDateTime(record.createdAt)}
                                                </Typography>
                                            </Box>
                                            <Chip
                                                label={`Level ${record.tier}`}
                                                size="small"
                                                sx={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 800, fontSize: '0.68rem', height: 22 }}
                                            />
                                        </Box>
                                        <Divider sx={{ my: 1.2, borderColor: 'rgba(255, 255, 255, 0.06)' }} />
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar sx={{ width: 26, height: 26, fontSize: '0.72rem', bgcolor: 'rgba(255, 255, 255, 0.1)', color: '#f1f5f9' }}>
                                                {getInitials(record.fromUser?.firstName, record.fromUser?.lastName)}
                                            </Avatar>
                                            <Typography variant="caption" fontWeight={600} color="#f8fafc">
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
                                        sx={{ textTransform: 'none', fontWeight: 800, color: '#38bdf8' }}
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
                        <Typography variant="subtitle2" fontWeight={800} color="#f8fafc" gutterBottom>
                            Tier Earnings by Date Range
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5 }}>
                            <TextField
                                type="date"
                                label="From"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                size="small"
                                fullWidth
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        bgcolor: 'rgba(30, 41, 59, 0.8)',
                                        color: '#ffffff',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        '& fieldset': { border: 'none' },
                                    },
                                    '& .MuiInputLabel-root': { color: '#94a3b8' },
                                }}
                            />
                            <TextField
                                type="date"
                                label="To"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                InputLabelProps={{ shrink: true }}
                                size="small"
                                fullWidth
                                sx={{
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        bgcolor: 'rgba(30, 41, 59, 0.8)',
                                        color: '#ffffff',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        '& fieldset': { border: 'none' },
                                    },
                                    '& .MuiInputLabel-root': { color: '#94a3b8' },
                                }}
                            />
                        </Box>
                    </Box>

                    {/* Insights Grid */}
                    {insightsLoading ? (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                            {[...Array(6)].map((_, i) => (
                                <Skeleton key={i} variant="rounded" height={90} sx={{ borderRadius: 2 }} />
                            ))}
                        </Box>
                    ) : insights.length === 0 ? (
                        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <FilterListIcon sx={{ fontSize: 48, color: '#64748b', mb: 1 }} />
                            <Typography variant="body1" fontWeight={700} color="#f8fafc">No earnings in this range</Typography>
                            <Typography variant="caption" color="#94a3b8">Try selecting a different date range</Typography>
                        </Paper>
                    ) : (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                            {[...Array(20)].map((_, i) => {
                                const tierNum = i + 1;
                                const insight = insights.find(ins => ins.tier === tierNum);
                                const hasEarning = (insight?.totalEarnings || 0) > 0;
                                
                                return (
                                    <Card 
                                        key={tierNum} 
                                        sx={{ 
                                            borderRadius: 2, 
                                            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
                                            border: hasEarning ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                                            boxShadow: hasEarning ? '0 8px 24px rgba(6, 182, 212, 0.2)' : 'none',
                                            opacity: hasEarning ? 1 : 0.65,
                                        }}
                                    >
                                        <CardContent sx={{ p: 1.8, pb: '16px !important' }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                                                <Typography variant="caption" fontWeight={800} color={hasEarning ? '#38bdf8' : '#94a3b8'}>
                                                    TIER {tierNum}
                                                </Typography>
                                                {hasEarning && (
                                                    <Chip 
                                                        label={`${insight?.userCount || 0} users`} 
                                                        size="small" 
                                                        sx={{ height: 18, fontSize: '0.62rem', bgcolor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 800 }}
                                                    />
                                                )}
                                            </Box>
                                            <Typography variant="subtitle1" fontWeight={900} color={hasEarning ? '#ffffff' : '#64748b'}>
                                                {formatCurrency(insight?.totalEarnings || 0)}
                                            </Typography>
                                            {!hasEarning && (
                                                <Typography variant="caption" color="#64748b" fontWeight={600}>
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

            {activeTab === 3 && (
                <>
                    {/* Milestones Header */}
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2.2,
                            mb: 3,
                            borderRadius: 2,
                            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.9) 100%)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
                        }}
                    >
                        <Typography variant="subtitle2" fontWeight={800} color="#fbbf24" gutterBottom>
                            🏆 Milestone Bonus Program
                        </Typography>
                        <Typography variant="body2" color="#94a3b8" sx={{ mb: 1.5, lineHeight: 1.6 }}>
                            Build a balanced network and unlock massive one-time USDT rewards! Each milestone uses the <strong>40/30/30 rule</strong> across your downline legs.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            <Chip label="Leg A: 40% of target" size="small" sx={{ bgcolor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.3)', fontWeight: 800, fontSize: '0.65rem', height: 22 }} />
                            <Chip label="Leg B: 30% of target" size="small" sx={{ bgcolor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.3)', fontWeight: 800, fontSize: '0.65rem', height: 22 }} />
                            <Chip label="Leg C (rest): 30%" size="small" sx={{ bgcolor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', fontWeight: 800, fontSize: '0.65rem', height: 22 }} />
                        </Box>
                    </Paper>

                    {/* Summary Stats */}
                    {milestoneData && (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5, mb: 3 }}>
                            <Card sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)', color: 'white', boxShadow: '0 12px 32px rgba(6, 182, 212, 0.35)' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', fontWeight: 600 }}>Milestones Achieved</Typography>
                                    <Typography variant="h4" fontWeight={900}>{milestoneData.totalAwarded} / 11</Typography>
                                </CardContent>
                            </Card>
                            <Card sx={{ borderRadius: 2, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', boxShadow: '0 12px 32px rgba(16, 185, 129, 0.35)' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Typography variant="caption" sx={{ opacity: 0.9, display: 'block', fontWeight: 600 }}>Total Bonus Earned</Typography>
                                    <Typography variant="h4" fontWeight={900}>{formatCurrency(milestoneData.totalUSDT)}</Typography>
                                </CardContent>
                            </Card>
                        </Box>
                    )}

                    {/* Milestone Cards */}
                    {milestonesLoading ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {[...Array(5)].map((_, i) => (
                                <Skeleton key={i} variant="rounded" height={160} sx={{ borderRadius: 2 }} />
                            ))}
                        </Box>
                    ) : !milestoneData ? (
                        <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 2, background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                            <EmojiEventsOutlinedIcon sx={{ fontSize: 48, color: '#64748b', mb: 1 }} />
                            <Typography variant="body1" fontWeight={700} color="#f8fafc">No data yet</Typography>
                        </Paper>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {milestoneData.milestones.map((m) => (
                                <Card
                                    key={m.threshold}
                                    sx={{
                                        borderRadius: 2,
                                        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
                                        border: m.isAchieved
                                            ? '1.5px solid #34d399'
                                            : milestoneData.nextMilestone?.threshold === m.threshold
                                            ? '1.5px solid #fbbf24'
                                            : '1px solid rgba(255, 255, 255, 0.08)',
                                        boxShadow: m.isAchieved ? '0 8px 24px rgba(52, 211, 153, 0.2)' : '0 12px 32px rgba(0,0,0,0.35)',
                                        opacity: !m.isAchieved && milestoneData.nextMilestone && milestoneData.nextMilestone.threshold < m.threshold ? 0.55 : 1,
                                    }}
                                >
                                    <CardContent sx={{ p: 2.2 }}>
                                        {/* Header */}
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {m.isAchieved
                                                    ? <CheckCircleIcon sx={{ color: '#34d399', fontSize: 24 }} />
                                                    : <EmojiEventsOutlinedIcon sx={{ color: milestoneData.nextMilestone?.threshold === m.threshold ? '#fbbf24' : '#64748b', fontSize: 24 }} />
                                                }
                                                <Box>
                                                    <Typography variant="body1" fontWeight={900} color={m.isAchieved ? '#34d399' : '#f8fafc'}>
                                                        {m.threshold >= 1_000_000
                                                            ? `${(m.threshold / 1_000_000).toFixed(m.threshold % 1_000_000 === 0 ? 0 : 1)}M`
                                                            : `${(m.threshold / 1000).toFixed(0)}K`} USDT
                                                    </Typography>
                                                    {m.isAchieved && m.achievedAt && (
                                                        <Typography variant="caption" color="#34d399" fontWeight={700}>
                                                            ✅ Achieved {new Date(m.achievedAt).toLocaleDateString()}
                                                        </Typography>
                                                    )}
                                                    {!m.isAchieved && milestoneData.nextMilestone?.threshold === m.threshold && (
                                                        <Typography variant="caption" color="#fbbf24" fontWeight={800}>
                                                            🎯 Next Target
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                            <Chip
                                                label={`+${m.reward >= 1000 ? `$${(m.reward / 1000).toFixed(m.reward % 1000 === 0 ? 0 : 1)}K` : `$${m.reward}`}`}
                                                size="small"
                                                sx={{
                                                    background: m.isAchieved ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 191, 36, 0.15)',
                                                    color: m.isAchieved ? '#34d399' : '#fbbf24',
                                                    border: m.isAchieved ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid rgba(251, 191, 36, 0.3)',
                                                    fontWeight: 900,
                                                    fontSize: '0.78rem',
                                                    height: 24,
                                                }}
                                            />
                                        </Box>

                                        {/* Progress Bars — show for unachieved milestones */}
                                        {!m.isAchieved && (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                {[
                                                    { label: 'Leg A (40%)', pct: m.legAPct, current: m.legA, required: m.legARequired, color: '#fbbf24' },
                                                    { label: 'Leg B (30%)', pct: m.legBPct, current: m.legB, required: m.legBRequired, color: '#34d399' },
                                                    { label: 'Leg C (30%)', pct: m.legCPct, current: m.legC, required: m.legCRequired, color: '#38bdf8' },
                                                ].map(leg => (
                                                    <Box key={leg.label}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                                                            <Typography variant="caption" fontWeight={700} color="#94a3b8" sx={{ fontSize: '0.65rem' }}>
                                                                {leg.label}
                                                            </Typography>
                                                            <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.65rem', color: leg.pct >= 100 ? '#34d399' : '#94a3b8' }}>
                                                                {formatCurrency(leg.current)} / {formatCurrency(leg.required)}
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ height: 6, bgcolor: 'rgba(255, 255, 255, 0.08)', borderRadius: 3, overflow: 'hidden' }}>
                                                            <Box
                                                                sx={{
                                                                    height: '100%',
                                                                    width: `${leg.pct}%`,
                                                                    bgcolor: leg.pct >= 100 ? '#34d399' : leg.color,
                                                                    borderRadius: 3,
                                                                    transition: 'width 0.6s ease',
                                                                }}
                                                            />
                                                        </Box>
                                                    </Box>
                                                ))}
                                            </Box>
                                        )}

                                        {/* Achieved snapshot */}
                                        {m.isAchieved && (
                                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                                                <Chip label={`Leg B: ${formatCurrency(m.legB)}`} size="small" sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 600, fontSize: '0.6rem', height: 18 }} />
                                                <Chip label={`Leg C: ${formatCurrency(m.legC)}`} size="small" sx={{ bgcolor: '#dbeafe', color: '#1e3a8a', fontWeight: 600, fontSize: '0.6rem', height: 18 }} />
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
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
                                            src={getAvatarUrl(ref.photoUrl)}
                                            imgProps={{ referrerPolicy: 'no-referrer' }}
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
