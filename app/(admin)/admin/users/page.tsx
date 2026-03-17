'use client';

import { useEffect, useState, useCallback, useId } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, TextField, Skeleton, Avatar,
    TablePagination, Button, InputAdornment, Card, CardContent, Stack,
    useMediaQuery, useTheme, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import DownloadIcon from '@mui/icons-material/Download';
import { formatCurrency, formatRelativeTime, getInitials } from '@/lib/utils';
import DateRangeFilterBar from '../_components/DateRangeFilterBar';
import AdminAdvancedFilters, { FilterFieldConfig, FilterValues } from '../_components/AdminAdvancedFilters';
import UserDetailsPopup from './_components/UserDetailsPopup';

interface AdminUser {
    id: string;
    firstName: string | null;
    lastName: string | null;
    telegramUsername: string | null;
    photoUrl: string | null;
    referralCode: string;
    isActive: boolean;
    walletBalance: number;
    tradePower: number;
    activePlanCount: number;
    directReferralCount: number;
    totalReferralCount: number;
    totalDownlineCount: number;
    totalInvestment: number;
    totalEarnings: number;
    isAdmin: boolean;
    createdAt: string;
}

const FILTER_FIELDS: FilterFieldConfig[] = [
    { field: 'isActive', label: 'Status', type: 'select', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] },
    { field: 'isAdmin', label: 'Role', type: 'select', options: [{ value: 'true', label: 'Admin' }, { value: 'false', label: 'User' }] },
    { field: 'hasReferrer', label: 'Has Referrer', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
    { field: 'minBalance', label: 'Min Balance', type: 'number' },
    { field: 'maxBalance', label: 'Max Balance', type: 'number' },
    { field: 'minTradePower', label: 'Min Mining Power', type: 'number' },
    { field: 'minReferrals', label: 'Min Referrals', type: 'number' },
    { field: 'minEarnings', label: 'Min Earnings', type: 'number' },
    { field: 'maxEarnings', label: 'Max Earnings', type: 'number' },
    { field: 'minTotalInvestment', label: 'Min Total Invested', type: 'number' },
    { field: 'minActivePlans', label: 'Min Active Plans', type: 'number' },
    { field: 'sortBy', label: 'Sort By', type: 'select', options: [{ value: 'createdAt', label: 'Joined Date' }, { value: 'tradePower', label: 'Mining Power' }, { value: 'totalEarnings', label: 'Total Earnings' }, { value: 'totalReferralCount', label: 'Referrals Count' }, { value: 'walletBalance', label: 'Wallet Balance' }] },
    { field: 'sortOrder', label: 'Sort Order', type: 'select', options: [{ value: 'desc', label: 'Descending' }, { value: 'asc', label: 'Ascending' }] },
];

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function AdminUsersPage() {
    const id = useId();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const limit = 20;

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterValues, setFilterValues] = useState<FilterValues>({});

    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const handleOpenDetails = (userId: string) => {
        setSelectedUserId(userId);
        setDetailsOpen(true);
    };

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page + 1), limit: String(limit) });
            if (search) params.set('search', search);
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);
            if (filterValues.isActive) params.set('isActive', String(filterValues.isActive));
            if (filterValues.isAdmin) params.set('isAdmin', String(filterValues.isAdmin));
            if (filterValues.minTradePower) params.set('minTradePower', String(filterValues.minTradePower));
            if (filterValues.minBalance) params.set('minBalance', String(filterValues.minBalance));
            if (filterValues.maxBalance) params.set('maxBalance', String(filterValues.maxBalance));
            if (filterValues.minReferrals) params.set('minReferrals', String(filterValues.minReferrals));
            if (filterValues.minEarnings) params.set('minEarnings', String(filterValues.minEarnings));
            if (filterValues.maxEarnings) params.set('maxEarnings', String(filterValues.maxEarnings));
            if (filterValues.minActivePlans) params.set('minActivePlans', String(filterValues.minActivePlans));
            if (filterValues.hasReferrer) params.set('hasReferrer', String(filterValues.hasReferrer));
            if (filterValues.sortBy) params.set('sortBy', String(filterValues.sortBy));
            if (filterValues.sortOrder) params.set('sortOrder', String(filterValues.sortOrder));
            const res = await fetch(`/api/admin/users?${params}`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                setUsers(data.data.items || []);
                setTotal(data.data.total || 0);
            }
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [page, search, startDate, endDate, filterValues]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const activeFilterCount = Object.values(filterValues).filter(v => v !== '' && v !== undefined).length + (startDate ? 1 : 0);

    return (
        <Box>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={800} sx={{ color: '#1e293b' }}>Users</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{total} registered users</Typography>
                </Box>
                <Button
                    variant="outlined"
                    startIcon={<DownloadIcon />}
                    onClick={() => window.open('/api/admin/export?resource=users', '_blank')}
                    sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                        borderColor: '#e2e8f0',
                        color: '#64748b',
                        '&:hover': { bgcolor: '#f1f5f9', borderColor: '#cbd5e1' }
                    }}
                >
                    {isMobile ? 'Export' : 'Export CSV'}
                </Button>
            </Box>

            <DateRangeFilterBar startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); setPage(0); }} />

            <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                {/* Search & Filter Bar */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, borderBottom: '1px solid #f1f5f9' }}>
                    <TextField
                        id={id}
                        size="small"
                        placeholder={isMobile ? 'Search users...' : 'Search by name, username, referral code...'}
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8' }} /></InputAdornment> } }}
                        sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#f8fafc' } }}
                    />
                    <Button
                        size="small"
                        startIcon={<FilterAltIcon />}
                        onClick={() => setFilterOpen(true)}
                        sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, color: activeFilterCount > 0 ? 'primary.main' : 'text.secondary', whiteSpace: 'nowrap' }}
                    >
                        {isMobile ? '' : 'Filters'}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                    </Button>
                </Box>

                {/* MOBILE CARD LIST */}
                {isMobile ? (
                    <Box sx={{ p: 1.5 }}>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} variant="rounded" height={120} sx={{ mb: 1.5, borderRadius: 2 }} />)
                        ) : users.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 5 }}><Typography color="text.secondary">No users found</Typography></Box>
                        ) : (
                            users.map((user, idx) => (
                                <Card key={user.id} sx={{ mb: 1.5, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.05)', cursor: 'pointer', '&:active': { bgcolor: '#f8fafc' } }} onClick={() => handleOpenDetails(user.id)}>
                                    <CardContent sx={{ p: '12px !important' }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Avatar 
                                                    src={user.photoUrl || undefined}
                                                    sx={{ width: 36, height: 36, bgcolor: COLORS[idx % COLORS.length], fontSize: 13, fontWeight: 700 }}
                                                >
                                                    {getInitials(user.firstName || user.telegramUsername || 'U')}
                                                </Avatar>
                                                <Box>
                                                    <Typography variant="body2" fontWeight={700} lineHeight={1.2}>
                                                        {user.firstName || user.telegramUsername || 'Unknown'}
                                                    </Typography>
                                                    {user.telegramUsername && <Typography variant="caption" color="text.secondary">@{user.telegramUsername}</Typography>}
                                                </Box>
                                            </Box>
                                            <Stack direction="row" spacing={0.5} alignItems="center">
                                                <Chip label={user.isAdmin ? 'Admin' : 'User'} size="small" sx={{ bgcolor: user.isAdmin ? '#dbeafe' : '#f1f5f9', color: user.isAdmin ? '#2563eb' : '#64748b', fontWeight: 700, fontSize: '0.65rem' }} />
                                                {!user.isActive && <Chip label="Inactive" size="small" sx={{ bgcolor: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: '0.65rem' }} />}
                                            </Stack>
                                        </Stack>
                                        <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5 }}>
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">Balance</Typography>
                                                <Typography variant="body2" fontWeight={700}>{formatCurrency(user.walletBalance)}</Typography>
                                            </Box>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="caption" color="text.secondary">Mining Power</Typography>
                                                <Typography variant="body2" fontWeight={700} color={user.tradePower > 0 ? '#10b981' : 'text.secondary'}>{formatCurrency(user.tradePower)}</Typography>
                                            </Box>
                                            <Box sx={{ textAlign: 'right' }}>
                                                <Typography variant="caption" color="text.secondary">Referrals</Typography>
                                                <Typography variant="body2" fontWeight={600}>{user.directReferralCount} direct</Typography>
                                            </Box>
                                        </Stack>
                                        <Divider sx={{ my: 1 }} />
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="caption" color="text.secondary">Invested: <strong>{formatCurrency(user.totalInvestment)}</strong></Typography>
                                            <Typography variant="caption" color="#f59e0b" fontWeight={600}>Earned: {formatCurrency(user.totalEarnings)}</Typography>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                        <TablePagination
                            component="div"
                            count={total}
                            page={page}
                            onPageChange={(_, newPage) => setPage(newPage)}
                            rowsPerPage={limit}
                            rowsPerPageOptions={[20]}
                            sx={{ borderTop: '1px solid #f1f5f9' }}
                        />
                    </Box>
                ) : (
                    /* DESKTOP TABLE */
                    <>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                        <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem', minWidth: 180 }}>User</TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Referral Code</TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem', minWidth: 100 }}>Balance</TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem', minWidth: 120 }}>Mining Power</TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem', minWidth: 120 }}>Total Invested</TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem', minWidth: 120 }}>Referrals</TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem', minWidth: 100 }}>Earnings</TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem', minWidth: 90 }}>Role</TableCell>
                                        <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem', minWidth: 100 }}>Joined</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
                                        ))
                                    ) : users.length === 0 ? (
                                        <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6 }}><Typography color="text.secondary">No users found</Typography></TableCell></TableRow>
                                    ) : (
                                        users.map((user, idx) => (
                                            <TableRow key={user.id} hover sx={{ '&:last-child td': { border: 0 }, cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }} onClick={() => handleOpenDetails(user.id)}>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Avatar 
                                                            src={user.photoUrl || undefined}
                                                            sx={{ width: 32, height: 32, fontSize: 12, fontWeight: 700, bgcolor: COLORS[idx % COLORS.length] }}
                                                        >
                                                            {getInitials(user.firstName || user.telegramUsername || 'U')}
                                                        </Avatar>
                                                        <Box>
                                                            <Typography variant="body2" fontWeight={600}>{user.firstName || user.telegramUsername || 'Unknown'}</Typography>
                                                            {user.telegramUsername && <Typography variant="caption" color="text.secondary">@{user.telegramUsername}</Typography>}
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }}><Chip label={user.referralCode} size="small" sx={{ fontFamily: 'monospace', fontWeight: 600 }} /></TableCell>
                                                <TableCell sx={{ py: 2 }}><Typography variant="body2" fontWeight={700}>{formatCurrency(user.walletBalance)}</Typography></TableCell>
                                                <TableCell sx={{ py: 2 }}><Typography variant="body2" fontWeight={700} color={user.tradePower > 0 ? '#10b981' : 'text.secondary'}>{formatCurrency(user.tradePower)}</Typography></TableCell>
                                                <TableCell sx={{ py: 2 }}><Typography variant="body2" fontWeight={700}>{formatCurrency(user.totalInvestment)}</Typography></TableCell>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Typography variant="body2" fontWeight={600}>{user.directReferralCount} direct</Typography>
                                                    <Typography variant="caption" color="text.secondary">{user.totalDownlineCount || user.totalReferralCount} total</Typography>
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }}><Typography variant="body2" fontWeight={700} color="#f59e0b">{formatCurrency(user.totalEarnings)}</Typography></TableCell>
                                                <TableCell sx={{ py: 2 }}><Chip label={user.isAdmin ? 'Admin' : 'User'} size="small" sx={{ bgcolor: user.isAdmin ? '#dbeafe' : '#f1f5f9', color: user.isAdmin ? '#2563eb' : '#64748b', fontWeight: 700, fontSize: '0.7rem' }} /></TableCell>
                                                <TableCell sx={{ py: 2 }}><Typography variant="caption" color="text.secondary">{formatRelativeTime(user.createdAt)}</Typography></TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination component="div" count={total} page={page} onPageChange={(_, newPage) => setPage(newPage)} rowsPerPage={limit} rowsPerPageOptions={[20]} sx={{ borderTop: '1px solid #f1f5f9' }} />
                    </>
                )}
            </Paper>

            <AdminAdvancedFilters open={filterOpen} onClose={() => setFilterOpen(false)} fields={FILTER_FIELDS} values={filterValues} onApply={(v) => { setFilterValues(v); setPage(0); }} onClear={() => { setFilterValues({}); setPage(0); }} />
            <UserDetailsPopup open={detailsOpen} onClose={() => setDetailsOpen(false)} userId={selectedUserId} />
        </Box>
    );
}
