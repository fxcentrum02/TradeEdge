'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Box, Card, CardContent, Typography, Grid, Skeleton, Paper,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel,
    Avatar, Chip, Divider, Button, useMediaQuery, useTheme,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LayersIcon from '@mui/icons-material/Layers';
import PaidIcon from '@mui/icons-material/Paid';
import PeopleIcon from '@mui/icons-material/People';
import HourglassIcon from '@mui/icons-material/HourglassTop';
import LoopIcon from '@mui/icons-material/Loop';
import ScheduleIcon from '@mui/icons-material/Schedule';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import DownloadIcon from '@mui/icons-material/Download';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import DateRangeFilterBar from '../_components/DateRangeFilterBar';
import AdminAdvancedFilters, { FilterFieldConfig, FilterValues } from '../_components/AdminAdvancedFilters';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface AnalyticsData {
    settlementStatus: {
        isSuccess: boolean;
        lastRun: string | null;
        targetTime: string;
    };
    cards: {
        tomorrowSettlement: number;
        tomorrowSettlementCount: number;
        tomorrowPredictedReferral: number;
        plansEndingToday: number;
        totalActivePlans: number;
        roiPaid: number;
        roiPaidCount: number;
        referralEarnings: number;
        referralEarningsCount: number;
        withdrawalsPaid: number;
        withdrawalsPaidCount: number;
        pendingWithdrawals: number;
        pendingWithdrawalsCount: number;
        reinvested: number;
        reinvestedCount: number;
        totalWithdrawalFees: number;
        totalWithdrawalFeesCount: number;
    };
    chartData: { date: string; roi: number; withdrawals: number; deposits: number }[];
    recentSettlements: any[];
    tomorrowSettlements: any[];
}
const FILTER_FIELDS: FilterFieldConfig[] = [
    { field: 'minAmount', label: 'Min Settlement Amount', type: 'number' },
];

function StatCard({ label, value, icon, color, sub }: {
    label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string;
}) {
    return (
        <Card sx={{
            borderRadius: 3,
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.10)' },
            overflow: 'hidden',
            position: 'relative',
        }}>
            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
            <CardContent sx={{ pt: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={500} gutterBottom display="block">
                            {label}
                        </Typography>
                        <Typography variant="h5" fontWeight={800} sx={{ color: '#1e293b' }}>
                            {value}
                        </Typography>
                        {sub && (
                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 500 }}>
                                {sub}
                            </Typography>
                        )}
                    </Box>
                    <Box sx={{
                        width: 44, height: 44, borderRadius: 2.5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `${color}18`,
                        color: color,
                    }}>
                        {icon}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}

export default function AdminAnalyticsPage() {
    const { authFetch } = useAuth();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    // Default: last 30 days
    const [startDate, setStartDate] = useState(() => {
        return new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterValues, setFilterValues] = useState<FilterValues>({});

    // Sorting state for Tomorrow's Settlements
    const [settlementSort, setSettlementSort] = useState({ field: 'amount', order: 'desc' as 'asc' | 'desc' });
    // Sorting state for Recent Payouts
    const [payoutSort, setPayoutSort] = useState({ field: 'createdAt', order: 'desc' as 'asc' | 'desc' });

    const handleSettlementSort = (field: string) => {
        const isAsc = settlementSort.field === field && settlementSort.order === 'asc';
        setSettlementSort({ field, order: isAsc ? 'desc' : 'asc' });
    };

    const handlePayoutSort = (field: string) => {
        const isAsc = payoutSort.field === field && payoutSort.order === 'asc';
        setPayoutSort({ field, order: isAsc ? 'desc' : 'asc' });
    };

    const getSortedSettlements = () => {
        if (!data?.tomorrowSettlements) return [];
        return [...data.tomorrowSettlements].sort((a, b) => {
            const valA = a[settlementSort.field];
            const valB = b[settlementSort.field];
            if (valA < valB) return settlementSort.order === 'asc' ? -1 : 1;
            if (valA > valB) return settlementSort.order === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const getSortedPayouts = () => {
        if (!data?.recentSettlements) return [];
        return [...data.recentSettlements].sort((a, b) => {
            const valA = a[payoutSort.field];
            const valB = b[payoutSort.field];
            if (valA < valB) return payoutSort.order === 'asc' ? -1 : 1;
            if (valA > valB) return payoutSort.order === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            if (startDate) query.set('startDate', startDate);
            if (endDate) query.set('endDate', endDate);
            if (filterValues.minAmount) query.set('minAmount', String(filterValues.minAmount));

            const res = await authFetch(`/api/admin/analytics?${query.toString()}`);
            const data = await res.json();
            if (data.success) setData(data.data);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    }, [authFetch, startDate, endDate, filterValues]);

    useEffect(() => {
        fetchAnalytics();
    }, [fetchAnalytics]);

    const handleDateChange = (start: string, end: string) => {
        setStartDate(start);
        setEndDate(end);
    };

    const settlement = data?.settlementStatus;

    if (loading && !data) {
        return (
            <Box>
                <Skeleton variant="text" width={250} height={40} sx={{ mb: 1 }} />
                <Skeleton variant="rounded" height={60} sx={{ mb: 3, borderRadius: 3 }} />
                <Grid container spacing={3}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Grid key={i} size={{ xs: 12, sm: 6, lg: 3 }}>
                            <Skeleton variant="rounded" height={110} sx={{ borderRadius: 3 }} />
                        </Grid>
                    ))}
                </Grid>
            </Box>
        );
    }

    const cards = data?.cards;
    const statCards = [
        {
            label: "Tomorrow's Total Settlement",
            value: formatCurrency((cards?.tomorrowSettlement || 0) + (cards?.tomorrowPredictedReferral || 0)),
            icon: <AccountBalanceIcon />,
            color: '#10b981',
            sub: `ROI: ${formatCurrency(cards?.tomorrowSettlement || 0)} | Ref: ${formatCurrency(cards?.tomorrowPredictedReferral || 0)}`,
        },
        {
            label: "Tomorrow's ROI Settlement",
            value: formatCurrency(cards?.tomorrowSettlement || 0),
            icon: <ScheduleIcon />,
            color: '#f59e0b',
            sub: `${cards?.tomorrowSettlementCount || 0} plans to settle`,
        },
        {
            label: "Tomorrow's Referral Settlement",
            value: formatCurrency(cards?.tomorrowPredictedReferral || 0),
            icon: <PeopleIcon />,
            color: '#3b82f6',
            sub: `Predicted commissions`,
        },
        {
            label: 'Plans Ending Today',
            value: cards?.plansEndingToday || 0,
            icon: <CalendarTodayIcon />,
            color: '#ef4444',
        },
        {
            label: 'Total Active Plans',
            value: (cards?.totalActivePlans || 0).toLocaleString(),
            icon: <LayersIcon />,
            color: '#8b5cf6',
        },
        {
            label: 'ROI Paid',
            value: formatCurrency(cards?.roiPaid || 0),
            icon: <TrendingUpIcon />,
            color: '#10b981',
            sub: `${cards?.roiPaidCount || 0} payouts`,
        },
        {
            label: 'Referral Earnings Paid',
            value: formatCurrency(cards?.referralEarnings || 0),
            icon: <PeopleIcon />,
            color: '#3b82f6',
            sub: `${cards?.referralEarningsCount || 0} transactions`,
        },
        {
            label: 'Withdrawals Paid',
            value: formatCurrency(cards?.withdrawalsPaid || 0),
            icon: <AccountBalanceIcon />,
            color: '#06b6d4',
            sub: `${cards?.withdrawalsPaidCount || 0} completed`,
        },
        {
            label: 'Pending Withdrawals',
            value: formatCurrency(cards?.pendingWithdrawals || 0),
            icon: <HourglassIcon />,
            color: '#f97316',
            sub: `${cards?.pendingWithdrawalsCount || 0} pending`,
        },
        {
            label: 'Reinvested',
            value: formatCurrency(cards?.reinvested || 0),
            icon: <LoopIcon />,
            color: '#a855f7',
            sub: `${cards?.reinvestedCount || 0} reinvestments`,
        },
        {
            label: 'Total Withdrawal Fees',
            value: formatCurrency(cards?.totalWithdrawalFees || 0),
            icon: <PaidIcon />,
            color: '#059669',
            sub: `${cards?.totalWithdrawalFeesCount || 0} collected`,
        },
    ];

    const activeFilterCount = Object.values(filterValues).filter(v => v !== '' && v !== undefined).length;

    return (
        <Box sx={{ width: '100%', overflowX: 'hidden' }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={800} sx={{ color: '#1e293b' }}>
                        Analytics & Settlements
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Financial insights, ROI settlements, and comprehensive data overview
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => window.open('/api/admin/export?resource=transactions', '_blank')}
                    sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        borderColor: '#e2e8f0',
                        color: '#64748b',
                        px: 2,
                        '&:hover': { bgcolor: '#f1f5f9', borderColor: '#cbd5e1' }
                    }}
                >
                    {isMobile ? 'Export' : 'Export CSV'}
                </Button>
            </Box>

            {/* Settlement Monitor Card */}
            <Card sx={{ mb: 4, borderRadius: 4, bgcolor: settlement?.isSuccess ? '#f0fdf4' : '#fef2f2', border: `1px solid ${settlement?.isSuccess ? '#bbf7d0' : '#fecaca'}`, boxShadow: 'none' }}>
                <CardContent sx={{ py: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ bgcolor: settlement?.isSuccess ? '#10b981' : '#ef4444', color: 'white', width: 36, height: 36 }}>
                                {settlement?.isSuccess ? <CheckCircleIcon /> : <ErrorOutlineIcon />}
                            </Avatar>
                            <Box>
                                <Typography variant="subtitle2" fontWeight={700} sx={{ color: settlement?.isSuccess ? '#166534' : '#991b1b' }}>
                                    Settlement Monitor (Daily 10 AM IST)
                                </Typography>
                                <Typography variant="caption" sx={{ color: settlement?.isSuccess ? '#15803d' : '#b91c1c' }}>
                                    {settlement?.isSuccess
                                        ? `Last run: ${new Date(settlement.lastRun!).toLocaleString()}`
                                        : `Pending for target: ${new Date(settlement?.targetTime || '').toLocaleString()}`
                                    }
                                </Typography>
                            </Box>
                        </Box>
                        <Chip label={settlement?.isSuccess ? 'HEALTHY' : 'PENDING'} color={settlement?.isSuccess ? 'success' : 'error'} size="small" sx={{ fontWeight: 800, px: 1, alignSelf: { xs: 'flex-start', sm: 'center' } }} />
                    </Box>
                </CardContent>
            </Card>

            {/* Date Range Filter */}
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', sm: 'flex-start' }, gap: 2, mb: 3 }}>
                <Box sx={{ flex: 1 }}>
                    <DateRangeFilterBar startDate={startDate} endDate={endDate} onChange={handleDateChange} />
                </Box>
                <Button
                    variant="contained"
                    startIcon={<FilterAltIcon />}
                    onClick={() => setFilterOpen(true)}
                    sx={{
                        height: { sm: 54 },
                        textTransform: 'none',
                        borderRadius: 3,
                        fontWeight: 700,
                        px: 3,
                        bgcolor: activeFilterCount > 0 ? 'primary.main' : 'white',
                        color: activeFilterCount > 0 ? 'white' : 'text.primary',
                        border: '1px solid',
                        borderColor: activeFilterCount > 0 ? 'primary.main' : '#e2e8f0',
                        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                        '&:hover': {
                            bgcolor: activeFilterCount > 0 ? 'primary.dark' : '#f8fafc',
                            borderColor: activeFilterCount > 0 ? 'primary.dark' : '#cbd5e1',
                        }
                    }}
                >
                    Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                </Button>
            </Box>

            {/* Advanced Filters Dialog */}
            <AdminAdvancedFilters
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                fields={FILTER_FIELDS}
                values={filterValues}
                onApply={(v) => { setFilterValues(v); }}
                onClear={() => { setFilterValues({}); }}
            />

            {/* Stat Cards */}
            <Grid container spacing={isMobile ? 1.5 : 3} sx={{ mb: 4 }}>
                {statCards.map((card) => (
                    <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard {...card} />
                    </Grid>
                ))}
            </Grid>

            {/* Charts */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {/* Daily ROI Area Chart */}
                <Grid size={{ xs: 12, lg: 6 }}>
                    <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <Box sx={{ p: 2.5, borderBottom: '1px solid #f1f5f9' }}>
                            <Typography variant="subtitle1" fontWeight={700}>Daily ROI Settlements</Typography>
                            <Typography variant="caption" color="text.secondary">ROI paid over the selected period</Typography>
                        </Box>
                        <Box sx={{ p: 2, height: 300 }}>
                            {(data?.chartData?.length || 0) > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={data?.chartData}>
                                        <defs>
                                            <linearGradient id="roiGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                                        <Tooltip formatter={(v: any) => [`$${Number(v || 0).toFixed(2)}`, 'ROI']} labelFormatter={(l) => `Date: ${l}`} />
                                        <Area type="monotone" dataKey="roi" stroke="#10b981" fill="url(#roiGrad)" strokeWidth={2} name="ROI Paid" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                    <Typography color="text.secondary">No data for selected period</Typography>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </Grid>

                {/* Financial Overview Bar Chart */}
                <Grid size={{ xs: 12, lg: 6 }}>
                    <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <Box sx={{ p: 2.5, borderBottom: '1px solid #f1f5f9' }}>
                            <Typography variant="subtitle1" fontWeight={700}>Financial Overview</Typography>
                            <Typography variant="caption" color="text.secondary">Deposits vs Withdrawals vs ROI</Typography>
                        </Box>
                        <Box sx={{ p: 2, height: 300 }}>
                            {(data?.chartData?.length || 0) > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data?.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                                        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                                        <Tooltip formatter={(v: any) => `$${Number(v || 0).toFixed(2)}`} labelFormatter={(l) => `Date: ${l}`} />
                                        <Legend />
                                        <Bar dataKey="deposits" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Deposits" />
                                        <Bar dataKey="withdrawals" fill="#ef4444" radius={[4, 4, 0, 0]} name="Withdrawals" />
                                        <Bar dataKey="roi" fill="#10b981" radius={[4, 4, 0, 0]} name="ROI" />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                                    <Typography color="text.secondary">No data for selected period</Typography>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>

            {/* Tables */}
            <Grid container spacing={isMobile ? 2 : 3}>
                {/* Tomorrow's Settlements */}
                <Grid size={{ xs: 12, lg: 7 }}>
                    <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                            <Box>
                                <Typography variant="subtitle1" fontWeight={700}>Tomorrow's Settlements</Typography>
                                <Typography variant="caption" color="text.secondary">Plans that will receive ROI payout tomorrow</Typography>
                            </Box>
                            <Chip
                                label={`${data?.tomorrowSettlements?.length || 0} plans`}
                                size="small"
                                sx={{ bgcolor: '#fef3c7', color: '#d97706', fontWeight: 700 }}
                            />
                        </Box>
                        <TableContainer sx={{ maxHeight: 400, overflowX: 'auto' }}>
                            <Table size="small" stickyHeader sx={{ minWidth: isMobile ? 500 : 'auto' }}>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b' }}>
                                            <TableSortLabel
                                                active={settlementSort.field === 'userName'}
                                                direction={settlementSort.field === 'userName' ? settlementSort.order : 'asc'}
                                                onClick={() => handleSettlementSort('userName')}
                                            >
                                                User
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b' }}>
                                            <TableSortLabel
                                                active={settlementSort.field === 'planName'}
                                                direction={settlementSort.field === 'planName' ? settlementSort.order : 'asc'}
                                                onClick={() => handleSettlementSort('planName')}
                                            >
                                                Plan
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b' }}>
                                            <TableSortLabel
                                                active={settlementSort.field === 'amount'}
                                                direction={settlementSort.field === 'amount' ? settlementSort.order : 'asc'}
                                                onClick={() => handleSettlementSort('amount')}
                                            >
                                                Investment
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b' }}>
                                            <TableSortLabel
                                                active={settlementSort.field === 'roiAmount'}
                                                direction={settlementSort.field === 'roiAmount' ? settlementSort.order : 'asc'}
                                                onClick={() => handleSettlementSort('roiAmount')}
                                            >
                                                ROI/Day
                                            </TableSortLabel>
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b' }}>
                                            <TableSortLabel
                                                active={settlementSort.field === 'endDate'}
                                                direction={settlementSort.field === 'endDate' ? settlementSort.order : 'asc'}
                                                onClick={() => handleSettlementSort('endDate')}
                                            >
                                                Ends
                                            </TableSortLabel>
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {getSortedSettlements().length > 0 ? (
                                        getSortedSettlements().map((item: any) => (
                                            <TableRow key={item._id} hover>
                                                <TableCell sx={{ py: 1.5 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Avatar sx={{ width: 28, height: 28, bgcolor: '#8b5cf6', fontSize: 11, fontWeight: 700 }}>
                                                            {(item.userName || 'U')[0].toUpperCase()}
                                                        </Avatar>
                                                        <Box>
                                                            <Typography variant="body2" fontWeight={600} fontSize="0.8rem">{item.userName}</Typography>
                                                            {item.telegramUsername && (
                                                                <Typography variant="caption" color="text.secondary" fontSize="0.65rem">@{item.telegramUsername}</Typography>
                                                            )}
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ py: 1.5 }}>
                                                    <Typography variant="body2" fontWeight={600} fontSize="0.8rem">{item.planName}</Typography>
                                                    <Typography variant="caption" color="#10b981">{item.dailyRoi}%/day</Typography>
                                                </TableCell>
                                                <TableCell sx={{ py: 1.5 }}>
                                                    <Typography variant="body2" fontWeight={700} fontSize="0.8rem">{formatCurrency(item.amount)}</Typography>
                                                </TableCell>
                                                <TableCell sx={{ py: 1.5 }}>
                                                    <Typography variant="body2" fontWeight={700} color="#10b981" fontSize="0.8rem">
                                                        +{formatCurrency(item.roiAmount)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ py: 1.5 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {new Date(item.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                                <Typography variant="body2" color="text.secondary">No settlements scheduled</Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>

                {/* Recent ROI Settlements */}
                <Grid size={{ xs: 12, lg: 5 }}>
                    <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <Box sx={{ p: 2.5, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography variant="subtitle1" fontWeight={700}>Recent ROI Payouts</Typography>
                                <Typography variant="caption" color="text.secondary">Latest ROI earnings credited</Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <TableSortLabel
                                    active={payoutSort.field === 'amount'}
                                    direction={payoutSort.field === 'amount' ? payoutSort.order : 'asc'}
                                    onClick={() => handlePayoutSort('amount')}
                                    sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}
                                >
                                    Amount
                                </TableSortLabel>
                                <TableSortLabel
                                    active={payoutSort.field === 'createdAt'}
                                    direction={payoutSort.field === 'createdAt' ? payoutSort.order : 'asc'}
                                    onClick={() => handlePayoutSort('createdAt')}
                                    sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}
                                >
                                    Time
                                </TableSortLabel>
                            </Box>
                        </Box>
                        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
                            {getSortedPayouts().length > 0 ? (
                                getSortedPayouts().map((item: any, i: number) => (
                                    <Box key={item._id}>
                                        {i > 0 && <Divider />}
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5 }}>
                                            <Avatar sx={{ width: 30, height: 30, bgcolor: '#10b981', fontSize: 11, fontWeight: 700 }}>
                                                {(item.userName || 'U')[0].toUpperCase()}
                                            </Avatar>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography variant="body2" fontWeight={600} fontSize="0.8rem" noWrap>
                                                    {item.userName}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" fontSize="0.65rem" noWrap>
                                                    {item.description}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ textAlign: 'right', flexShrink: 0, ml: 1 }}>
                                                <Typography variant="body2" fontWeight={700} color="#10b981" fontSize="0.8rem">
                                                    +{formatCurrency(item.amount)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary" fontSize="0.6rem">
                                                    {formatRelativeTime(item.createdAt)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                ))
                            ) : (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography variant="body2" color="text.secondary">No payouts yet</Typography>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
