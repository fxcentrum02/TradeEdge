'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Box, Card, CardContent, Typography, Skeleton, Button, Chip, Paper,
    Table, TableBody, TableCell, TableContainer, TableRow, Tabs, Tab,
    Avatar, LinearProgress, Divider, List, ListItem, ListItemText,
    Stack
} from '@mui/material';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

import ReinvestModal from '../_components/ReinvestModal';
import PromoModal from '../_components/PromoModal';
import { useAuth } from '@/context/AuthContext';
import { pusherClient } from '@/lib/pusher-client';
import { formatCurrency } from '@/lib/utils';
import { getUserRank } from '@/lib/utils/ranks';
import { Snackbar, Alert } from '@mui/material';
import type { Plan } from '@/types';
import { useRouter } from 'next/navigation';


// Compute time remaining until next 10 AM IST (04:30 AM UTC)
function getTimeUntilSettlement(): string {
    const now = new Date();

    // Target: 04:30:00 UTC
    const targetUTC = new Date(now);
    targetUTC.setUTCHours(4, 30, 0, 0);

    // If we've already passed 04:30 UTC today, the next settlement is tomorrow
    if (now >= targetUTC) {
        targetUTC.setUTCDate(targetUTC.getUTCDate() + 1);
    }

    const diffMs = targetUTC.getTime() - now.getTime();

    const h = Math.floor(diffMs / (1000 * 60 * 60));
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diffMs % (1000 * 60)) / 1000);

    return `${h}h ${m}m ${s}s`;
}

interface DashboardData {
    walletBalance: number;
    tradePower: number;
    activePlans: number;
    totalDailyEarnings: number;
    activePlanDetails: {
        id: string;
        amount: number;
        planName: string;
        dailyRoi: number;
        dailyRoiAmount: number;
        daysLeft: number;
        totalRoiPaid: number;
        startDate: string | Date;
        endDate: string | Date;
        msLeft: number;
    }[];
    upline?: { name: string; username: string | null } | null;
    totalEarnings: number;
    totalInvestment: number;
    netProfit: number;
    sparklineData: { date: string; amount: number }[];
}

export default function DashboardPage() {
    const { user, authFetch, swrFetch, clearCache } = useAuth();
    const router = useRouter();
    const [dashboard, setDashboard] = useState<DashboardData | null>(null);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [pendingTickets, setPendingTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tabValue, setTabValue] = useState(0);
    const [countdown, setCountdown] = useState(getTimeUntilSettlement());
    const [reinvestModalOpen, setReinvestModalOpen] = useState(false);
    const [promoOpen, setPromoOpen] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    // Check localStorage on mount to show promo modal
    useEffect(() => {
        const hasSeenPromo = localStorage.getItem('hasSeenMin10Promo');
        if (!hasSeenPromo) {
            setPromoOpen(true);
        }
    }, []);

    const handleClosePromo = () => {
        localStorage.setItem('hasSeenMin10Promo', 'true');
        setPromoOpen(false);
    };

    // Live countdown
    useEffect(() => {
        const timer = setInterval(() => setCountdown(getTimeUntilSettlement()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchData = useCallback(async (forceRefresh = false) => {
        if (forceRefresh) {
            clearCache('/api/users/me?include=dashboard');
        }
        await swrFetch('/api/users/me?include=dashboard', (userData) => {
            setDashboard(userData);
            if (userData.availablePlans) {
                setPlans(userData.availablePlans);
            }
            if (userData.pendingTickets) {
                setPendingTickets(userData.pendingTickets);
            }
        }, setLoading);
    }, [swrFetch, clearCache]);

    useEffect(() => {
        fetchData(false);

        let userChannel: any = null;
        if (user?.id) {
            userChannel = pusherClient.subscribe(`user-${user.id}-notifications`);

            userChannel.bind('ticket-approved', (data: any) => {
                setSnackbar({
                    open: true,
                    message: `Payment approved! +${data.amount} USDT Mining Power added.`,
                    severity: 'success'
                });
                fetchData(true);
            });

            userChannel.bind('ticket-rejected', (data: any) => {
                setSnackbar({
                    open: true,
                    message: `Payment of ${data.amount} USDT was rejected.`,
                    severity: 'error'
                });
                fetchData(true);
            });

            userChannel.bind('withdrawal-approved', (data: any) => {
                setSnackbar({
                    open: true,
                    message: `Your withdrawal of ${data.amount} USDT was approved!`,
                    severity: 'success'
                });
                fetchData(true);
            });

            userChannel.bind('withdrawal-rejected', (data: any) => {
                setSnackbar({
                    open: true,
                    message: `Your withdrawal of ${data.amount} USDT was rejected.`,
                    severity: 'error'
                });
                fetchData(true);
            });
        }

        const globalChannel = pusherClient.subscribe('global-events');
        globalChannel.bind('roi-settled', () => {
            fetchData(true);
        });

        return () => {
            if (user?.id) pusherClient.unsubscribe(`user-${user.id}-notifications`);
            pusherClient.unsubscribe('global-events');
        };
    }, [fetchData, user?.id]);

    const handleReinvestSuccess = (data: any) => {
        setSnackbar({
            open: true,
            message: `Successfully exchanged ${data.amount} USDT to Compounding Power!`,
            severity: 'success'
        });
        fetchData(true);
    };

    if (loading) {
        return (
            <Box sx={{ py: 2 }}>
                <Skeleton variant="rounded" height={80} sx={{ mb: 2, borderRadius: 3 }} />
                <Skeleton variant="rounded" height={180} sx={{ mb: 2, borderRadius: 3 }} />
                <Skeleton variant="rounded" height={120} sx={{ borderRadius: 3 }} />
            </Box>
        );
    }

    const totalDailyEarnings = dashboard?.totalDailyEarnings ?? 0;
    const tradePower = dashboard?.tradePower ?? 0;

    return (
        <Box sx={{ pb: 10 }}>
            {/* Balance + Withdraw Header */}
            <Paper
                elevation={0}
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                    p: 1.8,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.9) 100%)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)',
                    transition: 'all 0.2s ease-in-out',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ bgcolor: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', width: 38, height: 38 }}>
                        <AccountBalanceWalletIcon fontSize="small" />
                    </Avatar>
                    <Box>
                        <Typography variant="caption" color="#94a3b8" fontWeight={600} sx={{ letterSpacing: '0.2px' }}>
                            Your Balance
                        </Typography>
                        <Typography variant="h6" fontWeight={800} color="#34d399" sx={{ letterSpacing: '-0.3px', textShadow: '0 0 12px rgba(52, 211, 153, 0.3)' }}>
                            {formatCurrency(dashboard?.walletBalance || 0)}
                        </Typography>
                    </Box>
                </Box>
                <Button
                    variant="contained"
                    size="small"
                    endIcon={<ArrowForwardIcon fontSize="small" />}
                    onClick={() => router.push('/withdraw')}
                    sx={{
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        textTransform: 'none',
                        borderRadius: 2,
                        px: 2.4,
                        py: 0.8,
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        boxShadow: '0 6px 20px rgba(16, 185, 129, 0.35)',
                        transition: 'all 0.15s ease',
                        '&:active': { transform: 'scale(0.96)' },
                    }}
                >
                    Withdraw
                </Button>
            </Paper>

            {/* Trade Power Card */}
            <Card
                sx={{
                    mb: 2,
                    borderRadius: 2,
                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
                }}
            >
                <CardContent sx={{ p: 2.8, textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1, mt: 1 }}>
                        <ShowChartIcon sx={{ color: '#38bdf8', fontSize: 22 }} />
                        <Typography variant="subtitle2" fontWeight={700} color="#94a3b8" sx={{ letterSpacing: '0.3px' }}>
                            Mining Power (MP)
                        </Typography>
                    </Box>

                    <Typography
                        variant="h3"
                        fontWeight={900}
                        sx={{
                            color: '#ffffff',
                            mb: 1.2,
                            letterSpacing: '-1px',
                            textShadow: '0 4px 20px rgba(255, 255, 255, 0.1)',
                        }}
                    >
                        {tradePower.toLocaleString()}
                    </Typography>

                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2.5, mb: 2.2 }}>
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="caption" color="#94a3b8" fontWeight={600}>Daily Earnings</Typography>
                            <Typography variant="h6" fontWeight={800} color="#34d399">
                                {totalDailyEarnings > 0 ? `+${totalDailyEarnings.toFixed(2)}` : '0.00'} USDT
                            </Typography>
                        </Box>
                        <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="caption" color="#94a3b8" fontWeight={600}>Active Plans</Typography>
                            <Typography variant="h6" fontWeight={800} color="#f8fafc">
                                {dashboard?.activePlans ?? 0}
                            </Typography>
                        </Box>
                    </Box>

                    <Chip
                        icon={<AccessTimeIcon sx={{ fontSize: 16, color: '#38bdf8 !important' }} />}
                        label={`Next settlement in ${countdown}`}
                        size="small"
                        sx={{
                            background: 'rgba(56, 189, 248, 0.1)',
                            color: '#38bdf8',
                            fontWeight: 700,
                            px: 1.2,
                            py: 0.3,
                            border: '1px solid rgba(56, 189, 248, 0.25)',
                            fontFamily: 'monospace',
                        }}
                    />
                </CardContent>
            </Card>

            {/* Action Buttons */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
                <Button
                    fullWidth
                    variant="contained"
                    size="medium"
                    startIcon={<TrendingUpIcon />}
                    onClick={() => router.push('/buy-tp')}
                    sx={{
                        background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                        color: '#ffffff',
                        borderRadius: 2,
                        py: 1.4,
                        textTransform: 'none',
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        boxShadow: '0 8px 25px rgba(16, 185, 129, 0.35)',
                        transition: 'all 0.15s ease',
                        '&:active': { transform: 'scale(0.97)' },
                    }}
                >
                    Buy Mining Power
                </Button>
                <Button
                    fullWidth
                    variant="contained"
                    size="medium"
                    startIcon={<GroupAddIcon />}
                    onClick={() => router.push('/referrals')}
                    sx={{
                        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                        color: '#ffffff',
                        borderRadius: 2,
                        py: 1.4,
                        textTransform: 'none',
                        fontSize: '0.92rem',
                        fontWeight: 700,
                        boxShadow: '0 8px 25px rgba(99, 102, 241, 0.35)',
                        transition: 'all 0.15s ease',
                        '&:active': { transform: 'scale(0.97)' },
                    }}
                >
                    Refer & Earn
                </Button>
            </Box>

            {/* Investment Return Tiers */}
            <Card
                sx={{
                    mb: 3,
                    borderRadius: 2,
                    overflow: 'hidden',
                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
                }}
            >
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <Typography variant="subtitle2" fontWeight={800} color="#f8fafc" sx={{ letterSpacing: '-0.2px' }}>
                        Investment Return Tiers
                    </Typography>
                    <Chip label="Daily ROI" size="small" sx={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 800, fontSize: '0.7rem' }} />
                </Box>
                <TableContainer>
                    <Table size="small">
                        <TableBody>
                            {plans.length > 0 ? (
                                plans.map((plan, index) => (
                                    <TableRow
                                        key={plan.id}
                                        sx={{
                                            '&:last-child td': { border: 0 },
                                            bgcolor: index % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)',
                                            transition: 'background-color 0.15s ease',
                                            '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
                                        }}
                                    >
                                        <TableCell sx={{ py: 1.6, px: 2 }}>
                                            <Typography variant="body2" fontWeight={700} color="#f1f5f9">{plan.name}</Typography>
                                            <Typography variant="caption" color="#94a3b8" fontWeight={500}>
                                                {formatCurrency(plan.minAmount)}
                                                {plan.maxAmount ? ` – ${formatCurrency(plan.maxAmount)}` : '+'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right" sx={{ py: 1.6, px: 2 }}>
                                            <Chip
                                                label={`${plan.dailyRoi}% / day`}
                                                size="small"
                                                sx={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', fontWeight: 800 }}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={2} align="center" sx={{ py: 4 }}>
                                        <Typography color="#94a3b8" variant="body2" fontWeight={500}>No tiers configured</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Card>

            {/* Tabs: Portfolio */}
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
                <Tabs
                    value={tabValue}
                    onChange={(e, v) => setTabValue(v)}
                    variant="fullWidth"
                    sx={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                        '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, py: 1.6, fontSize: '0.88rem', color: '#94a3b8' },
                        '& .Mui-selected': { color: '#06b6d4 !important' },
                        '& .MuiTabs-indicator': { bgcolor: '#06b6d4', height: 3, borderRadius: '3px 3px 0 0' },
                    }}
                >
                    <Tab label="My Subscriptions" />
                    <Tab label="Summary" />
                </Tabs>

                <Box sx={{ p: 2 }}>
                    {tabValue === 0 ? (
                        dashboard?.activePlanDetails && dashboard.activePlanDetails.length > 0 ? (
                            <List disablePadding>
                                {dashboard.activePlanDetails.map((plan, i) => (
                                    <Box key={plan.id}>
                                        {i > 0 && <Divider sx={{ my: 1 }} />}
                                        <ListItem disablePadding sx={{ py: 1 }}>
                                            <ListItemText
                                                primaryTypographyProps={{ component: 'div' }}
                                                secondaryTypographyProps={{ component: 'div' }}
                                                primary={
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                        <Typography variant="subtitle2" fontWeight={700}>
                                                            {plan.planName}
                                                        </Typography>
                                                        <Chip
                                                            label={`${plan.dailyRoi}%/day`}
                                                            size="small"
                                                            sx={{ bgcolor: '#ecfdf5', color: '#10b981', fontWeight: 700, fontSize: '0.7rem' }}
                                                        />
                                                    </Box>
                                                }
                                                secondary={
                                                    <Box>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Invested: <strong>{plan.amount} USDT</strong>
                                                            </Typography>
                                                            <Typography variant="caption" color="#10b981" fontWeight={600}>
                                                                +{plan.dailyRoiAmount.toFixed(2)} USDT/day
                                                            </Typography>
                                                        </Box>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.3 }}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {(() => {
                                                                    const ms = (plan as any).msLeft || 0;
                                                                    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
                                                                    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

                                                                    if (ms <= 0) return 'Expired';
                                                                    if (days === 0) return `${hours}h left`;
                                                                    return `${days}d ${hours}h left`;
                                                                })()}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary">
                                                                Earned: {plan.totalRoiPaid.toFixed(2)} USDT
                                                            </Typography>
                                                        </Box>
                                                        {(() => {
                                                            const start = new Date(plan.startDate).getTime();
                                                            const end = new Date(plan.endDate).getTime();
                                                            const now = Date.now();

                                                            const totalMs = end - start;
                                                            const elapsedMs = now - start;

                                                            // Calculate progress precisely
                                                            const progress = totalMs > 0
                                                                ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))
                                                                : 0;

                                                            return (
                                                                <LinearProgress
                                                                    variant="determinate"
                                                                    value={progress}
                                                                    sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#10b981', borderRadius: 2 } }}
                                                                />
                                                            );
                                                        })()}
                                                    </Box>
                                                }
                                            />
                                        </ListItem>
                                    </Box>
                                ))}
                            </List>
                        ) : (
                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <Typography color="text.secondary" gutterBottom>No active subscriptions</Typography>
                                <Button
                                    variant="contained"
                                    size="small"
                                    onClick={() => router.push('/buy-tp')}
                                    sx={{ background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)', textTransform: 'none', borderRadius: 2, fontWeight: 700 }}
                                >
                                    Buy Mining Power
                                </Button>
                            </Box>
                        )
                    ) : (
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, pt: 2 }}>
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">Total Mining Power</Typography>
                                <Typography variant="h5" fontWeight={700}>{tradePower.toFixed(0)} USDT</Typography>
                            </Box>
                            <Divider orientation="vertical" flexItem />
                            <Box sx={{ textAlign: 'center' }}>
                                <Typography variant="caption" color="text.secondary">Daily Earnings</Typography>
                                <Typography variant="h5" fontWeight={700} color="#10b981">+{totalDailyEarnings.toFixed(2)} USDT</Typography>
                            </Box>
                        </Box>
                    )}
                </Box>
            </Paper>

            {/* Pending Deposits (if any) */}
            {pendingTickets.length > 0 && (
                <Card sx={{ mt: 2, borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #fef3c7' }}>
                    <Box sx={{ p: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#fffbeb', borderBottom: '1px solid #fef3c7' }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <HourglassEmptyIcon sx={{ color: '#d97706', fontSize: 18 }} />
                            <Typography variant="subtitle2" fontWeight={700} color="#92400e">Pending Deposits</Typography>
                        </Stack>
                        <Chip label={`${pendingTickets.length} Awaiting`} size="small" sx={{ bgcolor: '#fef3c7', color: '#d97706', fontWeight: 700, fontSize: '0.65rem' }} />
                    </Box>
                    <List disablePadding>
                        {pendingTickets.map((ticket, i) => (
                            <Box key={ticket.id}>
                                {i > 0 && <Divider />}
                                <ListItem sx={{ py: 1.5, px: 2 }}>
                                    <ListItemText
                                        primaryTypographyProps={{ component: 'div' }}
                                        secondaryTypographyProps={{ component: 'div' }}
                                        primary={
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.3 }}>
                                                <Typography variant="body2" fontWeight={700}>
                                                    {ticket.planName}
                                                </Typography>
                                                <Chip
                                                    label={ticket.status === 'PROCESSING' ? 'Processing' : 'Pending'}
                                                    size="small"
                                                    sx={{
                                                        bgcolor: ticket.status === 'PROCESSING' ? '#dbeafe' : '#fef3c7',
                                                        color: ticket.status === 'PROCESSING' ? '#2563eb' : '#d97706',
                                                        fontWeight: 700,
                                                        fontSize: '0.65rem'
                                                    }}
                                                />
                                            </Box>
                                        }
                                        secondary={
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    Amount: <strong>{ticket.amount} USDT</strong>
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {ticket.planDailyRoi}%/day • Awaiting admin review
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            </Box>
                        ))}
                    </List>
                </Card>
            )}

            <ReinvestModal
                open={reinvestModalOpen}
                onClose={() => setReinvestModalOpen(false)}
                onSuccess={handleReinvestSuccess}
                balance={dashboard?.walletBalance || 0}
                plans={plans}
            />

            <PromoModal
                open={promoOpen}
                onClose={handleClosePromo}
            />

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snackbar.severity} sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
