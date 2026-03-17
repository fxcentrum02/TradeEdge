'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, Button, Skeleton, Alert, Avatar, Tabs, Tab,
    Snackbar, Card, CardContent, Stack, IconButton, useMediaQuery, useTheme,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import DownloadIcon from '@mui/icons-material/Download';
import { formatCurrency, formatDateTime, truncateAddress } from '@/lib/utils';
import DateRangeFilterBar from '../_components/DateRangeFilterBar';
import AdminAdvancedFilters, { FilterFieldConfig, FilterValues } from '../_components/AdminAdvancedFilters';
import TicketDetailsPopup from '../_components/TicketDetailsPopup';
import { pusherClient } from '@/lib/pusher-client';

interface Withdrawal {
    id: string;
    userId: string;
    amount: number;
    fee: number;
    netAmount: number;
    walletAddress: string;
    network: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED';
    adminNote?: string;
    txHash?: string;
    processedAt?: string;
    createdAt: string;
    userName?: string;
    telegramUsername?: string;
}

const STATUS_STYLES: Record<string, { bgcolor: string; color: string; label: string }> = {
    PENDING: { bgcolor: '#fef3c7', color: '#d97706', label: 'Pending' },
    PROCESSING: { bgcolor: '#dbeafe', color: '#2563eb', label: 'Processing' },
    COMPLETED: { bgcolor: '#dcfce7', color: '#16a34a', label: 'Completed' },
    REJECTED: { bgcolor: '#fee2e2', color: '#dc2626', label: 'Rejected' },
    FAILED: { bgcolor: '#fce7f3', color: '#db2777', label: 'Failed' },
};

const FILTER_FIELDS: FilterFieldConfig[] = [
    { field: 'amountMin', label: 'Min Amount', type: 'number' },
    { field: 'amountMax', label: 'Max Amount', type: 'number' },
];

export default function AdminWithdrawalsPage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'PENDING' | 'ALL'>('PENDING');

    const [detailsPopup, setDetailsPopup] = useState<{ open: boolean; ticket: Withdrawal | null }>({ open: false, ticket: null });
    const [submitting, setSubmitting] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterValues, setFilterValues] = useState<FilterValues>({});

    const fetchWithdrawals = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '50' });
            if (tab === 'PENDING') params.set('status', 'PENDING');
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);
            if (filterValues.amountMin) params.set('amountMin', String(filterValues.amountMin));
            if (filterValues.amountMax) params.set('amountMax', String(filterValues.amountMax));
            const res = await fetch(`/api/admin/withdrawals?${params}`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) setWithdrawals(data.data.items || []);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [tab, startDate, endDate, filterValues]);

    useEffect(() => {
        fetchWithdrawals();
        const channel = pusherClient.subscribe('admin-notifications');
        channel.bind('new-withdrawal', () => fetchWithdrawals());
        return () => { pusherClient.unsubscribe('admin-notifications'); };
    }, [fetchWithdrawals]);

    const handleApprove = async (id: string, adminNote: string, txHash?: string) => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/withdrawals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ withdrawalId: id, action: 'approve', txHash, adminNote }),
                credentials: 'include',
            });
            const data = await res.json();
            if (data.success) {
                setSnackbar({ open: true, message: data.message || 'Withdrawal approved!', severity: 'success' });
                fetchWithdrawals();
            } else {
                setSnackbar({ open: true, message: data.error || 'Approval failed', severity: 'error' });
            }
        } catch {
            setSnackbar({ open: true, message: 'Network error', severity: 'error' });
        } finally { setSubmitting(false); }
    };

    const handleReject = async (id: string, adminNote: string) => {
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/withdrawals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ withdrawalId: id, action: 'reject', adminNote }),
                credentials: 'include',
            });
            const data = await res.json();
            if (data.success) {
                setSnackbar({ open: true, message: data.message || 'Withdrawal rejected!', severity: 'success' });
                fetchWithdrawals();
            } else {
                setSnackbar({ open: true, message: data.error || 'Rejection failed', severity: 'error' });
            }
        } catch {
            setSnackbar({ open: true, message: 'Network error', severity: 'error' });
        } finally { setSubmitting(false); }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setSnackbar({ open: true, message: 'Copied!', severity: 'success' });
    };

    const pendingCount = withdrawals.filter(w => w.status === 'PENDING').length;
    const activeFilterCount = Object.values(filterValues).filter(v => v !== '' && v !== undefined).length + (startDate ? 1 : 0);

    return (
        <Box>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                        <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={800} sx={{ color: '#1e293b' }}>
                            Withdrawals
                        </Typography>
                        {pendingCount > 0 && (
                            <Chip label={`${pendingCount} Pending`} sx={{ bgcolor: '#fef3c7', color: '#d97706', fontWeight: 700 }} />
                        )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        Manage user withdrawal requests and process payments
                    </Typography>
                </Box>
                <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={() => window.open('/api/admin/export?resource=withdrawals', '_blank')}
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

            {/* Date Range Filter */}
            <DateRangeFilterBar startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />

            {/* Tabs + Filters */}
            <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f1f5f9', px: 2 }}>
                    <Tabs
                        value={tab}
                        onChange={(_, v) => setTab(v)}
                        sx={{
                            flex: 1,
                            '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 52, fontSize: { xs: '0.78rem', sm: '0.875rem' } },
                            '& .Mui-selected': { color: 'var(--brand-main) !important' },
                            '& .MuiTabs-indicator': { bgcolor: 'var(--brand-main)' },
                        }}
                    >
                        <Tab value="PENDING" label={`Pending (${pendingCount})`} />
                        <Tab value="ALL" label="All" />
                    </Tabs>
                    <Button
                        size="small"
                        startIcon={<FilterAltIcon />}
                        onClick={() => setFilterOpen(true)}
                        sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, color: activeFilterCount > 0 ? 'primary.main' : 'text.secondary', whiteSpace: 'nowrap' }}
                    >
                        {isMobile ? '' : 'Filters'}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                    </Button>
                </Box>

                {/* — MOBILE CARD LIST — */}
                {isMobile ? (
                    <Box sx={{ p: 1.5 }}>
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <Skeleton key={i} variant="rounded" height={110} sx={{ mb: 1.5, borderRadius: 2 }} />
                            ))
                        ) : withdrawals.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 5 }}>
                                <Typography color="text.secondary">{tab === 'PENDING' ? 'No pending withdrawals 🎉' : 'No withdrawals found'}</Typography>
                            </Box>
                        ) : (
                            withdrawals.map((w) => {
                                const statusStyle = STATUS_STYLES[w.status] || STATUS_STYLES.PENDING;
                                return (
                                    <Card key={w.id} sx={{ mb: 1.5, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer' }} onClick={() => setDetailsPopup({ open: true, ticket: w })}>
                                        <CardContent sx={{ p: '12px !important' }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#3b82f6', fontSize: 12, fontWeight: 700 }}>
                                                        {(w.userName || 'U')[0].toUpperCase()}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={700} lineHeight={1.2}>{w.userName || 'Unknown'}</Typography>
                                                        {w.telegramUsername && <Typography variant="caption" color="text.secondary">@{w.telegramUsername}</Typography>}
                                                    </Box>
                                                </Box>
                                                <Chip label={statusStyle.label} size="small" sx={{ bgcolor: statusStyle.bgcolor, color: statusStyle.color, fontWeight: 700, fontSize: '0.65rem' }} />
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between" sx={{ mt: 1.5 }}>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary">Gross</Typography>
                                                    <Typography variant="body2" fontWeight={700}>{formatCurrency(w.amount)}</Typography>
                                                </Box>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="caption" color="text.secondary">Fee</Typography>
                                                    <Typography variant="body2" color="error.main" fontWeight={600}>{formatCurrency(w.fee)}</Typography>
                                                </Box>
                                                <Box sx={{ textAlign: 'right' }}>
                                                    <Typography variant="caption" color="text.secondary">Net</Typography>
                                                    <Typography variant="body2" fontWeight={700} color="#10b981">{formatCurrency(w.netAmount)}</Typography>
                                                </Box>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                                    {truncateAddress(w.walletAddress)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">{formatDateTime(w.createdAt)}</Typography>
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </Box>
                ) : (
                    /* — DESKTOP TABLE — */
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>User</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Amount</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Net</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Wallet</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Network</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Status</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Requested</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }} align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            {Array.from({ length: 8 }).map((_, j) => (<TableCell key={j}><Skeleton /></TableCell>))}
                                        </TableRow>
                                    ))
                                ) : withdrawals.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                                            <Typography color="text.secondary">{tab === 'PENDING' ? 'No pending withdrawals 🎉' : 'No withdrawals found'}</Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    withdrawals.map((w) => {
                                        const statusStyle = STATUS_STYLES[w.status] || STATUS_STYLES.PENDING;
                                        return (
                                            <TableRow key={w.id} hover onClick={() => setDetailsPopup({ open: true, ticket: w })} sx={{ '&:last-child td': { border: 0 }, cursor: 'pointer' }}>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Avatar sx={{ width: 30, height: 30, bgcolor: '#3b82f6', fontSize: 12, fontWeight: 700 }}>
                                                            {(w.userName || 'U')[0].toUpperCase()}
                                                        </Avatar>
                                                        <Box>
                                                            <Typography variant="body2" fontWeight={600}>{w.userName || 'Unknown'}</Typography>
                                                            {w.telegramUsername && <Typography variant="caption" color="text.secondary">@{w.telegramUsername}</Typography>}
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Typography fontWeight={700}>{formatCurrency(w.amount)}</Typography>
                                                    <Typography variant="caption" color="text.secondary">Fee: {formatCurrency(w.fee)}</Typography>
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Typography fontWeight={700} color="#10b981">{formatCurrency(w.netAmount)}</Typography>
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 140 }}>
                                                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#64748b' }}>{truncateAddress(w.walletAddress)}</Typography>
                                                        <Box onClick={(e) => { e.stopPropagation(); copyToClipboard(w.walletAddress); }} sx={{ cursor: 'pointer', color: '#94a3b8', '&:hover': { color: '#3b82f6' } }}>
                                                            <ContentCopyIcon sx={{ fontSize: 14 }} />
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Chip label={w.network || 'BEP20'} size="small" sx={{ fontSize: '0.65rem', fontWeight: 600 }} />
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Chip label={statusStyle.label} size="small" sx={{ bgcolor: statusStyle.bgcolor, color: statusStyle.color, fontWeight: 700, fontSize: '0.7rem' }} />
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Typography variant="caption" color="text.secondary">{formatDateTime(w.createdAt)}</Typography>
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }} align="right">
                                                    {w.status === 'PENDING' ? (
                                                        <Button variant="contained" size="small" onClick={(e) => { e.stopPropagation(); setDetailsPopup({ open: true, ticket: w }); }} sx={{ bgcolor: 'var(--brand-main)', textTransform: 'none', borderRadius: 2, fontWeight: 600 }}>
                                                            Details
                                                        </Button>
                                                    ) : w.txHash ? (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                                                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#64748b' }}>{truncateAddress(w.txHash)}</Typography>
                                                            <Box onClick={(e) => { e.stopPropagation(); copyToClipboard(w.txHash || ''); }} sx={{ cursor: 'pointer', color: '#94a3b8', '&:hover': { color: '#3b82f6' } }}>
                                                                <ContentCopyIcon sx={{ fontSize: 14 }} />
                                                            </Box>
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary">{w.adminNote || '—'}</Typography>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Paper>

            <TicketDetailsPopup open={detailsPopup.open} onClose={() => setDetailsPopup({ open: false, ticket: null })} ticket={detailsPopup.ticket} type="withdrawal" onApprove={handleApprove} onReject={handleReject} />
            <AdminAdvancedFilters open={filterOpen} onClose={() => setFilterOpen(false)} fields={FILTER_FIELDS} values={filterValues} onApply={setFilterValues} onClear={() => setFilterValues({})} />

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ borderRadius: 2 }}>{snackbar.message}</Alert>
            </Snackbar>
        </Box>
    );
}
