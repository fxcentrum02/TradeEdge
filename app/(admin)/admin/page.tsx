'use client';

import { useEffect, useState } from 'react';
import {
    Box, Card, CardContent, Typography, Grid, Skeleton, Chip, Divider,
    Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Avatar
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassIcon from '@mui/icons-material/HourglassTop';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { formatCurrency, formatRelativeTime } from '@/lib/utils';

interface AdminStats {
    totalUsers: number;
    activeUsers: number;
    todayNewUsers: number;
    todaySubscriptions: number;
    totalInvested: number;
    totalEarnings: number;
    totalWithdrawals: number;
    pendingWithdrawals: number;
    pendingTickets: number;
    approvedTickets: number;
    totalTicketAmount: number;
    roiPaidTotal: number;
    recentTickets: any[];
    recentUsers: any[];
}

function StatCard({
    label, value, icon, color, sub
}: {
    label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string;
}) {
    return (
        <Card
            sx={{
                borderRadius: 3,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.10)' },
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: color,
                }}
            />
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
                            <Typography variant="caption" sx={{ color: '#10b981', fontWeight: 600 }}>
                                {sub}
                            </Typography>
                        )}
                    </Box>
                    <Box
                        sx={{
                            width: 44,
                            height: 44,
                            borderRadius: 2.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `${color}18`,
                            color: color.split(' ')[0].replace('linear-gradient(135deg,', '').trim(),
                        }}
                    >
                        {icon}
                    </Box>
                </Box>
            </CardContent>
        </Card>
    );
}

export default function AdminDashboardPage() {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await fetch('/api/admin/dashboard', { credentials: 'include' });
                const data = await res.json();
                if (data.success) setStats(data.data);
            } catch (error) {
                console.error('Dashboard error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return (
            <Box>
                <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />
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

    const statCards = [
        {
            label: 'Total Users',
            value: (stats?.totalUsers || 0).toLocaleString(),
            icon: <PeopleIcon />,
            color: '#8b5cf6',
            sub: `+${stats?.todayNewUsers || 0} today`,
        },
        {
            label: 'Active Users',
            value: (stats?.activeUsers || 0).toLocaleString(),
            icon: <CheckCircleIcon />,
            color: '#10b981',
        },
        {
            label: 'Today Signups',
            value: stats?.todayNewUsers || 0,
            icon: <PersonAddIcon />,
            color: '#f59e0b',
        },
        {
            label: 'Today Activations',
            value: stats?.todaySubscriptions || 0,
            icon: <TrendingUpIcon />,
            color: '#3b82f6',
        },
        {
            label: 'Total Invested (MP)',
            value: formatCurrency(stats?.totalInvested || 0),
            icon: <ShowChartIcon />,
            color: 'var(--brand-main)',
        },
        {
            label: 'ROI Paid Out',
            value: formatCurrency(stats?.roiPaidTotal || 0),
            icon: <TrendingUpIcon />,
            color: '#06b6d4',
        },
        {
            label: 'Total Withdrawn',
            value: formatCurrency(stats?.totalWithdrawals || 0),
            icon: <AccountBalanceIcon />,
            color: '#ef4444',
        },
        {
            label: 'Pending Withdrawals',
            value: formatCurrency(stats?.pendingWithdrawals || 0),
            icon: <HourglassIcon />,
            color: '#f97316',
        },
    ];

    return (
        <Box>
            {/* Page Header */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={800} sx={{ color: '#1e293b' }}>
                    Dashboard
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </Typography>
            </Box>

            {/* Stat Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {statCards.map((card) => (
                    <Grid key={card.label} size={{ xs: 12, sm: 6, lg: 3 }}>
                        <StatCard {...card} />
                    </Grid>
                ))}
            </Grid>

            {/* Pending Tickets Alert Banner */}
            {(stats?.pendingTickets || 0) > 0 && (
                <Card
                    sx={{
                        borderRadius: 3,
                        mb: 4,
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                        border: '1px solid #fcd34d',
                        boxShadow: 'none',
                    }}
                >
                    <CardContent sx={{ py: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                        <ReceiptLongIcon sx={{ color: '#d97706', fontSize: 28 }} />
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#92400e' }}>
                                {stats?.pendingTickets} Deposit Ticket{(stats?.pendingTickets || 0) > 1 ? 's' : ''} Awaiting Review
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#b45309' }}>
                                Total pending: {formatCurrency(stats?.totalTicketAmount || 0)} USDT
                            </Typography>
                        </Box>
                        <Chip
                            label="Review Now →"
                            size="small"
                            onClick={() => window.location.href = '/admin/tickets'}
                            sx={{ bgcolor: '#d97706', color: 'white', fontWeight: 700, cursor: 'pointer' }}
                        />
                    </CardContent>
                </Card>
            )}

            {/* 2-column bottom row */}
            <Grid container spacing={3}>
                {/* Recent Deposit Tickets */}
                <Grid size={{ xs: 12, lg: 7 }}>
                    <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
                            <Typography variant="subtitle1" fontWeight={700}>Recent Deposit Tickets</Typography>
                            <Chip
                                label={`${stats?.pendingTickets || 0} pending`}
                                size="small"
                                sx={{ bgcolor: (stats?.pendingTickets || 0) > 0 ? '#fef3c7' : '#f1f5f9', color: (stats?.pendingTickets || 0) > 0 ? '#d97706' : '#64748b', fontWeight: 700 }}
                            />
                        </Box>
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b' }}>User</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b' }}>Amount</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b' }}>Status</TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b' }}>Time</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(stats?.recentTickets || []).length > 0 ? (
                                        stats!.recentTickets.map((ticket: any) => (
                                            <TableRow key={ticket._id} hover>
                                                <TableCell sx={{ py: 1.5 }}>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        {ticket.userName || 'Unknown'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ py: 1.5 }}>
                                                    <Typography variant="body2" fontWeight={700} color="#10b981">
                                                        {formatCurrency(ticket.amount)}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ py: 1.5 }}>
                                                    <Chip
                                                        label={ticket.status}
                                                        size="small"
                                                        sx={{
                                                            fontWeight: 700,
                                                            fontSize: '0.65rem',
                                                            bgcolor: ticket.status === 'PENDING' ? '#fef3c7' : ticket.status === 'APPROVED' ? '#dcfce7' : '#fee2e2',
                                                            color: ticket.status === 'PENDING' ? '#d97706' : ticket.status === 'APPROVED' ? '#16a34a' : '#dc2626',
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ py: 1.5 }}>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {formatRelativeTime(ticket.createdAt)}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                                                <Typography variant="body2" color="text.secondary">No tickets yet</Typography>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>
                </Grid>

                {/* Recent Users */}
                <Grid size={{ xs: 12, lg: 5 }}>
                    <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                        <Box sx={{ p: 2.5, borderBottom: '1px solid #f1f5f9' }}>
                            <Typography variant="subtitle1" fontWeight={700}>Recent Signups</Typography>
                        </Box>
                        <Box sx={{ p: 2 }}>
                            {(stats?.recentUsers || []).length > 0 ? (
                                stats!.recentUsers.map((user: any, i: number) => (
                                    <Box key={user._id}>
                                        {i > 0 && <Divider sx={{ my: 1 }} />}
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                                            <Avatar sx={{ width: 32, height: 32, bgcolor: '#8b5cf6', fontSize: 13, fontWeight: 700 }}>
                                                {(user.firstName || user.telegramUsername || 'U')[0].toUpperCase()}
                                            </Avatar>
                                            <Box sx={{ flex: 1 }}>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {user.firstName || user.telegramUsername || 'User'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    @{user.telegramUsername || user.telegramId}
                                                </Typography>
                                            </Box>
                                            <Typography variant="caption" color="text.secondary">
                                                {formatRelativeTime(user.createdAt)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                ))
                            ) : (
                                <Box sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography variant="body2" color="text.secondary">No users yet</Typography>
                                </Box>
                            )}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
