// ===========================================
// ADMIN USER DETAILS POPUP
// ===========================================

'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import {
    Dialog, DialogTitle, DialogContent, Box, Typography,
    IconButton, Avatar, Tabs, Tab, Grid, Divider,
    Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Chip, CircularProgress, Stack, Button, Paper,
    MenuItem, Select, InputLabel, FormControl, TextField
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HistoryIcon from '@mui/icons-material/History';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PeopleIcon from '@mui/icons-material/People';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import FilterListIcon from '@mui/icons-material/FilterList';
import { formatCurrency, formatDateTime, getInitials } from '@/lib/utils';
import DateRangeFilterBar from '../../_components/DateRangeFilterBar';
import type { HierarchyTreeNode } from '@/types';

// ===========================================
// HIERARCHY TREE ITEM (Inner)
// ===========================================

const TreeItem = ({ node, level, onToggle }: { node: HierarchyTreeNode; level: number; onToggle: (node: HierarchyTreeNode) => void }) => {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState<HierarchyTreeNode[]>(node.children || []);
    const [loading, setLoading] = useState(false);

    const hasChildren = node.directReferralCount > 0;

    const handleToggle = async () => {
        if (!expanded && children.length === 0 && hasChildren) {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/reports/hierarchy?rootUserId=${node.id}&depth=1`);
                const data = await res.json();
                if (data.success && data.data.explorerTree) {
                    setChildren(data.data.explorerTree);
                }
            } catch (err) {
                console.error('Failed to fetch children:', err);
            } finally {
                setLoading(false);
            }
        }
        setExpanded(!expanded);
    };

    return (
        <Box sx={{ ml: level > 0 ? 3 : 0, mb: 0.5 }}>
            <Box
                sx={{
                    p: 1,
                    border: '1px solid #e2e8f0',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    '&:hover': { bgcolor: '#f8fafc' },
                    cursor: hasChildren ? 'pointer' : 'default'
                }}
                onClick={handleToggle}
            >
                {hasChildren ? (
                    <IconButton size="small" sx={{ p: 0 }}>
                        {expanded ? <KeyboardArrowDownIcon sx={{ fontSize: 18 }} /> : <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />}
                    </IconButton>
                ) : (
                    <Box sx={{ width: 18 }} />
                )}
                <Avatar 
                    src={node.photoUrl || undefined}
                    sx={{ width: 24, height: 24, fontSize: 10, bgcolor: 'primary.main', fontWeight: 700 }}
                >
                    {getInitials(node.firstName || node.telegramUsername || '?')}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" fontWeight={600} noWrap display="block">
                        {node.firstName || 'User'} {node.lastName || ''} (@{node.telegramUsername || node.telegramId})
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        Joined {formatDateTime(node.joinedAt)}
                    </Typography>
                </Box>
                <Chip
                    icon={<PeopleIcon sx={{ fontSize: '0.7rem !important' }} />}
                    label={`${node.directReferralCount}/${node.totalReferralCount}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.6rem' }}
                />
            </Box>
            {expanded && (
                <Box sx={{ mt: 0.5 }}>
                    {loading ? (
                        <Box sx={{ ml: 4, py: 1 }}><CircularProgress size={16} /></Box>
                    ) : (
                        children.map(child => <TreeItem key={child.id} node={child} level={level + 1} onToggle={onToggle} />)
                    )}
                </Box>
            )}
        </Box>
    );
};

// ================= : deleted timeSlots section : =================
// MAIN COMPONENT
// ===========================================

interface UserDetailsPopupProps {
    open: boolean;
    onClose: () => void;
    userId: string | null;
}

export default function UserDetailsPopup({ open, onClose, userId }: UserDetailsPopupProps) {
    const id = useId();
    const [tabValue, setTabValue] = useState(0);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);

    // Transaction Filters State
    const [txFilters, setTxFilters] = useState({
        type: 'ALL',
        startDate: '',
        endDate: '',
        minAmount: '',
        maxAmount: ''
    });

    const fetchData = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/users/${userId}/details`);
            const json = await res.json();
            if (json.success) {
                setData(json.data);
            }
        } catch (err) {
            console.error('Error fetching user details:', err);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        if (open && userId) {
            setTabValue(0);
            fetchData();
        }
    }, [open, userId, fetchData]);

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: { borderRadius: 3, maxHeight: '90vh' }
            }}
        >
            <DialogTitle
                component="div"
                sx={{
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f1f5f9'
                }}
            >
                <Typography variant="h6" fontWeight={800}>User Details</Typography>
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0, bgcolor: '#f8fafc' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 10 }}>
                        <CircularProgress />
                    </Box>
                ) : data ? (
                    <Box>
                        {/* Header Stats */}
                        <Box sx={{ p: 3, bgcolor: 'white', borderBottom: '1px solid #f1f5f9' }}>
                            <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                                <Avatar
                                    src={data.profile.photoUrl || undefined}
                                    sx={{
                                        width: 80, height: 80, fontSize: 32, fontWeight: 700,
                                        bgcolor: COLORS[0], boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)'
                                    }}
                                >
                                    {getInitials(data.profile.firstName || data.profile.telegramUsername || 'U')}
                                </Avatar>
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="h5" fontWeight={800} color="#1e293b">
                                        {data.profile.firstName || 'User'} {data.profile.lastName || ''}
                                    </Typography>
                                    <Typography color="text.secondary" variant="body2" gutterBottom>
                                        @{data.profile.telegramUsername || data.profile.telegramId} • ID: {data.profile.id}
                                    </Typography>
                                    <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                        <Chip label={`Joined ${formatDateTime(data.profile.createdAt)}`} size="small" variant="outlined" sx={{ borderRadius: 1.5 }} />
                                        <Chip
                                            label={data.profile.isActive ? 'Active' : 'Inactive'}
                                            size="small"
                                            sx={{
                                                bgcolor: data.profile.isActive ? '#dcfce7' : '#fee2e2',
                                                color: data.profile.isActive ? '#166534' : '#991b1b',
                                                fontWeight: 700, borderRadius: 1.5
                                            }}
                                        />
                                    </Stack>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                    <Typography variant="overline" color="text.secondary" fontWeight={700}>Main Balance</Typography>
                                    <Typography variant="h4" fontWeight={800} color="primary.main">
                                        {formatCurrency(data.profile.walletBalance)}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

                        {/* Tabs Navigation */}
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white' }}>
                            <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
                                <Tab label="Overview" icon={<TrendingUpIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                                <Tab label={`Plans (${data.plans.length})`} icon={<ReceiptIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                                <Tab label="ROI History" icon={<TrendingUpIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                                <Tab label="Referrals" icon={<AccountBalanceWalletIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                                <Tab label="Transactions" icon={<HistoryIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                                <Tab label="Analytics" icon={<TrendingUpIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                                <Tab label="Tree" icon={<AccountTreeIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                            </Tabs>
                        </Box>

                        {/* Tab Content */}
                        <Box sx={{ p: 3 }}>
                            {/* Overview Tab */}
                            {tabValue === 0 && (
                                <Grid container spacing={3}>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Paper sx={{ p: 2.5, borderRadius: 3, height: '100%', border: '1px solid #e2e8f0' }} elevation={0}>
                                            <Typography variant="subtitle1" fontWeight={800} gutterBottom display="flex" alignItems="center" gap={1}>
                                                <TrendingUpIcon color="primary" sx={{ fontSize: 20 }} /> Performance
                                            </Typography>
                                            <Box sx={{ mt: 2 }}>
                                                {[
                                                    { label: 'Mining Power', value: formatCurrency(data.profile.tradePower), color: 'primary.main' },
                                                    { label: 'Total Earnings', value: formatCurrency(data.profile.totalEarnings), color: '#f59e0b' },
                                                    { label: 'Referral Balance', value: formatCurrency(data.profile.referralWalletBalance), color: '#10b981' },
                                                ].map((stat, i) => (
                                                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                        <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                                                        <Typography variant="body2" fontWeight={800} color={stat.color}>{stat.value}</Typography>
                                                    </Box>
                                                ))}
                                            </Box>
                                        </Paper>
                                    </Grid>
                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Paper sx={{ p: 2.5, borderRadius: 3, height: '100%', border: '1px solid #e2e8f0' }} elevation={0}>
                                            <Typography variant="subtitle1" fontWeight={800} gutterBottom display="flex" alignItems="center" gap={1}>
                                                <PeopleIcon color="primary" sx={{ fontSize: 20 }} /> Network
                                            </Typography>
                                            <Box sx={{ mt: 2 }}>
                                                {[
                                                    { label: 'Direct Referrals', value: data.profile.directReferralCount },
                                                    { label: 'Total Team (10 Levels)', value: data.profile.totalReferralCount },
                                                    { label: 'Total Downline', value: data.profile.totalDownlineCount || 0 },
                                                ].map((stat, i) => (
                                                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                                                        <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                                                        <Typography variant="body2" fontWeight={800}>{stat.value}</Typography>
                                                    </Box>
                                                ))}
                                            </Box>
                                        </Paper>
                                    </Grid>
                                </Grid>
                            )}

                            {/* Plans Tab */}
                            {tabValue === 1 && (
                                <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 700 }}>Plan</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>ROI Paid</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.plans.length === 0 ? (
                                                <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>No plans found</TableCell></TableRow>
                                            ) : data.plans.map((plan: any) => (
                                                <TableRow key={plan.id}>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={600}>{plan.planName}</Typography>
                                                        <Typography variant="caption" color="text.secondary">{plan.dailyRoi}% daily</Typography>
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(plan.amount)}</TableCell>
                                                    <TableCell sx={{ fontWeight: 700, color: 'success.main' }}>{formatCurrency(plan.totalRoiPaid)}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={plan.isActive ? 'Active' : 'Expired'}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: plan.isActive ? '#dcfce7' : '#f1f5f9',
                                                                color: plan.isActive ? '#166534' : '#64748b',
                                                                fontWeight: 700, height: 20, fontSize: '0.65rem'
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell><Typography variant="caption">{formatDateTime(plan.createdAt)}</Typography></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}

                            {/* ROI History Tab */}
                            {tabValue === 2 && (
                                <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Balance After</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.roiHistory.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}>No ROI earnings found</TableCell></TableRow>
                                            ) : data.roiHistory.map((roi: any) => (
                                                <TableRow key={roi.id}>
                                                    <TableCell><Typography variant="body2">{roi.description}</Typography></TableCell>
                                                    <TableCell sx={{ fontWeight: 700, color: 'success.main' }}>+{formatCurrency(roi.amount)}</TableCell>
                                                    <TableCell sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>{formatCurrency(roi.balanceAfter)}</TableCell>
                                                    <TableCell><Typography variant="caption">{formatDateTime(roi.createdAt)}</Typography></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}

                            {/* Referrals (Earnings) Tab */}
                            {tabValue === 3 && (
                                <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 700 }}>From User</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Tier</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.referralEarnings.length === 0 ? (
                                                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}>No earnings found</TableCell></TableRow>
                                            ) : data.referralEarnings.map((earning: any) => (
                                                <TableRow key={earning.id}>
                                                    <TableCell sx={{ fontWeight: 600 }}>{earning.fromUserName}</TableCell>
                                                    <TableCell><Chip label={`L${earning.tier}`} size="small" sx={{ fontWeight: 700, height: 18, fontSize: '0.6rem' }} /></TableCell>
                                                    <TableCell sx={{ fontWeight: 700, color: '#f59e0b' }}>{formatCurrency(earning.amount)}</TableCell>
                                                    <TableCell><Typography variant="caption">{formatDateTime(earning.createdAt)}</Typography></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}

                            {/* Transactions Tab */}
                            {tabValue === 4 && (
                                <Box>
                                    <Paper sx={{ p: 2, mb: 2, borderRadius: 3, border: '1px solid #e2e8f0' }} elevation={0}>
                                        <Box sx={{ mb: 2 }}>
                                            <DateRangeFilterBar
                                                startDate={txFilters.startDate}
                                                endDate={txFilters.endDate}
                                                onChange={(s, e) => setTxFilters({ ...txFilters, startDate: s, endDate: e })}
                                            />
                                        </Box>

                                        <Grid container spacing={2} sx={{ mb: 2 }}>
                                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                                <FormControl fullWidth size="small">
                                                    <InputLabel>Type</InputLabel>
                                                    <Select
                                                        value={txFilters.type}
                                                        label="Type"
                                                        onChange={(e) => setTxFilters({ ...txFilters, type: e.target.value })}
                                                    >
                                                        <MenuItem value="ALL">All Types</MenuItem>
                                                        <MenuItem value="DEPOSIT">Deposit</MenuItem>
                                                        <MenuItem value="WITHDRAWAL">Withdrawal</MenuItem>
                                                        <MenuItem value="PLAN_PURCHASE">Plan Purchase</MenuItem>
                                                        <MenuItem value="REFERRAL_EARNING">Referral Earning</MenuItem>
                                                        <MenuItem value="ROI_EARNING">ROI Earning</MenuItem>
                                                        <MenuItem value="BONUS">Bonus</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                                <TextField
                                                    id={`${id}-minAmount`}
                                                    type="number"
                                                    fullWidth
                                                    size="small"
                                                    value={txFilters.minAmount}
                                                    onChange={(e) => setTxFilters({ ...txFilters, minAmount: e.target.value })}
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                                <TextField
                                                    id={`${id}-maxAmount`}
                                                    type="number"
                                                    fullWidth
                                                    size="small"
                                                    value={txFilters.maxAmount}
                                                    onChange={(e) => setTxFilters({ ...txFilters, maxAmount: e.target.value })}
                                                />
                                            </Grid>
                                        </Grid>
                                        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                                            <Button
                                                size="small"
                                                onClick={() => setTxFilters({ type: 'ALL', startDate: '', endDate: '', minAmount: '', maxAmount: '' })}
                                                sx={{ textTransform: 'none' }}
                                            >
                                                Clear Filters
                                            </Button>
                                        </Box>
                                    </Paper>

                                    <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0' }}>
                                        <Table size="small">
                                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {(() => {
                                                    const filtered = data.transactions.filter((tx: any) => {
                                                        if (txFilters.type !== 'ALL' && tx.type !== txFilters.type) return false;
                                                        if (txFilters.minAmount && Math.abs(tx.amount) < parseFloat(txFilters.minAmount)) return false;
                                                        if (txFilters.maxAmount && Math.abs(tx.amount) > parseFloat(txFilters.maxAmount)) return false;
                                                        if (txFilters.startDate && new Date(tx.createdAt) < new Date(txFilters.startDate)) return false;
                                                        if (txFilters.endDate) {
                                                            const end = new Date(txFilters.endDate);
                                                            end.setHours(23, 59, 59, 999);
                                                            if (new Date(tx.createdAt) > end) return false;
                                                        }
                                                        return true;
                                                    });

                                                    if (filtered.length === 0) {
                                                        return <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}>No transactions found matching filters</TableCell></TableRow>;
                                                    }

                                                    return filtered.map((tx: any) => (
                                                        <TableRow key={tx.id}>
                                                            <TableCell>
                                                                <Chip
                                                                    label={tx.type.replace('_', ' ')}
                                                                    size="small"
                                                                    sx={{ fontWeight: 700, height: 18, fontSize: '0.6rem', variant: 'outlined' }}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 700, color: tx.amount > 0 ? 'success.main' : 'error.main' }}>
                                                                {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                                            </TableCell>
                                                            <TableCell><Typography variant="caption">{tx.description || '-'}</Typography></TableCell>
                                                            <TableCell><Typography variant="caption">{formatDateTime(tx.createdAt)}</Typography></TableCell>
                                                        </TableRow>
                                                    ));
                                                })()}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Box>
                            )}

                            {/* Analytics Tab */}
                            {tabValue === 5 && (
                                <Box>
                                    <Grid container spacing={3}>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <Paper
                                                sx={{
                                                    p: 4, borderRadius: 3, border: '1px solid #e2e8f0',
                                                    textAlign: 'center', bgcolor: 'primary.main', color: 'white',
                                                    height: '100%', display: 'flex', flexDirection: 'column',
                                                    justifyContent: 'center'
                                                }}
                                                elevation={0}
                                            >
                                                <Typography variant="overline" sx={{ opacity: 0.8, fontWeight: 700 }}>Total All-time Invested</Typography>
                                                <Typography variant="h3" fontWeight={800}>{formatCurrency(data.analytics.totalInvested)}</Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <Stack spacing={3} sx={{ height: '100%' }}>
                                                <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#f0fdf4', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} elevation={0}>
                                                    <Typography variant="overline" color="text.secondary" fontWeight={700}>Total by Deposit</Typography>
                                                    <Typography variant="h5" fontWeight={800} color="success.main">{formatCurrency(data.analytics.totalDeposit)}</Typography>
                                                </Paper>
                                                <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#eff6ff', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }} elevation={0}>
                                                    <Typography variant="overline" color="text.secondary" fontWeight={700}>Total by Compounding Power</Typography>
                                                    <Typography variant="h5" fontWeight={800} color="primary.main">{formatCurrency(data.analytics.totalReinvest)}</Typography>
                                                </Paper>
                                            </Stack>
                                        </Grid>

                                        <Grid size={{ xs: 12 }}>
                                            <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0' }} elevation={0}>
                                                <Typography variant="subtitle1" fontWeight={800} gutterBottom>Financial Summary</Typography>
                                                <Divider sx={{ mb: 2 }} />
                                                <Grid container spacing={2}>
                                                    {[
                                                        { label: 'Total ROI Earned', value: formatCurrency(data.analytics.totalRoiEarned), color: '#10b981' },
                                                        { label: 'Total Referral Earned', value: formatCurrency(data.analytics.totalReferralEarned), color: '#f59e0b' },
                                                        { label: 'Total Withdrawn', value: formatCurrency(data.analytics.totalWithdrawn), color: '#3b82f6' },
                                                        { label: 'Pending Withdrawals', value: formatCurrency(data.analytics.pendingWithdrawals), color: '#ef4444' },
                                                    ].map((stat, i) => (
                                                        <Grid key={i} size={{ xs: 12, sm: 6 }}>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', p: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                                                                <Typography variant="body2" color="text.secondary">{stat.label}</Typography>
                                                                <Typography variant="body2" fontWeight={700} sx={{ color: stat.color }}>{stat.value}</Typography>
                                                            </Box>
                                                        </Grid>
                                                    ))}
                                                </Grid>
                                            </Paper>
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}

                            {/* Hierarchy Tree Tab */}
                            {tabValue === 6 && (
                                <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 3, p: 2, bgcolor: 'white' }}>
                                    <Typography variant="subtitle2" sx={{ mb: 2, color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <AccountTreeIcon sx={{ fontSize: 18 }} /> GENEALOGY TREE
                                    </Typography>
                                    <Stack spacing={1}>
                                        {data.directReferrals.length === 0 ? (
                                            <Typography align="center" variant="body2" color="text.secondary" sx={{ py: 4 }}>No direct referrals found for this user.</Typography>
                                        ) : data.directReferrals.map((user: any) => (
                                            <TreeItem key={user.id} node={user} level={0} onToggle={() => { }} />
                                        ))}
                                    </Stack>
                                </Box>
                            )}
                        </Box>
                    </Box>
                ) : (
                    <Box sx={{ p: 5, textAlign: 'center' }}>
                        <Typography color="error">Failed to load user data</Typography>
                        <Button onClick={fetchData} sx={{ mt: 2 }}>Retry</Button>
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
