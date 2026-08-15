// ===========================================
// ADMIN USER DETAILS POPUP
// ===========================================

'use client';

import { useState, useEffect, useCallback, useId, useMemo } from 'react';
import {
    Dialog, DialogTitle, DialogContent, Box, Typography,
    IconButton, Avatar, Tabs, Tab, Grid, Divider,
    Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Chip, CircularProgress, Stack, Button, Paper,
    MenuItem, Select, FormControl, TextField,
    useMediaQuery, useTheme, DialogActions, DialogContentText,
    Alert, AlertTitle, InputAdornment, ToggleButtonGroup, ToggleButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import HistoryIcon from '@mui/icons-material/History';
import ReceiptIcon from '@mui/icons-material/Receipt';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import PeopleIcon from '@mui/icons-material/People';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import SearchIcon from '@mui/icons-material/Search';
import AutoGraphIcon from '@mui/icons-material/AutoGraph';
import LocalAtmIcon from '@mui/icons-material/LocalAtm';

import {
    ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend
} from 'recharts';

import { formatCurrency, formatDateTime, getInitials, getAvatarUrl } from '@/lib/utils';
import type { HierarchyTreeNode } from '@/types';
import type { AdminUserDetailsData } from '@/app/api/admin/users/[id]/details/route';

// ===========================================
// HIERARCHY TREE ITEM (Inner Component)
// ===========================================

const TreeItem = ({ node, level, onToggle }: { node: HierarchyTreeNode; level: number; onToggle: (node: HierarchyTreeNode) => void }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

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
                if (data.success && data.data && data.data.children) {
                    setChildren(data.data.children);
                }
            } catch (err) {
                console.error('Failed to load child tree nodes:', err);
            } finally {
                setLoading(false);
            }
        }
        setExpanded(!expanded);
        onToggle(node);
    };

    return (
        <Box sx={{ ml: level * (isMobile ? 1.5 : 3) }}>
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    mb: 1,
                    bgcolor: level === 0 ? '#f8fafc' : 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: 2,
                    '&:hover': { bgcolor: '#f1f5f9' }
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {hasChildren ? (
                        <IconButton size="small" onClick={handleToggle}>
                            {loading ? <CircularProgress size={16} /> : expanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                        </IconButton>
                    ) : (
                        <Box sx={{ width: 28 }} />
                    )}
                    <Avatar
                        src={getAvatarUrl(node.photoUrl)}
                        imgProps={{ referrerPolicy: 'no-referrer' }}
                        sx={{ width: 32, height: 32, fontSize: 12, fontWeight: 700, bgcolor: 'primary.main' }}
                    >
                        {getInitials(node.firstName || node.telegramUsername || 'U')}
                    </Avatar>
                    <Box>
                        <Typography variant="body2" fontWeight={700}>
                            {node.firstName || node.telegramUsername || 'User'} {node.lastName || ''}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            ID: {node.telegramId} {node.telegramUsername && `@${node.telegramUsername}`}
                        </Typography>
                    </Box>
                </Box>
                <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" color="text.secondary" display="block">Trade Power</Typography>
                        <Typography variant="body2" fontWeight={700} color="success.main">{formatCurrency(node.tradePower)}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                        <Typography variant="caption" color="text.secondary" display="block">Direct Ref</Typography>
                        <Typography variant="body2" fontWeight={700}>{node.directReferralCount}</Typography>
                    </Box>
                </Stack>
            </Box>

            {expanded && (
                <Box sx={{ pl: isMobile ? 1 : 2, borderLeft: '2px solid #cbd5e1', ml: 2, mb: 1 }}>
                    {children.length === 0 ? (
                        <Typography variant="caption" color="text.secondary" sx={{ p: 1, display: 'block' }}>No downlines found.</Typography>
                    ) : (
                        children.map(child => (
                            <TreeItem key={child.id} node={child} level={level + 1} onToggle={onToggle} />
                        ))
                    )}
                </Box>
            )}
        </Box>
    );
};

// Color Palette Constant
const AVATAR_COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

// Transaction Badge Style Mapping Helper
const getTxChipProps = (type: string) => {
    switch (type) {
        case 'DEPOSIT': return { label: 'DEPOSIT', color: 'info' as const };
        case 'WITHDRAWAL': return { label: 'WITHDRAWAL', color: 'error' as const };
        case 'ROI_EARNING': return { label: 'ROI', color: 'success' as const };
        case 'REFERRAL_EARNING': return { label: 'REFERRAL', color: 'secondary' as const };
        case 'REINVEST': return { label: 'REINVEST', color: 'primary' as const };
        case 'ADMIN_CREDIT': return { label: 'ADMIN CREDIT', color: 'warning' as const };
        case 'ADMIN_DEBIT': return { label: 'ADMIN DEBIT', color: 'error' as const };
        case 'MILESTONE_BONUS': return { label: 'MILESTONE', color: 'secondary' as const };
        default: return { label: type, color: 'default' as const };
    }
};

// ===========================================
// MAIN COMPONENT
// ===========================================

interface UserDetailsPopupProps {
    open: boolean;
    onClose: () => void;
    userId: string | null;
    onUserDeleted?: () => void;
}

export default function UserDetailsPopup({ open, onClose, userId, onUserDeleted }: UserDetailsPopupProps) {
    const id = useId();
    const [tabValue, setTabValue] = useState(0);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<AdminUserDetailsData | null>(null);

    // Soft delete state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Permanent delete states
    const [permDeleteOpen, setPermDeleteOpen] = useState(false);
    const [permDeleteStep, setPermDeleteStep] = useState<1 | 2>(1);
    const [confirmInput, setConfirmInput] = useState('');
    const [isPermDeleting, setIsPermDeleting] = useState(false);
    const [permDeleteError, setPermDeleteError] = useState<string | null>(null);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Transaction Filters State
    const [txTypeFilter, setTxTypeFilter] = useState('ALL');
    const [txSearch, setTxSearch] = useState('');

    // ROI History Filters State
    const [roiSearch, setRoiSearch] = useState('');

    // Referral Sub-Tab State ('earnings' | 'downlines')
    const [referralSubTab, setReferralSubTab] = useState<'earnings' | 'downlines'>('earnings');

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
            setTxTypeFilter('ALL');
            setTxSearch('');
            setRoiSearch('');
            setReferralSubTab('earnings');
            fetchData();
        }
    }, [open, userId, fetchData]);

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    // Soft delete (deactivate) user
    const handleDeleteUser = async () => {
        if (!userId) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/admin/users/${userId}/soft-delete`, {
                method: 'POST',
            });
            const json = await res.json();
            if (json.success) {
                setDeleteConfirmOpen(false);
                onClose();
                if (onUserDeleted) onUserDeleted();
            } else {
                alert('Failed to soft delete user: ' + json.error);
            }
        } catch (error) {
            console.error('Error soft deleting user:', error);
            alert('An error occurred while deleting the user.');
        } finally {
            setIsDeleting(false);
        }
    };

    // Open permanent delete modal
    const handleOpenPermanentDelete = () => {
        setConfirmInput('');
        setPermDeleteStep(1);
        setPermDeleteError(null);
        setPermDeleteOpen(true);
    };

    // Execute permanent delete API
    const handleExecutePermanentDelete = async (hasTradePower: boolean) => {
        if (!userId) return;
        setIsPermDeleting(true);
        setPermDeleteError(null);
        try {
            const res = await fetch(`/api/admin/users/${userId}/permanent-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ confirmTradePowerDelete: hasTradePower })
            });
            const json = await res.json();
            if (json.success) {
                setPermDeleteOpen(false);
                onClose();
                if (onUserDeleted) onUserDeleted();
            } else {
                setPermDeleteError(json.error || 'Failed to permanently delete user');
            }
        } catch (error: any) {
            console.error('Error permanently deleting user:', error);
            setPermDeleteError(error.message || 'An error occurred during permanent deletion');
        } finally {
            setIsPermDeleting(false);
        }
    };

    // Derived Memoized Data & Checks
    const hasDownlines = useMemo(() => {
        if (!data) return false;
        return (
            (data.profile.directReferralCount > 0) ||
            (data.profile.totalDownlineCount > 0) ||
            (data.directReferrals && data.directReferrals.length > 0)
        );
    }, [data]);

    const tradePower = data?.profile?.tradePower || 0;
    const hasActivePlans = useMemo(() => data?.plans?.some((p) => p.isActive) || false, [data?.plans]);
    const hasTradePower = tradePower > 0 || hasActivePlans;
    const isAdminAccount = data?.profile?.isAdmin === true;

    // Filtered Transactions Memo
    const filteredTransactions = useMemo(() => {
        if (!data?.transactions) return [];
        return data.transactions.filter((t) => {
            const matchesType = txTypeFilter === 'ALL' || t.type === txTypeFilter;
            const matchesSearch = !txSearch || 
                t.description?.toLowerCase().includes(txSearch.toLowerCase()) ||
                t.reference?.toLowerCase().includes(txSearch.toLowerCase()) ||
                t.type?.toLowerCase().includes(txSearch.toLowerCase());
            return matchesType && matchesSearch;
        });
    }, [data?.transactions, txTypeFilter, txSearch]);

    // Filtered ROI History Memo
    const filteredRoiHistory = useMemo(() => {
        if (!data?.roiHistory) return [];
        return data.roiHistory.filter((r) => {
            if (!roiSearch) return true;
            return (
                r.description?.toLowerCase().includes(roiSearch.toLowerCase()) ||
                formatCurrency(r.amount).includes(roiSearch) ||
                formatDateTime(r.createdAt).toLowerCase().includes(roiSearch.toLowerCase())
            );
        });
    }, [data?.roiHistory, roiSearch]);

    // Analytics Recharts Memoized Data
    const incomeBreakdownData = useMemo(() => {
        if (!data?.analytics) return [];
        return [
            { name: 'ROI Paid', value: data.analytics.totalRoiEarned },
            { name: 'Referral Earned', value: data.analytics.totalReferralEarned },
        ];
    }, [data?.analytics?.totalRoiEarned, data?.analytics?.totalReferralEarned]);

    const portfolioSourceData = useMemo(() => {
        if (!data?.analytics) return [];
        return [
            { name: 'Direct Deposit', value: data.analytics.totalDeposit },
            { name: 'Reinvested ROI', value: data.analytics.totalReinvest },
        ];
    }, [data?.analytics?.totalDeposit, data?.analytics?.totalReinvest]);

    const capitalSummaryData = useMemo(() => {
        if (!data?.analytics) return [];
        return [
            { category: 'Total Invested', amount: data.analytics.totalInvested },
            { category: 'Total ROI Paid', amount: data.analytics.totalRoiEarned },
            { category: 'Total Referral Earned', amount: data.analytics.totalReferralEarned },
            { category: 'Total Withdrawn', amount: data.analytics.totalWithdrawn },
            { category: 'Pending Withdrawal', amount: data.analytics.pendingWithdrawals },
        ];
    }, [data?.analytics]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            fullScreen={isMobile}
            PaperProps={{
                sx: { borderRadius: isMobile ? 0 : 3, maxHeight: isMobile ? '100%' : '92vh' }
            }}
        >
            <DialogTitle
                component="div"
                sx={{
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f1f5f9',
                    bgcolor: 'white'
                }}
            >
                <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a' }}>User Details & Analytics</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                    {data && (
                        <Button
                            variant="contained"
                            color="error"
                            size="small"
                            startIcon={<DeleteForeverIcon />}
                            onClick={handleOpenPermanentDelete}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                borderRadius: 2,
                                boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)'
                            }}
                        >
                            {isMobile ? 'Delete' : 'Permanently Delete User'}
                        </Button>
                    )}
                    <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent sx={{ p: 0, bgcolor: '#f8fafc' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 10 }}>
                        <CircularProgress />
                    </Box>
                ) : data ? (
                    <Box>
                        {/* Header Profile Bar */}
                        <Box sx={{ p: isMobile ? 2 : 3, bgcolor: 'white', borderBottom: '1px solid #f1f5f9' }}>
                            <Box sx={{ 
                                display: 'flex', 
                                gap: isMobile ? 2 : 3, 
                                alignItems: isMobile ? 'center' : 'flex-start',
                                flexDirection: isMobile ? 'column' : 'row',
                                textAlign: isMobile ? 'center' : 'left'
                            }}>
                                <Avatar
                                    src={getAvatarUrl(data.profile.photoUrl)}
                                    imgProps={{ referrerPolicy: 'no-referrer' }}
                                    sx={{
                                        width: isMobile ? 64 : 80, height: isMobile ? 64 : 80, 
                                        fontSize: isMobile ? 24 : 32, fontWeight: 700,
                                        bgcolor: AVATAR_COLORS[0], boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)'
                                    }}
                                >
                                    {getInitials(data.profile.firstName || data.profile.telegramUsername || 'U')}
                                </Avatar>
                                <Box sx={{ flex: 1, width: '100%' }}>
                                    <Typography variant={isMobile ? "h6" : "h5"} fontWeight={800} color="#1e293b">
                                        {data.profile.firstName || 'User'} {data.profile.lastName || ''}
                                    </Typography>
                                    <Typography color="text.secondary" variant="body2" gutterBottom>
                                        @{data.profile.telegramUsername || data.profile.telegramId}
                                    </Typography>
                                    {!isMobile && (
                                        <Typography color="text.secondary" variant="caption" sx={{ display: 'block', mt: -0.5 }}>
                                            ID: {data.profile.id} | Ref Code: <strong>{data.profile.referralCode}</strong>
                                        </Typography>
                                    )}
                                    {data.profile.referredBy && (
                                        <Typography color="text.secondary" variant="caption" sx={{ display: 'block', mt: 0.5, fontWeight: 500 }}>
                                            Referred by: <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>{data.profile.referredBy.name}</Box> {data.profile.referredBy.telegramHandle && `(@${data.profile.referredBy.telegramHandle})`}
                                        </Typography>
                                    )}
                                    <Stack direction="row" spacing={1} sx={{ mt: 1, justifyContent: isMobile ? 'center' : 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                                        <Chip label={`Joined ${formatDateTime(data.profile.createdAt)}`} size="small" variant="outlined" sx={{ borderRadius: 1.5 }} />
                                        <Chip
                                            label={data.profile.isDeleted ? 'Deleted' : (data.profile.isActive ? 'Active' : 'Inactive')}
                                            size="small"
                                            sx={{
                                                bgcolor: data.profile.isDeleted ? '#fee2e2' : (data.profile.isActive ? '#dcfce7' : '#fee2e2'),
                                                color: data.profile.isDeleted ? '#991b1b' : (data.profile.isActive ? '#166534' : '#991b1b'),
                                                fontWeight: 700, borderRadius: 1.5
                                            }}
                                        />
                                        {data.profile.isAdmin && (
                                            <Chip label="Admin" size="small" color="primary" sx={{ fontWeight: 700, borderRadius: 1.5 }} />
                                        )}
                                    </Stack>
                                </Box>
                                <Box sx={{ 
                                    textAlign: isMobile ? 'center' : 'right',
                                    mt: isMobile ? 1 : 0,
                                    bgcolor: isMobile ? '#f8fafc' : '#f1f5f9',
                                    p: 2,
                                    borderRadius: 3,
                                    width: isMobile ? '100%' : 'auto',
                                    minWidth: 180
                                }}>
                                    <Typography variant="overline" color="text.secondary" fontWeight={700} display="block">Main Balance</Typography>
                                    <Typography variant={isMobile ? "h5" : "h4"} fontWeight={800} color="primary.main">
                                        {formatCurrency(data.profile.walletBalance)}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                        Ref Wallet: <strong>{formatCurrency(data.profile.referralWalletBalance)}</strong>
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>

                        {/* Tabs Navigation */}
                        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white', px: 2 }}>
                            <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
                                <Tab label="Overview" icon={<TrendingUpIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                                <Tab label={`Plans (${data.plans.length})`} icon={<ReceiptIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                                <Tab label={`ROI History (${data.roiHistory.length})`} icon={<LocalAtmIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                                <Tab label={`Referrals (${(data.referralEarnings?.length || 0) + (data.directReferrals?.length || 0)})`} icon={<PeopleIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                                <Tab label={`Transactions (${data.transactions.length})`} icon={<HistoryIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                                <Tab label="Analytics" icon={<AutoGraphIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                                <Tab label={`Tree (${data.directReferrals.length})`} icon={<AccountTreeIcon />} iconPosition="start" sx={{ textTransform: 'none', fontWeight: 700 }} />
                            </Tabs>
                        </Box>

                        {/* Tab Content Body */}
                        <Box sx={{ p: isMobile ? 2 : 3 }}>

                            {/* ======================================== */}
                            {/* TAB 0: OVERVIEW */}
                            {/* ======================================== */}
                            {tabValue === 0 && (
                                <Stack spacing={3}>
                                    {/* Stat Grid */}
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                            <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0' }} elevation={0}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={700}>Trade / Mining Power</Typography>
                                                <Typography variant="h5" fontWeight={800} color="success.main" sx={{ my: 0.5 }}>
                                                    {formatCurrency(data.profile.tradePower || 0)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {data.plans.filter((p) => p.isActive).length} active plan(s)
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                            <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0' }} elevation={0}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={700}>Total Invested</Typography>
                                                <Typography variant="h5" fontWeight={800} color="primary.main" sx={{ my: 0.5 }}>
                                                    {formatCurrency(data.analytics.totalInvested)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Deposit: {formatCurrency(data.analytics.totalDeposit)} | Reinvest: {formatCurrency(data.analytics.totalReinvest)}
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                            <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0' }} elevation={0}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={700}>Total Earnings</Typography>
                                                <Typography variant="h5" fontWeight={800} color="#f59e0b" sx={{ my: 0.5 }}>
                                                    {formatCurrency(data.profile.totalEarnings || 0)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    ROI: {formatCurrency(data.analytics.totalRoiEarned)} | Ref: {formatCurrency(data.analytics.totalReferralEarned)}
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                            <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0' }} elevation={0}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={700}>Total Withdrawn</Typography>
                                                <Typography variant="h5" fontWeight={800} color="error.main" sx={{ my: 0.5 }}>
                                                    {formatCurrency(data.analytics.totalWithdrawn)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Pending: {formatCurrency(data.analytics.pendingWithdrawals)}
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                    </Grid>

                                    {/* Overview Cards */}
                                    <Grid container spacing={3}>
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0' }} elevation={0}>
                                                <Typography variant="subtitle1" fontWeight={800} gutterBottom>Account Overview</Typography>
                                                <Divider sx={{ mb: 2 }} />
                                                <Stack spacing={2}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography color="text.secondary" variant="body2">User ID</Typography>
                                                        <Typography variant="body2" fontWeight={700}>{data.profile.id}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography color="text.secondary" variant="body2">Telegram Username</Typography>
                                                        <Typography variant="body2" fontWeight={700}>@{data.profile.telegramUsername || 'N/A'}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography color="text.secondary" variant="body2">Referral Code</Typography>
                                                        <Typography variant="body2" fontWeight={700}>{data.profile.referralCode}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography color="text.secondary" variant="body2">Referral Downlines</Typography>
                                                        <Typography variant="body2" fontWeight={700}>
                                                            {data.profile.directReferralCount || 0} Direct / {data.profile.totalDownlineCount || 0} Network Downlines
                                                        </Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography color="text.secondary" variant="body2">Referred By</Typography>
                                                        <Typography variant="body2" fontWeight={700} color="primary.main">
                                                            {data.profile.referredBy?.name || 'Direct / None'}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </Paper>
                                        </Grid>

                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0' }} elevation={0}>
                                                <Typography variant="subtitle1" fontWeight={800} gutterBottom>Financial Balance Summary</Typography>
                                                <Divider sx={{ mb: 2 }} />
                                                <Stack spacing={2}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography color="text.secondary" variant="body2">Main Wallet Balance</Typography>
                                                        <Typography variant="body2" fontWeight={700}>{formatCurrency(data.profile.walletBalance)}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography color="text.secondary" variant="body2">Referral Wallet Balance</Typography>
                                                        <Typography variant="body2" fontWeight={700}>{formatCurrency(data.profile.referralWalletBalance)}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography color="text.secondary" variant="body2">Total Direct Capital Deposit</Typography>
                                                        <Typography variant="body2" fontWeight={700}>{formatCurrency(data.analytics.totalDeposit)}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography color="text.secondary" variant="body2">Total ROI Reinvested</Typography>
                                                        <Typography variant="body2" fontWeight={700}>{formatCurrency(data.analytics.totalReinvest)}</Typography>
                                                    </Box>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography color="text.secondary" variant="body2">Total Withdrawn Payouts</Typography>
                                                        <Typography variant="body2" fontWeight={700} color="primary.main">{formatCurrency(data.analytics.totalWithdrawn)}</Typography>
                                                    </Box>
                                                </Stack>
                                            </Paper>
                                        </Grid>
                                    </Grid>
                                </Stack>
                            )}

                            {/* ======================================== */}
                            {/* TAB 1: PLANS */}
                            {/* ======================================== */}
                            {tabValue === 1 && (
                                <Stack spacing={2}>
                                    <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: 'white' }} elevation={0}>
                                        <Grid container spacing={2}>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <Typography variant="caption" color="text.secondary">Total Plans</Typography>
                                                <Typography variant="h6" fontWeight={800}>{data.plans.length}</Typography>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <Typography variant="caption" color="text.secondary">Active Plans</Typography>
                                                <Typography variant="h6" fontWeight={800} color="success.main">
                                                    {data.plans.filter((p) => p.isActive).length}
                                                </Typography>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <Typography variant="caption" color="text.secondary">Total ROI Paid</Typography>
                                                <Typography variant="h6" fontWeight={800} color="primary.main">
                                                    {formatCurrency(data.plans.reduce((sum, p) => sum + (p.totalRoiPaid || 0), 0))}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </Paper>

                                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
                                        <Table size="small">
                                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 700 }}>Plan Name</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Daily ROI</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>ROI Paid</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Activated On</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {data.plans.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                                            No active or historical plans found for this user.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : data.plans.map((p) => (
                                                    <TableRow key={p.id} hover>
                                                        <TableCell sx={{ fontWeight: 700 }}>{p.planName}</TableCell>
                                                        <TableCell sx={{ fontWeight: 700, color: 'primary.main' }}>{formatCurrency(p.amount)}</TableCell>
                                                        <TableCell>{p.dailyRoi}%</TableCell>
                                                        <TableCell sx={{ color: 'success.main', fontWeight: 600 }}>{formatCurrency(p.totalRoiPaid || 0)}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={p.isReinvest ? 'Reinvested' : 'Direct Deposit'}
                                                                size="small"
                                                                variant="outlined"
                                                                color={p.isReinvest ? 'secondary' : 'default'}
                                                                sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                                                            />
                                                        </TableCell>
                                                        <TableCell>{formatDateTime(p.createdAt)}</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={p.isActive ? 'Active' : 'Completed'}
                                                                size="small"
                                                                color={p.isActive ? 'success' : 'default'}
                                                                sx={{ fontWeight: 700, borderRadius: 1.5 }}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Stack>
                            )}

                            {/* ======================================== */}
                            {/* TAB 2: ROI HISTORY */}
                            {/* ======================================== */}
                            {tabValue === 2 && (
                                <Stack spacing={2}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                                        <TextField
                                            size="small"
                                            placeholder="Search ROI payouts..."
                                            value={roiSearch}
                                            onChange={(e) => setRoiSearch(e.target.value)}
                                            slotProps={{
                                                input: {
                                                    startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8' }} /></InputAdornment>
                                                }
                                            }}
                                            sx={{ minWidth: 260, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }}
                                        />
                                        <Typography variant="body2" color="text.secondary">
                                            Showing <strong>{filteredRoiHistory.length}</strong> ROI payouts (Total: {formatCurrency(data.analytics.totalRoiEarned)})
                                        </Typography>
                                    </Box>

                                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
                                        <Table size="small">
                                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 700 }}>Date & Time</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Amount Credited</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {filteredRoiHistory.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                                            No ROI payout history records found.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : filteredRoiHistory.map((item) => (
                                                    <TableRow key={item.id} hover>
                                                        <TableCell>{formatDateTime(item.createdAt)}</TableCell>
                                                        <TableCell sx={{ fontWeight: 700, color: 'success.main' }}>
                                                            +{formatCurrency(item.amount)}
                                                        </TableCell>
                                                        <TableCell>{item.description || 'Daily ROI Settlement Payout'}</TableCell>
                                                        <TableCell>
                                                            <Chip label="COMPLETED" size="small" color="success" sx={{ fontWeight: 700, fontSize: '0.65rem' }} />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Stack>
                            )}

                            {/* ======================================== */}
                            {/* TAB 3: REFERRALS */}
                            {/* ======================================== */}
                            {tabValue === 3 && (
                                <Stack spacing={2}>
                                    <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: 'white' }} elevation={0}>
                                        <Grid container spacing={2} alignItems="center">
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <Typography variant="caption" color="text.secondary">Direct Referrals</Typography>
                                                <Typography variant="h6" fontWeight={800}>{data.profile.directReferralCount || 0}</Typography>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <Typography variant="caption" color="text.secondary">Network Downlines</Typography>
                                                <Typography variant="h6" fontWeight={800} color="primary.main">{data.profile.totalDownlineCount || 0}</Typography>
                                            </Grid>
                                            <Grid size={{ xs: 12, sm: 4 }}>
                                                <Typography variant="caption" color="text.secondary">Total Referral Commission</Typography>
                                                <Typography variant="h6" fontWeight={800} color="#8b5cf6">
                                                    {formatCurrency(data.analytics.totalReferralEarned)}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </Paper>

                                    {/* Sub Navigation */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <ToggleButtonGroup
                                            value={referralSubTab}
                                            exclusive
                                            onChange={(_, val) => val && setReferralSubTab(val)}
                                            size="small"
                                            sx={{ bg: 'white' }}
                                        >
                                            <ToggleButton value="earnings" sx={{ textTransform: 'none', fontWeight: 700, px: 2 }}>
                                                Referral Earnings ({data.referralEarnings?.length || 0})
                                            </ToggleButton>
                                            <ToggleButton value="downlines" sx={{ textTransform: 'none', fontWeight: 700, px: 2 }}>
                                                Direct Downlines ({data.directReferrals?.length || 0})
                                            </ToggleButton>
                                        </ToggleButtonGroup>
                                    </Box>

                                    {/* Sub-Tab 1: Referral Earnings */}
                                    {referralSubTab === 'earnings' && (
                                        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
                                            <Table size="small">
                                                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 700 }}>Date & Time</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>Earned From</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>Tier Level</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>Bonus Type</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>Amount Credited</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {(!data.referralEarnings || data.referralEarnings.length === 0) ? (
                                                        <TableRow>
                                                            <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                                                No referral earnings recorded for this user.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : data.referralEarnings.map((e) => (
                                                        <TableRow key={e.id} hover>
                                                            <TableCell>{formatDateTime(e.createdAt)}</TableCell>
                                                            <TableCell sx={{ fontWeight: 700 }}>{e.fromUserName}</TableCell>
                                                            <TableCell>
                                                                <Chip label={`Tier ${e.tier}`} size="small" variant="outlined" sx={{ fontWeight: 700 }} />
                                                            </TableCell>
                                                            <TableCell>
                                                                {e.isFirstPurchaseBonus ? (
                                                                    <Chip label="First Purchase $10 Bonus" size="small" color="secondary" sx={{ fontWeight: 700, fontSize: '0.65rem' }} />
                                                                ) : (
                                                                    <Typography variant="body2" color="text.secondary">Tier Commission</Typography>
                                                                )}
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 700, color: 'success.main' }}>
                                                                +{formatCurrency(e.amount)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}

                                    {/* Sub-Tab 2: Direct Downlines */}
                                    {referralSubTab === 'downlines' && (
                                        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
                                            <Table size="small">
                                                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                                    <TableRow>
                                                        <TableCell sx={{ fontWeight: 700 }}>User</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>Telegram ID</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>Trade Power</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>Direct Ref</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>Total Ref</TableCell>
                                                        <TableCell sx={{ fontWeight: 700 }}>Joined Date</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {(!data.directReferrals || data.directReferrals.length === 0) ? (
                                                        <TableRow>
                                                            <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                                                No direct referrals found.
                                                            </TableCell>
                                                        </TableRow>
                                                    ) : data.directReferrals.map((user) => (
                                                        <TableRow key={user.id} hover>
                                                            <TableCell>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                    <Avatar
                                                                        src={getAvatarUrl(user.photoUrl)}
                                                                        imgProps={{ referrerPolicy: 'no-referrer' }}
                                                                        sx={{ width: 28, height: 28, fontSize: 11, fontWeight: 700, bgcolor: 'primary.main' }}
                                                                    >
                                                                        {getInitials(user.firstName || user.telegramUsername || 'U')}
                                                                    </Avatar>
                                                                    <Box>
                                                                        <Typography variant="body2" fontWeight={700}>
                                                                            {user.firstName || 'User'} {user.lastName || ''}
                                                                        </Typography>
                                                                        {user.telegramUsername && (
                                                                            <Typography variant="caption" color="text.secondary">@{user.telegramUsername}</Typography>
                                                                        )}
                                                                    </Box>
                                                                </Box>
                                                            </TableCell>
                                                            <TableCell>{user.telegramId}</TableCell>
                                                            <TableCell sx={{ fontWeight: 700, color: 'success.main' }}>
                                                                {formatCurrency(user.tradePower)}
                                                            </TableCell>
                                                            <TableCell>{user.directReferralCount}</TableCell>
                                                            <TableCell>{user.totalReferralCount}</TableCell>
                                                            <TableCell>{formatDateTime(user.joinedAt)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    )}
                                </Stack>
                            )}

                            {/* ======================================== */}
                            {/* TAB 4: TRANSACTIONS */}
                            {/* ======================================== */}
                            {tabValue === 4 && (
                                <Stack spacing={2}>
                                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <Stack direction="row" spacing={2} sx={{ flex: 1, minWidth: 280 }}>
                                            <FormControl size="small" sx={{ minWidth: 150, bgcolor: 'white' }}>
                                                <Select
                                                    value={txTypeFilter}
                                                    onChange={(e) => setTxTypeFilter(e.target.value)}
                                                    displayEmpty
                                                    sx={{ borderRadius: 2 }}
                                                >
                                                    <MenuItem value="ALL">All Types</MenuItem>
                                                    <MenuItem value="DEPOSIT">Deposit</MenuItem>
                                                    <MenuItem value="WITHDRAWAL">Withdrawal</MenuItem>
                                                    <MenuItem value="ROI_EARNING">ROI Earning</MenuItem>
                                                    <MenuItem value="REFERRAL_EARNING">Referral Earning</MenuItem>
                                                    <MenuItem value="REINVEST">Reinvest</MenuItem>
                                                    <MenuItem value="ADMIN_CREDIT">Admin Credit</MenuItem>
                                                    <MenuItem value="ADMIN_DEBIT">Admin Debit</MenuItem>
                                                    <MenuItem value="MILESTONE_BONUS">Milestone Bonus</MenuItem>
                                                </Select>
                                            </FormControl>
                                            <TextField
                                                size="small"
                                                placeholder="Search transaction description..."
                                                value={txSearch}
                                                onChange={(e) => setTxSearch(e.target.value)}
                                                slotProps={{
                                                    input: {
                                                        startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: '#94a3b8' }} /></InputAdornment>
                                                    }
                                                }}
                                                sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }}
                                            />
                                        </Stack>
                                        <Typography variant="body2" color="text.secondary">
                                            Showing <strong>{filteredTransactions.length}</strong> transactions
                                        </Typography>
                                    </Box>

                                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
                                        <Table size="small">
                                            <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                                <TableRow>
                                                    <TableCell sx={{ fontWeight: 700 }}>Date & Time</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Balance After</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {filteredTransactions.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                                            No transactions match the selected filters.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : filteredTransactions.map((tx) => {
                                                    const chipProps = getTxChipProps(tx.type);
                                                    const isPositive = tx.amount > 0;
                                                    return (
                                                        <TableRow key={tx.id} hover>
                                                            <TableCell>{formatDateTime(tx.createdAt)}</TableCell>
                                                            <TableCell>
                                                                <Chip label={chipProps.label} size="small" color={chipProps.color} sx={{ fontWeight: 700, fontSize: '0.65rem' }} />
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 800, color: isPositive ? 'success.main' : 'error.main' }}>
                                                                {isPositive ? '+' : ''}{formatCurrency(tx.amount)}
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600 }}>
                                                                {formatCurrency(tx.balanceAfter)}
                                                            </TableCell>
                                                            <TableCell sx={{ color: 'text.secondary', maxWidth: 300 }}>
                                                                {tx.description || tx.reference || '—'}
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Stack>
                            )}

                            {/* ======================================== */}
                            {/* TAB 5: ANALYTICS (RECHARTS & STATS) */}
                            {/* ======================================== */}
                            {tabValue === 5 && (
                                <Stack spacing={3}>
                                    {/* Analytics Metrics Cards */}
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                            <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: 'white' }} elevation={0}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={700}>Net Cash Flow</Typography>
                                                <Typography variant="h5" fontWeight={800} color={data.analytics.totalInvested >= data.analytics.totalWithdrawn ? 'success.main' : 'error.main'} sx={{ my: 0.5 }}>
                                                    {formatCurrency(data.analytics.totalInvested - data.analytics.totalWithdrawn)}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Invested vs Withdrawn
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                            <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: 'white' }} elevation={0}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={700}>ROI Yield Rate</Typography>
                                                <Typography variant="h5" fontWeight={800} color="primary.main" sx={{ my: 0.5 }}>
                                                    {data.analytics.totalInvested > 0 
                                                        ? `${((data.analytics.totalRoiEarned / data.analytics.totalInvested) * 100).toFixed(1)}%`
                                                        : '0%'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Total ROI / Capital
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                            <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: 'white' }} elevation={0}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={700}>Reinvestment Rate</Typography>
                                                <Typography variant="h5" fontWeight={800} color="#8b5cf6" sx={{ my: 0.5 }}>
                                                    {data.analytics.totalInvested > 0 
                                                        ? `${((data.analytics.totalReinvest / data.analytics.totalInvested) * 100).toFixed(1)}%`
                                                        : '0%'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Compounded Deposits
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                            <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: 'white' }} elevation={0}>
                                                <Typography variant="caption" color="text.secondary" fontWeight={700}>Referral Contribution</Typography>
                                                <Typography variant="h5" fontWeight={800} color="#f59e0b" sx={{ my: 0.5 }}>
                                                    {(data.analytics.totalRoiEarned + data.analytics.totalReferralEarned) > 0 
                                                        ? `${((data.analytics.totalReferralEarned / (data.analytics.totalRoiEarned + data.analytics.totalReferralEarned)) * 100).toFixed(1)}%`
                                                        : '0%'}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Ref Share of Income
                                                </Typography>
                                            </Paper>
                                        </Grid>
                                    </Grid>

                                    {/* Visual Charts */}
                                    <Grid container spacing={3}>
                                        {/* Donut Chart: Earnings Breakdown */}
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: 'white' }} elevation={0}>
                                                <Typography variant="subtitle2" fontWeight={800} color="text.secondary" gutterBottom>
                                                    INCOME BREAKDOWN
                                                </Typography>
                                                <Divider sx={{ mb: 2 }} />
                                                <Box sx={{ height: 260, width: '100%' }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={incomeBreakdownData}
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius={55}
                                                                outerRadius={85}
                                                                paddingAngle={5}
                                                                dataKey="value"
                                                            >
                                                                <Cell fill="#10b981" />
                                                                <Cell fill="#8b5cf6" />
                                                            </Pie>
                                                            <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                                                            <Legend />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </Box>
                                            </Paper>
                                        </Grid>

                                        {/* Donut Chart: Portfolio Funding */}
                                        <Grid size={{ xs: 12, md: 6 }}>
                                            <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: 'white' }} elevation={0}>
                                                <Typography variant="subtitle2" fontWeight={800} color="text.secondary" gutterBottom>
                                                    INVESTMENT PORTFOLIO SOURCE
                                                </Typography>
                                                <Divider sx={{ mb: 2 }} />
                                                <Box sx={{ height: 260, width: '100%' }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <PieChart>
                                                            <Pie
                                                                data={portfolioSourceData}
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius={55}
                                                                outerRadius={85}
                                                                paddingAngle={5}
                                                                dataKey="value"
                                                            >
                                                                <Cell fill="#3b82f6" />
                                                                <Cell fill="#f59e0b" />
                                                            </Pie>
                                                            <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                                                            <Legend />
                                                        </PieChart>
                                                    </ResponsiveContainer>
                                                </Box>
                                            </Paper>
                                        </Grid>

                                        {/* Bar Chart: Financial Overview */}
                                        <Grid size={{ xs: 12 }}>
                                            <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: 'white' }} elevation={0}>
                                                <Typography variant="subtitle2" fontWeight={800} color="text.secondary" gutterBottom>
                                                    CAPITAL & FINANCIAL SUMMARY
                                                </Typography>
                                                <Divider sx={{ mb: 2 }} />
                                                <Box sx={{ height: 280, width: '100%' }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart
                                                            data={capitalSummaryData}
                                                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                                                        >
                                                            <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                                                            <YAxis tickFormatter={(v) => `$${v}`} />
                                                            <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                                                            <Bar dataKey="amount" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                                                                <Cell fill="#3b82f6" />
                                                                <Cell fill="#10b981" />
                                                                <Cell fill="#8b5cf6" />
                                                                <Cell fill="#ef4444" />
                                                                <Cell fill="#f59e0b" />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </Box>
                                            </Paper>
                                        </Grid>
                                    </Grid>
                                </Stack>
                            )}

                            {/* ======================================== */}
                            {/* TAB 6: GENEALOGY TREE */}
                            {/* ======================================== */}
                            {tabValue === 6 && (
                                <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 3, p: 3, bgcolor: 'white' }}>
                                    <Typography variant="subtitle2" sx={{ mb: 2, color: '#64748b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <AccountTreeIcon sx={{ fontSize: 18 }} /> GENEALOGY TREE HIERARCHY
                                    </Typography>
                                    <Stack spacing={1}>
                                        {(!data.directReferrals || data.directReferrals.length === 0) ? (
                                            <Typography align="center" variant="body2" color="text.secondary" sx={{ py: 6 }}>
                                                No direct downline referrals found for this user network.
                                            </Typography>
                                        ) : data.directReferrals.map((user) => (
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
            
            {/* Legacy Soft Delete Confirmation Dialog */}
            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
                <DialogTitle>Confirm Soft Delete Customer</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to soft-delete <strong>{data?.profile?.firstName}</strong>? This will deactivate the user and all their active plans, excluding them from future ROI settlements.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)} disabled={isDeleting}>Cancel</Button>
                    <Button onClick={handleDeleteUser} color="error" variant="contained" disabled={isDeleting}>
                        {isDeleting ? 'Deleting...' : 'Deactivate User'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* PERMANENT DELETE SAFETY MODAL */}
            <Dialog
                open={permDeleteOpen}
                onClose={() => !isPermDeleting && setPermDeleteOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: 3 } }}
            >
                <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DeleteForeverIcon color="error" />
                    <Typography variant="h6" fontWeight={800}>Permanently Delete User</Typography>
                </DialogTitle>

                <DialogContent>
                    {permDeleteError && (
                        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                            {permDeleteError}
                        </Alert>
                    )}

                    {/* SCENARIO A: Admin Account Protection */}
                    {isAdminAccount ? (
                        <Alert severity="error" icon={<BlockIcon />} sx={{ borderRadius: 2 }}>
                            <AlertTitle sx={{ fontWeight: 700 }}>Action Blocked</AlertTitle>
                            Cannot delete an admin account. Admin privileges must be revoked first.
                        </Alert>

                    /* SCENARIO B: User Has Downlines (Architecture Protection) */
                    ) : hasDownlines ? (
                        <Stack spacing={2}>
                            <Alert severity="error" icon={<BlockIcon />} sx={{ borderRadius: 2 }}>
                                <AlertTitle sx={{ fontWeight: 700 }}>Cannot Delete User (Active Downlines Exist)</AlertTitle>
                                This user currently has <strong>{data?.profile?.directReferralCount || data?.directReferrals?.length || 0} direct referral(s)</strong> and <strong>{data?.profile?.totalDownlineCount || 0} total downlines</strong> in their network.
                            </Alert>
                            <Paper sx={{ p: 2, bgcolor: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 2 }}>
                                <Typography variant="subtitle2" fontWeight={700} color="#c53030" gutterBottom>
                                    Why is deletion blocked?
                                </Typography>
                                <Typography variant="body2" color="#742a2a" paragraph sx={{ mb: 1 }}>
                                    Deleting an internal node in the referral network would corrupt the tree architecture and leave orphan downline accounts.
                                </Typography>
                                <Typography variant="caption" color="#9b2c2c" display="block">
                                    To maintain network hierarchy integrity, users with active downlines cannot be hard deleted.
                                </Typography>
                            </Paper>
                        </Stack>

                    /* SCENARIO C: User Has Trade Power BUT NO Downlines (2-Step Confirmation) */
                    ) : hasTradePower ? (
                        permDeleteStep === 1 ? (
                            /* Step 1 Warning */
                            <Stack spacing={2}>
                                <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ borderRadius: 2 }}>
                                    <AlertTitle sx={{ fontWeight: 700 }}>Step 1 of 2: Active Trade Power Warning</AlertTitle>
                                    User <strong>{data?.profile?.firstName} {data?.profile?.lastName || ''}</strong> has active <strong>Trade Power of {formatCurrency(tradePower)}</strong> or active investment plans.
                                </Alert>
                                <Typography variant="body2" color="text.secondary">
                                    Permanently deleting this account will discard their Trade Power and hard delete all associated wallet data. Upline referral earnings gained from this user will be <strong>preserved intact</strong>.
                                </Typography>
                            </Stack>
                        ) : (
                            /* Step 2 Confirmation Text Input */
                            <Stack spacing={2}>
                                <Alert severity="error" icon={<DeleteForeverIcon />} sx={{ borderRadius: 2 }}>
                                    <AlertTitle sx={{ fontWeight: 700 }}>Step 2 of 2: Confirm Trade Power Deletion</AlertTitle>
                                    This action is permanent and cannot be undone.
                                </Alert>
                                <Typography variant="body2" fontWeight={600}>
                                    To authorize permanent deletion, type the exact text <Box component="span" sx={{ bgcolor: '#fee2e2', color: '#991b1b', px: 1, py: 0.5, borderRadius: 1, fontFamily: 'monospace', fontWeight: 800 }}>DELETE TRADE POWER</Box> below:
                                </Typography>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="DELETE TRADE POWER"
                                    value={confirmInput}
                                    onChange={(e) => setConfirmInput(e.target.value)}
                                    autoFocus
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                />
                            </Stack>
                        )

                    /* SCENARIO D: User Has NO Downlines and NO Trade Power (Standard 1-Step Confirmation) */
                    ) : (
                        <Stack spacing={2}>
                            <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ borderRadius: 2 }}>
                                <AlertTitle sx={{ fontWeight: 700 }}>Permanent Deletion Warning</AlertTitle>
                                Are you sure you want to permanently delete <strong>{data?.profile?.firstName} {data?.profile?.lastName || ''}</strong> (@{data?.profile?.telegramUsername || data?.profile?.telegramId})?
                            </Alert>
                            <Typography variant="body2" color="text.secondary">
                                This will purge the user and all associated wallet records from the database. Any upline earnings remain preserved. This action <strong>cannot be undone</strong>.
                            </Typography>
                        </Stack>
                    )}
                </DialogContent>

                <DialogActions sx={{ p: 2, borderTop: '1px solid #f1f5f9' }}>
                    <Button
                        onClick={() => setPermDeleteOpen(false)}
                        disabled={isPermDeleting}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                        Cancel
                    </Button>

                    {isAdminAccount || hasDownlines ? (
                        <Button variant="contained" disabled sx={{ textTransform: 'none', fontWeight: 700 }}>
                            Deletion Blocked
                        </Button>
                    ) : hasTradePower ? (
                        permDeleteStep === 1 ? (
                            <Button
                                variant="contained"
                                color="warning"
                                onClick={() => setPermDeleteStep(2)}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                                I Understand, Proceed to Step 2
                            </Button>
                        ) : (
                            <Button
                                variant="contained"
                                color="error"
                                disabled={confirmInput.trim() !== 'DELETE TRADE POWER' || isPermDeleting}
                                onClick={() => handleExecutePermanentDelete(true)}
                                startIcon={isPermDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
                                sx={{ textTransform: 'none', fontWeight: 700 }}
                            >
                                {isPermDeleting ? 'Deleting...' : 'Permanently Delete User'}
                            </Button>
                        )
                    ) : (
                        <Button
                            variant="contained"
                            color="error"
                            disabled={isPermDeleting}
                            onClick={() => handleExecutePermanentDelete(false)}
                            startIcon={isPermDeleting ? <CircularProgress size={16} color="inherit" /> : <DeleteForeverIcon />}
                            sx={{ textTransform: 'none', fontWeight: 700 }}
                        >
                            {isPermDeleting ? 'Deleting...' : 'Permanently Delete User'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Dialog>
    );
}
