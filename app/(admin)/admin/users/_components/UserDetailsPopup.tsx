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
    MenuItem, Select, InputLabel, FormControl, TextField,
    useMediaQuery, useTheme, DialogActions, DialogContentText,
    Alert, AlertTitle
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
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import BlockIcon from '@mui/icons-material/Block';
import { formatCurrency, formatDateTime, getInitials, getAvatarUrl } from '@/lib/utils';
import DateRangeFilterBar from '../../_components/DateRangeFilterBar';
import type { HierarchyTreeNode } from '@/types';

// ===========================================
// HIERARCHY TREE ITEM (Inner)
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
    const [data, setData] = useState<any>(null);

    // Soft delete state (legacy)
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

    const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

    // Derived states for permanent deletion checks
    const hasDownlines = data ? (
        (data.profile?.directReferralCount > 0) ||
        (data.profile?.totalDownlineCount > 0) ||
        (data.directReferrals && data.directReferrals.length > 0)
    ) : false;

    const tradePower = data?.profile?.tradePower || 0;
    const hasActivePlans = data?.plans?.some((p: any) => p.isActive) || false;
    const hasTradePower = tradePower > 0 || hasActivePlans;
    const isAdminAccount = data?.profile?.isAdmin === true;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            fullScreen={isMobile}
            PaperProps={{
                sx: { borderRadius: isMobile ? 0 : 3, maxHeight: isMobile ? '100%' : '90vh' }
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
                        {/* Header Stats */}
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
                                        bgcolor: COLORS[0], boxShadow: '0 4px 12px rgba(139, 92, 246, 0.2)'
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
                                            ID: {data.profile.id}
                                        </Typography>
                                    )}
                                    {data.profile.referredBy && (
                                        <Typography color="text.secondary" variant="caption" sx={{ display: 'block', mt: 0.5, fontWeight: 500 }}>
                                            Referred by: <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>{data.profile.referredBy.name}</Box>
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
                                    </Stack>
                                </Box>
                                <Box sx={{ 
                                    textAlign: isMobile ? 'center' : 'right',
                                    mt: isMobile ? 1 : 0,
                                    bgcolor: isMobile ? '#f8fafc' : 'transparent',
                                    p: isMobile ? 2 : 0,
                                    borderRadius: isMobile ? 2 : 0,
                                    width: isMobile ? '100%' : 'auto'
                                }}>
                                    <Typography variant="overline" color="text.secondary" fontWeight={700}>Main Balance</Typography>
                                    <Typography variant={isMobile ? "h5" : "h4"} fontWeight={800} color="primary.main">
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
                                        <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0' }} elevation={0}>
                                            <Typography variant="subtitle1" fontWeight={800} gutterBottom>Account Overview</Typography>
                                            <Divider sx={{ mb: 2 }} />
                                            <Stack spacing={2}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography color="text.secondary" variant="body2">Mining / Trade Power</Typography>
                                                    <Typography variant="body2" fontWeight={700} color="success.main">{formatCurrency(data.profile.tradePower || 0)}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography color="text.secondary" variant="body2">Total Referrals</Typography>
                                                    <Typography variant="body2" fontWeight={700}>{data.profile.directReferralCount || 0} direct ({data.profile.totalDownlineCount || 0} downline)</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography color="text.secondary" variant="body2">Total Earnings</Typography>
                                                    <Typography variant="body2" fontWeight={700} color="#f59e0b">{formatCurrency(data.profile.totalEarnings || 0)}</Typography>
                                                </Box>
                                            </Stack>
                                        </Paper>
                                    </Grid>

                                    <Grid size={{ xs: 12, md: 6 }}>
                                        <Paper sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0' }} elevation={0}>
                                            <Typography variant="subtitle1" fontWeight={800} gutterBottom>Financial Summary</Typography>
                                            <Divider sx={{ mb: 2 }} />
                                            <Stack spacing={2}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography color="text.secondary" variant="body2">Total Invested</Typography>
                                                    <Typography variant="body2" fontWeight={700}>{formatCurrency(data.analytics.totalInvested)}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography color="text.secondary" variant="body2">Total Withdrawn</Typography>
                                                    <Typography variant="body2" fontWeight={700} color="primary.main">{formatCurrency(data.analytics.totalWithdrawn)}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <Typography color="text.secondary" variant="body2">Pending Withdrawals</Typography>
                                                    <Typography variant="body2" fontWeight={700} color="error.main">{formatCurrency(data.analytics.pendingWithdrawals)}</Typography>
                                                </Box>
                                            </Stack>
                                        </Paper>
                                    </Grid>
                                </Grid>
                            )}

                            {/* Plans Tab */}
                            {tabValue === 1 && (
                                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3 }}>
                                    <Table size="small">
                                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 700 }}>Plan</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Daily ROI</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>ROI Paid</TableCell>
                                                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.plans.length === 0 ? (
                                                <TableRow><TableCell colSpan={5} align="center">No active or historical plans.</TableCell></TableRow>
                                            ) : data.plans.map((p: any) => (
                                                <TableRow key={p.id}>
                                                    <TableCell>{p.planName}</TableCell>
                                                    <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(p.amount)}</TableCell>
                                                    <TableCell>{p.dailyRoi}%</TableCell>
                                                    <TableCell>{formatCurrency(p.totalRoiPaid)}</TableCell>
                                                    <TableCell>
                                                        <Chip label={p.isActive ? 'Active' : 'Completed'} size="small" color={p.isActive ? 'success' : 'default'} />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            )}

                            {/* Analytics & Tree Tabs... */}
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
                            <Stack spacing= {2}>
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
