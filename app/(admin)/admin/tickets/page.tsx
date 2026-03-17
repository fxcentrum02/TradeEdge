'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, Button, Skeleton, Alert, Avatar, Tabs, Tab,
    Snackbar, Card, CardContent, Stack, useMediaQuery, useTheme,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import DateRangeFilterBar from '../_components/DateRangeFilterBar';
import AdminAdvancedFilters, { FilterFieldConfig, FilterValues } from '../_components/AdminAdvancedFilters';
import TicketDetailsPopup from '../_components/TicketDetailsPopup';
import { pusherClient } from '@/lib/pusher-client';

interface Ticket {
    id: string;
    userId: string;
    planId: string;
    amount: number;
    transactionId: string;
    paymentAddress: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    adminNote?: string;
    createdAt: string;
    userName?: string;
    telegramUsername?: string;
    planName?: string;
    planDailyRoi?: number;
}

const STATUS_STYLES = {
    PENDING: { bgcolor: '#fef3c7', color: '#d97706', label: 'Pending' },
    APPROVED: { bgcolor: '#dcfce7', color: '#16a34a', label: 'Approved' },
    REJECTED: { bgcolor: '#fee2e2', color: '#dc2626', label: 'Rejected' },
};

const FILTER_FIELDS: FilterFieldConfig[] = [
    { field: 'amountMin', label: 'Min Amount', type: 'number' },
    { field: 'amountMax', label: 'Max Amount', type: 'number' },
];

export default function AdminTicketsPage() {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));

    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'PENDING' | 'ALL'>('PENDING');
    const [detailsPopup, setDetailsPopup] = useState<{ open: boolean; ticket: Ticket | null }>({ open: false, ticket: null });
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterValues, setFilterValues] = useState<FilterValues>({});

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '50' });
            if (tab === 'PENDING') params.set('status', 'PENDING');
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);
            if (filterValues.amountMin) params.set('amountMin', String(filterValues.amountMin));
            if (filterValues.amountMax) params.set('amountMax', String(filterValues.amountMax));
            const res = await fetch(`/api/admin/tickets?${params}`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) setTickets(data.data.items || []);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, [tab, startDate, endDate, filterValues]);

    useEffect(() => {
        fetchTickets();
        const channel = pusherClient.subscribe('admin-notifications');
        channel.bind('new-ticket', () => fetchTickets());
        return () => { pusherClient.unsubscribe('admin-notifications'); };
    }, [fetchTickets]);

    const handleApprove = async (id: string, adminNote: string, _txHash?: string, backdateRoi?: boolean) => {
        try {
            const res = await fetch(`/api/admin/tickets/${id}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminNote, backdateRoi: backdateRoi ?? false }),
                credentials: 'include',
            });
            const data = await res.json();
            if (data.success) {
                setSnackbar({ open: true, message: data.message || 'Ticket approved!', severity: 'success' });
                fetchTickets();
            } else {
                setSnackbar({ open: true, message: data.error || 'Approval failed', severity: 'error' });
            }
        } catch {
            setSnackbar({ open: true, message: 'Network error', severity: 'error' });
        }
    };

    const handleReject = async (id: string, adminNote: string) => {
        try {
            const res = await fetch(`/api/admin/tickets/${id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ adminNote }),
                credentials: 'include',
            });
            const data = await res.json();
            if (data.success) {
                setSnackbar({ open: true, message: data.message || 'Ticket rejected!', severity: 'success' });
                fetchTickets();
            } else {
                setSnackbar({ open: true, message: data.error || 'Rejection failed', severity: 'error' });
            }
        } catch {
            setSnackbar({ open: true, message: 'Network error', severity: 'error' });
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setSnackbar({ open: true, message: 'Copied!', severity: 'success' });
    };

    const pendingCount = tickets.filter(t => t.status === 'PENDING').length;
    const activeFilterCount = Object.values(filterValues).filter(v => v !== '' && v !== undefined).length + (startDate ? 1 : 0);

    return (
        <Box>
            <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Typography variant={isMobile ? 'h5' : 'h4'} fontWeight={800} sx={{ color: '#1e293b' }}>
                        Deposit Tickets
                    </Typography>
                    {pendingCount > 0 && <Chip label={`${pendingCount} Pending`} sx={{ bgcolor: '#fef3c7', color: '#d97706', fontWeight: 700 }} />}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Review user payment submissions and activate their Mining Power
                </Typography>
            </Box>

            <DateRangeFilterBar startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />

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
                        <Tab value="ALL" label="All Tickets" />
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

                {/* MOBILE CARD LIST */}
                {isMobile ? (
                    <Box sx={{ p: 1.5 }}>
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} variant="rounded" height={110} sx={{ mb: 1.5, borderRadius: 2 }} />)
                        ) : tickets.length === 0 ? (
                            <Box sx={{ textAlign: 'center', py: 5 }}>
                                <Typography color="text.secondary">{tab === 'PENDING' ? 'No pending tickets 🎉' : 'No tickets found'}</Typography>
                            </Box>
                        ) : (
                            tickets.map((ticket) => {
                                const statusStyle = STATUS_STYLES[ticket.status];
                                return (
                                    <Card key={ticket.id} sx={{ mb: 1.5, borderRadius: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', cursor: 'pointer', borderLeft: `3px solid ${statusStyle.color}` }} onClick={() => setDetailsPopup({ open: true, ticket })}>
                                        <CardContent sx={{ p: '12px !important' }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#8b5cf6', fontSize: 12, fontWeight: 700 }}>
                                                        {(ticket.userName || 'U')[0].toUpperCase()}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight={700} lineHeight={1.2}>{ticket.userName || 'Unknown'}</Typography>
                                                        {ticket.telegramUsername && <Typography variant="caption" color="text.secondary">@{ticket.telegramUsername}</Typography>}
                                                    </Box>
                                                </Box>
                                                <Chip label={statusStyle.label} size="small" sx={{ bgcolor: statusStyle.bgcolor, color: statusStyle.color, fontWeight: 700, fontSize: '0.65rem' }} />
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary">Amount</Typography>
                                                    <Typography variant="body2" fontWeight={700} color="#10b981">{formatCurrency(ticket.amount)}</Typography>
                                                </Box>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="caption" color="text.secondary">Plan</Typography>
                                                    <Typography variant="body2" fontWeight={600} fontSize="0.78rem">{ticket.planName || '—'}</Typography>
                                                </Box>
                                                <Box sx={{ textAlign: 'right' }}>
                                                    <Typography variant="caption" color="text.secondary">Submitted</Typography>
                                                    <Typography variant="caption" color="text.secondary" display="block">{formatDateTime(ticket.createdAt)}</Typography>
                                                </Box>
                                            </Stack>
                                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                                                    TX: {ticket.transactionId.substring(0, 20)}...
                                                </Typography>
                                                {ticket.status === 'PENDING' && (
                                                    <Chip label="Review" size="small" sx={{ bgcolor: 'var(--brand-main)', color: 'white', fontWeight: 700, fontSize: '0.65rem', cursor: 'pointer' }} />
                                                )}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        )}
                    </Box>
                ) : (
                    /* DESKTOP TABLE */
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>User</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Amount</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Plan Tier</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>TX Hash</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Status</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Submitted</TableCell>
                                    <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }} align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton /></TableCell>)}</TableRow>
                                    ))
                                ) : tickets.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                            <Typography color="text.secondary">{tab === 'PENDING' ? 'No pending tickets 🎉' : 'No tickets found'}</Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    tickets.map((ticket) => {
                                        const statusStyle = STATUS_STYLES[ticket.status];
                                        return (
                                            <TableRow key={ticket.id} hover onClick={() => setDetailsPopup({ open: true, ticket })} sx={{ '&:last-child td': { border: 0 }, cursor: 'pointer' }}>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Avatar sx={{ width: 30, height: 30, bgcolor: '#8b5cf6', fontSize: 12, fontWeight: 700 }}>
                                                            {(ticket.userName || 'U')[0].toUpperCase()}
                                                        </Avatar>
                                                        <Box>
                                                            <Typography variant="body2" fontWeight={600}>{ticket.userName || 'Unknown'}</Typography>
                                                            {ticket.telegramUsername && <Typography variant="caption" color="text.secondary">@{ticket.telegramUsername}</Typography>}
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Typography fontWeight={700} color="#10b981">{formatCurrency(ticket.amount)}</Typography>
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Typography variant="body2" fontWeight={600}>{ticket.planName || '—'}</Typography>
                                                    {ticket.planDailyRoi && <Typography variant="caption" color="#10b981">{ticket.planDailyRoi}%/day</Typography>}
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: 140 }}>
                                                        <Typography variant="caption" sx={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b' }}>
                                                            {ticket.transactionId.substring(0, 16)}...
                                                        </Typography>
                                                        <Box onClick={() => copyToClipboard(ticket.transactionId)} sx={{ cursor: 'pointer', color: '#94a3b8', '&:hover': { color: '#3b82f6' } }}>
                                                            <ContentCopyIcon sx={{ fontSize: 14 }} />
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Chip label={statusStyle.label} size="small" sx={{ bgcolor: statusStyle.bgcolor, color: statusStyle.color, fontWeight: 700, fontSize: '0.7rem' }} />
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }}>
                                                    <Typography variant="caption" color="text.secondary">{formatDateTime(ticket.createdAt)}</Typography>
                                                </TableCell>
                                                <TableCell sx={{ py: 2 }} align="right">
                                                    {ticket.status === 'PENDING' ? (
                                                        <Button variant="contained" size="small" onClick={(e) => { e.stopPropagation(); setDetailsPopup({ open: true, ticket }); }} sx={{ bgcolor: 'var(--brand-main)', textTransform: 'none', borderRadius: 2, fontWeight: 600 }}>
                                                            Details
                                                        </Button>
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary">{ticket.adminNote || '—'}</Typography>
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

            <TicketDetailsPopup open={detailsPopup.open} onClose={() => setDetailsPopup({ open: false, ticket: null })} ticket={detailsPopup.ticket} type="deposit" onApprove={handleApprove} onReject={handleReject} />
            <AdminAdvancedFilters open={filterOpen} onClose={() => setFilterOpen(false)} fields={FILTER_FIELDS} values={filterValues} onApply={(v) => setFilterValues(v)} onClear={() => setFilterValues({})} />

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ borderRadius: 2 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
