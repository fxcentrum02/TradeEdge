'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Box, Card, CardContent, Typography, TextField, Button,
    Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Paper, Chip, Stack, IconButton, InputAdornment,
    Alert, CircularProgress, Container, Switch, FormControlLabel,
    Dialog, DialogTitle, DialogContent, DialogActions, Grid,
    Tabs, Tab
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HistoryIcon from '@mui/icons-material/History';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import SecurityIcon from '@mui/icons-material/Security';
import SearchIcon from '@mui/icons-material/Search';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import DevicesIcon from '@mui/icons-material/Devices';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';

interface FeatureRequest {
    _id: string;
    featureTitle: string;
    fullName: string;
    email: string;
    price: string;
    status: string;
    createdAt: string;
    requestedBy?: string;
    ipAddress?: string;
    deviceInfo?: string;
}

interface ActivePlanSnapshot {
    _id?: string;
    planId: string;
    planName?: string;
    amount: number;
    startDate: string;
    endDate: string;
    isReinvest: boolean;
    totalRoiPaid: number;
    lastRoiDate?: string;
    completedRoiDays: number;
    remainingDurationDays: number;
    totalDurationDays: number;
    dailyRoiRate: number;
}

interface PendingWithdrawalSnapshot {
    _id: string;
    amount: number;
    fee: number;
    netAmount: number;
    walletAddress: string;
    network: string;
    createdAt: string;
}

interface DeletionLog {
    _id: string;
    deletedUserId: string;
    userSnapshot: {
        telegramId: string;
        telegramUsername?: string;
        firstName?: string;
        lastName?: string;
        referralCode: string;
        tradePower: number;
        downlineTradePower?: number;
        totalReinvested: number;
        walletBalance: number;
        referralWalletBalance: number;
        withdrawals: {
            totalCompletedAmount: number;
            totalCompletedCount: number;
            totalRequestedAmount: number;
            totalPendingAmount: number;
        };
        referral: {
            referredById?: string | null;
            ancestors?: string[];
            referrerName?: string;
            referrerTelegramId?: string;
            directReferralCount: number;
            totalDownlineCount: number;
        };
        activePlansCount: number;
        totalPlansCount: number;
        activePlansSnapshot?: ActivePlanSnapshot[];
        pendingWithdrawalsSnapshot?: PendingWithdrawalSnapshot[];
        userCreatedAt?: string;
    };
    deletedBy: {
        adminId: string;
        email?: string;
        name?: string;
        role?: string;
    };
    authorizedByPassword?: {
        personName: string;
        passwordKey: string;
    };
    ip: string;
    userAgent: string;
    device?: string;
    deletedAt: string;
    deletionType: 'PERMANENT' | 'SOFT';
    isRestored?: boolean;
    restoredAt?: string;
    restoredBy?: {
        adminId: string;
        email?: string;
        name?: string;
        role?: string;
    };
    restoredByPassword?: {
        personName: string;
        passwordKey: string;
    };
    restorationNotes?: string;
}

export default function DeveloperRequestsPage() {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [activeTab, setActiveTab] = useState<'deletions' | 'requests'>('deletions');
    
    // Feature requests state
    const [requests, setRequests] = useState<FeatureRequest[]>([]);
    
    // Deletion logs state
    const [deletionLogs, setDeletionLogs] = useState<DeletionLog[]>([]);
    const [deletionSearch, setDeletionSearch] = useState('');
    const [deletionTypeFilter, setDeletionTypeFilter] = useState<'ALL' | 'PERMANENT' | 'SOFT'>('ALL');
    const [selectedLog, setSelectedLog] = useState<DeletionLog | null>(null);

    // User restoration state
    const [restoreTargetLog, setRestoreTargetLog] = useState<DeletionLog | null>(null);
    const [restorePassword, setRestorePassword] = useState('');
    const [showRestorePassword, setShowRestorePassword] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [restoreError, setRestoreError] = useState('');

    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [estDuration, setEstDuration] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);

    // Fetch maintenance settings when authenticated
    useEffect(() => {
        if (isAuthenticated) {
            fetch('/api/settings/maintenance')
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.data) {
                        setMaintenanceMode(data.data.maintenanceMode || false);
                        setEstDuration(data.data.maintenanceEstimatedDuration || '');
                    }
                })
                .catch(err => console.error('Failed to load maintenance settings:', err));
        }
    }, [isAuthenticated]);

    const handleSaveMaintenance = async () => {
        setSaveLoading(true);
        setErrorMsg('');
        setSuccessMsg('');
        try {
            const res = await fetch('/api/developer/maintenance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password,
                    maintenanceMode,
                    maintenanceEstimatedDuration: estDuration
                })
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMsg('Maintenance settings successfully updated.');
            } else {
                setErrorMsg(data.error || 'Failed to update maintenance settings.');
            }
        } catch {
            setErrorMsg('Network error. Failed to update maintenance settings.');
        } finally {
            setSaveLoading(false);
        }
    };

    // Try to auto-login if password was saved in session storage
    useEffect(() => {
        const savedPass = sessionStorage.getItem('dev_auth_pass');
        if (savedPass) {
            verifyPassword(savedPass);
        }
    }, []);

    const verifyPassword = async (passToVerify: string) => {
        setLoading(true);
        setErrorMsg('');
        try {
            // Fetch feature requests and deletion logs in parallel
            const [reqRes, delRes] = await Promise.all([
                fetch('/api/developer/requests', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: passToVerify })
                }),
                fetch('/api/developer/deletion-logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password: passToVerify })
                })
            ]);

            const [reqData, delData] = await Promise.all([reqRes.json(), delRes.json()]);

            if (reqData.success) {
                setIsAuthenticated(true);
                setRequests(reqData.data || []);
                setDeletionLogs(delData.data || []);
                sessionStorage.setItem('dev_auth_pass', passToVerify);
                setPassword(passToVerify);
            } else {
                setErrorMsg(reqData.error || 'Invalid password.');
                sessionStorage.removeItem('dev_auth_pass');
            }
        } catch {
            setErrorMsg('Failed to connect to verification server.');
        } finally {
            setLoading(false);
        }
    };

    const handleLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) {
            setErrorMsg('Password cannot be empty.');
            return;
        }
        verifyPassword(password);
    };

    const handleLogout = () => {
        sessionStorage.removeItem('dev_auth_pass');
        setIsAuthenticated(false);
        setRequests([]);
        setDeletionLogs([]);
        setSelectedLog(null);
        setPassword('');
        setErrorMsg('');
        setSuccessMsg('');
    };

    const handleStatusUpdate = async (requestId: string, newStatus: string) => {
        setActionLoading(requestId);
        setErrorMsg('');
        setSuccessMsg('');
        try {
            const res = await fetch('/api/developer/requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, requestId, newStatus })
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMsg(`Request successfully marked as ${newStatus}.`);
                verifyPassword(password);
            } else {
                setErrorMsg(data.error || 'Failed to update status.');
            }
        } catch {
            setErrorMsg('Network error. Failed to update status.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRefresh = () => {
        if (password) {
            verifyPassword(password);
        }
    };

    const handleRestoreUser = async () => {
        if (!restoreTargetLog || !restorePassword.trim()) {
            setRestoreError('Please enter an authorized security password.');
            return;
        }
        setRestoring(true);
        setRestoreError('');
        try {
            const res = await fetch(`/api/developer/deletion-logs/${restoreTargetLog._id}/restore`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: restorePassword })
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMsg(data.message || 'User restored successfully!');
                setRestoreTargetLog(null);
                setRestorePassword('');
                verifyPassword(password);
            } else {
                setRestoreError(data.error || 'Failed to restore user.');
            }
        } catch {
            setRestoreError('Network error. Failed to restore user.');
        } finally {
            setRestoring(false);
        }
    };

    // Filter deletion logs based on search text and type
    const filteredDeletionLogs = useMemo(() => {
        return deletionLogs.filter((log) => {
            if (deletionTypeFilter !== 'ALL' && log.deletionType !== deletionTypeFilter) {
                return false;
            }
            if (!deletionSearch.trim()) return true;

            const q = deletionSearch.toLowerCase();
            const snap = log.userSnapshot || {};
            const fullName = `${snap.firstName || ''} ${snap.lastName || ''}`.toLowerCase();
            const tgId = String(snap.telegramId || '').toLowerCase();
            const tgUsername = String(snap.telegramUsername || '').toLowerCase();
            const refCode = String(snap.referralCode || '').toLowerCase();
            const adminEmail = String(log.deletedBy?.email || '').toLowerCase();
            const adminName = String(log.deletedBy?.name || '').toLowerCase();
            const ip = String(log.ip || '').toLowerCase();

            return (
                fullName.includes(q) ||
                tgId.includes(q) ||
                tgUsername.includes(q) ||
                refCode.includes(q) ||
                adminEmail.includes(q) ||
                adminName.includes(q) ||
                ip.includes(q)
            );
        });
    }, [deletionLogs, deletionSearch, deletionTypeFilter]);

    // Financial calculations for summary statistics
    const deletionStats = useMemo(() => {
        let totalTP = 0;
        let totalReinvest = 0;
        let totalCompletedWithdrawals = 0;

        for (const log of deletionLogs) {
            totalTP += Number(log.userSnapshot?.tradePower) || 0;
            totalReinvest += Number(log.userSnapshot?.totalReinvested) || 0;
            totalCompletedWithdrawals += Number(log.userSnapshot?.withdrawals?.totalCompletedAmount) || 0;
        }

        return {
            count: deletionLogs.length,
            totalTP,
            totalReinvest,
            totalCompletedWithdrawals
        };
    }, [deletionLogs]);

    // Portal / Login Screen
    if (!isAuthenticated) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    background: 'linear-gradient(135deg, #020617 0%, #0f172a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 2
                }}
            >
                <Card
                    elevation={24}
                    sx={{
                        maxWidth: 420,
                        width: '100%',
                        borderRadius: 6,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(16px)',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {/* Glow effect */}
                    <Box
                        sx={{
                            position: 'absolute',
                            top: -60,
                            right: -60,
                            width: 140,
                            height: 140,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%)',
                            zIndex: 0
                        }}
                    />

                    <CardContent sx={{ p: 4, position: 'relative', zIndex: 1 }}>
                        <Stack spacing={3} alignItems="center" sx={{ textAlign: 'center', mb: 3 }}>
                            <Box
                                sx={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: '50%',
                                    bgcolor: 'rgba(245, 158, 11, 0.1)',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 8px 20px rgba(245, 158, 11, 0.1)'
                                }}
                            >
                                <LockIcon sx={{ fontSize: 30, color: '#fbbf24' }} />
                            </Box>
                            <Box>
                                <Typography variant="h5" fontWeight={900} sx={{ color: 'white', letterSpacing: '-0.02em' }}>
                                    Developer Console
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#94a3b8', mt: 0.5, display: 'block' }}>
                                    Trade Edge Internal Audit & Management Console
                                </Typography>
                            </Box>
                        </Stack>

                        <form onSubmit={handleLoginSubmit}>
                            <Stack spacing={2.5}>
                                {errorMsg && (
                                    <Alert severity="error" variant="filled" sx={{ borderRadius: 2, fontSize: '0.8rem' }}>
                                        {errorMsg}
                                    </Alert>
                                )}

                                <TextField
                                    label="Developer Password"
                                    type={showPassword ? 'text' : 'password'}
                                    fullWidth
                                    variant="outlined"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            color: 'white',
                                            bgcolor: 'rgba(255, 255, 255, 0.03)',
                                            borderRadius: 3,
                                            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                                            '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.25)' },
                                            '&.Mui-focused fieldset': { borderColor: '#fbbf24' },
                                        },
                                        '& .MuiInputLabel-root': {
                                            color: '#64748b',
                                            '&.Mui-focused': { color: '#fbbf24' }
                                        }
                                    }}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    edge="end"
                                                    sx={{ color: '#64748b' }}
                                                >
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                <Button
                                    type="submit"
                                    variant="contained"
                                    fullWidth
                                    disabled={loading}
                                    sx={{
                                        py: 1.5,
                                        borderRadius: 3,
                                        fontWeight: 800,
                                        textTransform: 'none',
                                        bgcolor: '#fbbf24',
                                        color: '#0f172a',
                                        boxShadow: '0 8px 24px rgba(245, 158, 11, 0.25)',
                                        '&:hover': {
                                            bgcolor: '#f59e0b',
                                            transform: 'translateY(-1px)'
                                        },
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {loading ? <CircularProgress size={24} color="inherit" /> : 'Decrypt Console'}
                                </Button>
                            </Stack>
                        </form>
                    </CardContent>
                </Card>
            </Box>
        );
    }

    // Main Dashboard View (Authenticated)
    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#020617', color: 'white', py: 5 }}>
            <Container maxWidth="xl">
                {/* Top Header */}
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} sx={{ mb: 4 }}>
                    <Box>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                            <IconButton onClick={handleLogout} sx={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', p: 1 }}>
                                <ArrowBackIcon fontSize="small" />
                            </IconButton>
                            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.03em' }}>
                                Developer Control Console
                            </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Inspect user deletion audit trails, financial snapshots, license requests, and platform maintenance.
                        </Typography>
                    </Box>

                    <Stack direction="row" spacing={1.5}>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={handleRefresh}
                            disabled={loading}
                            sx={{
                                borderRadius: 3,
                                textTransform: 'none',
                                fontWeight: 700,
                                borderColor: 'rgba(255,255,255,0.12)',
                                color: '#cbd5e1',
                                '&:hover': {
                                    borderColor: 'rgba(255,255,255,0.25)',
                                    bgcolor: 'rgba(255,255,255,0.03)'
                                }
                            }}
                        >
                            Refresh Data
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleLogout}
                            sx={{
                                borderRadius: 3,
                                textTransform: 'none',
                                fontWeight: 700,
                                bgcolor: '#ef4444',
                                color: 'white',
                                '&:hover': { bgcolor: '#dc2626' }
                            }}
                        >
                            Lock Console
                        </Button>
                    </Stack>
                </Stack>

                {/* Notifications */}
                {errorMsg && (
                    <Alert severity="error" variant="filled" sx={{ borderRadius: 3, mb: 3 }}>
                        {errorMsg}
                    </Alert>
                )}
                {successMsg && (
                    <Alert severity="success" variant="filled" sx={{ borderRadius: 3, mb: 3 }}>
                        {successMsg}
                    </Alert>
                )}

                {/* Navigation Tabs */}
                <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', mb: 4 }}>
                    <Tabs
                        value={activeTab}
                        onChange={(_, val) => setActiveTab(val)}
                        sx={{
                            '& .MuiTabs-indicator': { bgcolor: '#fbbf24', height: 3, borderRadius: '3px 3px 0 0' },
                            '& .MuiTab-root': {
                                color: '#64748b',
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: '0.95rem',
                                py: 1.5,
                                px: 3,
                                '&.Mui-selected': { color: '#fbbf24' }
                            }
                        }}
                    >
                        <Tab
                            value="deletions"
                            icon={<DeleteForeverIcon sx={{ fontSize: 20 }} />}
                            iconPosition="start"
                            label={
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <span>User Deletion Audit Logs</span>
                                    <Chip
                                        label={deletionLogs.length}
                                        size="small"
                                        sx={{
                                            height: 20,
                                            fontSize: '0.7rem',
                                            fontWeight: 800,
                                            bgcolor: 'rgba(239, 68, 68, 0.15)',
                                            color: '#f87171'
                                        }}
                                    />
                                </Stack>
                            }
                        />
                        <Tab
                            value="requests"
                            icon={<AutoAwesomeIcon sx={{ fontSize: 20 }} />}
                            iconPosition="start"
                            label={
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <span>Feature & License Activations</span>
                                    <Chip
                                        label={requests.length}
                                        size="small"
                                        sx={{
                                            height: 20,
                                            fontSize: '0.7rem',
                                            fontWeight: 800,
                                            bgcolor: 'rgba(251, 191, 36, 0.15)',
                                            color: '#fbbf24'
                                        }}
                                    />
                                </Stack>
                            }
                        />
                    </Tabs>
                </Box>

                {/* Platform Maintenance Control Card (Collapsible Summary) */}
                <Card
                    elevation={0}
                    sx={{
                        borderRadius: 4,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(15, 23, 42, 0.4)',
                        backdropFilter: 'blur(12px)',
                        p: 2.5,
                        mb: 4
                    }}
                >
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                        <Box>
                            <Typography variant="subtitle1" fontWeight={800} sx={{ color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
                                🔧 Platform Maintenance Mode
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                Blocks all client Telegram sessions with an update splash screen during major system upgrades.
                            </Typography>
                        </Box>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={maintenanceMode}
                                        onChange={(e) => setMaintenanceMode(e.target.checked)}
                                        color="warning"
                                        disabled={saveLoading}
                                    />
                                }
                                label={
                                    <Typography variant="body2" fontWeight={700} sx={{ color: maintenanceMode ? '#fbbf24' : '#94a3b8' }}>
                                        {maintenanceMode ? 'Active (Locked)' : 'Inactive (Live)'}
                                    </Typography>
                                }
                            />
                            <TextField
                                label="Estimated Down Time"
                                size="small"
                                variant="outlined"
                                value={estDuration}
                                onChange={(e) => setEstDuration(e.target.value)}
                                placeholder="e.g. 30 mins"
                                disabled={saveLoading}
                                sx={{
                                    width: { xs: '100%', sm: 180 },
                                    '& .MuiOutlinedInput-root': {
                                        color: 'white',
                                        bgcolor: 'rgba(255, 255, 255, 0.03)',
                                        borderRadius: 2,
                                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                                    }
                                }}
                            />
                            <Button
                                variant="contained"
                                size="small"
                                onClick={handleSaveMaintenance}
                                disabled={saveLoading}
                                sx={{
                                    borderRadius: 2,
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    bgcolor: '#fbbf24',
                                    color: '#0f172a',
                                    px: 2.5,
                                    '&:hover': { bgcolor: '#f59e0b' }
                                }}
                            >
                                {saveLoading ? <CircularProgress size={16} color="inherit" /> : 'Apply'}
                            </Button>
                        </Stack>
                    </Stack>
                </Card>

                {/* TAB 1: DELETION LOGS */}
                {activeTab === 'deletions' && (
                    <Box>
                        {/* Summary Metric Cards */}
                        <Grid container spacing={2.5} sx={{ mb: 4 }}>
                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                <Card sx={{ bgcolor: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 4, p: 2.5 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Box>
                                            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                                                Total Users Deleted
                                            </Typography>
                                            <Typography variant="h4" fontWeight={900} sx={{ color: '#f87171', mt: 0.5 }}>
                                                {deletionStats.count}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(239, 68, 68, 0.1)' }}>
                                            <DeleteForeverIcon sx={{ color: '#f87171', fontSize: 28 }} />
                                        </Box>
                                    </Stack>
                                </Card>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                <Card sx={{ bgcolor: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 4, p: 2.5 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Box>
                                            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                                                Trade Power Discarded
                                            </Typography>
                                            <Typography variant="h4" fontWeight={900} sx={{ color: '#fbbf24', mt: 0.5 }}>
                                                ${deletionStats.totalTP.toLocaleString()} <Typography component="span" variant="caption" sx={{ color: '#94a3b8' }}>USDT</Typography>
                                            </Typography>
                                        </Box>
                                        <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(251, 191, 36, 0.1)' }}>
                                            <MonetizationOnIcon sx={{ color: '#fbbf24', fontSize: 28 }} />
                                        </Box>
                                    </Stack>
                                </Card>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                <Card sx={{ bgcolor: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 4, p: 2.5 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Box>
                                            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                                                Historical Withdrawals
                                            </Typography>
                                            <Typography variant="h4" fontWeight={900} sx={{ color: '#60a5fa', mt: 0.5 }}>
                                                ${deletionStats.totalCompletedWithdrawals.toFixed(2)}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(59, 130, 246, 0.1)' }}>
                                            <AccountCircleIcon sx={{ color: '#60a5fa', fontSize: 28 }} />
                                        </Box>
                                    </Stack>
                                </Card>
                            </Grid>

                            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                <Card sx={{ bgcolor: 'rgba(15, 23, 42, 0.5)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 4, p: 2.5 }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Box>
                                            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
                                                Reinvested Volume
                                            </Typography>
                                            <Typography variant="h4" fontWeight={900} sx={{ color: '#4ade80', mt: 0.5 }}>
                                                ${deletionStats.totalReinvest.toLocaleString()}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ p: 1.5, borderRadius: 3, bgcolor: 'rgba(34, 197, 94, 0.1)' }}>
                                            <AccountTreeIcon sx={{ color: '#4ade80', fontSize: 28 }} />
                                        </Box>
                                    </Stack>
                                </Card>
                            </Grid>
                        </Grid>

                        {/* Filter and Search Bar */}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }} alignItems="center">
                            <TextField
                                size="small"
                                fullWidth
                                placeholder="Search by name, Telegram ID, referral code, admin email, IP..."
                                value={deletionSearch}
                                onChange={(e) => setDeletionSearch(e.target.value)}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ color: '#64748b' }} />
                                        </InputAdornment>
                                    )
                                }}
                                sx={{
                                    maxWidth: { sm: 460 },
                                    '& .MuiOutlinedInput-root': {
                                        color: 'white',
                                        bgcolor: 'rgba(15, 23, 42, 0.6)',
                                        borderRadius: 3,
                                        '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.1)' },
                                        '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                                        '&.Mui-focused fieldset': { borderColor: '#fbbf24' },
                                    }
                                }}
                            />

                            <Stack direction="row" spacing={1}>
                                {(['ALL', 'PERMANENT', 'SOFT'] as const).map((type) => (
                                    <Chip
                                        key={type}
                                        label={type === 'ALL' ? 'All Types' : type}
                                        clickable
                                        onClick={() => setDeletionTypeFilter(type)}
                                        sx={{
                                            fontWeight: 700,
                                            fontSize: '0.75rem',
                                            borderRadius: 2,
                                            bgcolor: deletionTypeFilter === type ? '#fbbf24' : 'rgba(255,255,255,0.05)',
                                            color: deletionTypeFilter === type ? '#0f172a' : '#94a3b8',
                                            border: '1px solid',
                                            borderColor: deletionTypeFilter === type ? '#fbbf24' : 'rgba(255,255,255,0.08)',
                                            '&:hover': {
                                                bgcolor: deletionTypeFilter === type ? '#f59e0b' : 'rgba(255,255,255,0.1)'
                                            }
                                        }}
                                    />
                                ))}
                            </Stack>
                        </Stack>

                        {/* Deletions Table */}
                        <Card
                            elevation={0}
                            sx={{
                                borderRadius: 5,
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                background: 'rgba(15, 23, 42, 0.4)',
                                backdropFilter: 'blur(12px)',
                                overflow: 'hidden'
                            }}
                        >
                            <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
                                <Table sx={{ minWidth: 950 }}>
                                    <TableHead>
                                        <TableRow sx={{ borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                                            <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Deletion Date & Type</TableCell>
                                            <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Deleted User Profile</TableCell>
                                            <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Trade Power & Reinvest</TableCell>
                                            <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Withdrawals</TableCell>
                                            <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Referral Tree</TableCell>
                                            <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Admin & IP Trace</TableCell>
                                            <TableCell align="right" sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Snapshot</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {filteredDeletionLogs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} align="center" sx={{ py: 8, color: '#64748b' }}>
                                                    <DeleteForeverIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                                                    <Typography variant="body1" fontWeight={600}>
                                                        No deletion log records found
                                                    </Typography>
                                                    <Typography variant="caption">
                                                        Records will automatically appear here when users are deleted from the admin panel.
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredDeletionLogs.map((log) => {
                                                const snap = log.userSnapshot || {};
                                                const withdrawals = snap.withdrawals || { totalCompletedAmount: 0, totalCompletedCount: 0, totalRequestedAmount: 0, totalPendingAmount: 0 };
                                                const ref = snap.referral || { directReferralCount: 0, totalDownlineCount: 0 };

                                                return (
                                                    <TableRow
                                                        key={log._id}
                                                        sx={{
                                                            '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' },
                                                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                                                            transition: 'background-color 0.2s'
                                                        }}
                                                    >
                                                        {/* Deletion Date & Type */}
                                                        <TableCell sx={{ color: '#94a3b8' }}>
                                                            <Chip
                                                                label={log.deletionType}
                                                                size="small"
                                                                sx={{
                                                                    mb: 0.8,
                                                                    fontWeight: 800,
                                                                    fontSize: '0.65rem',
                                                                    bgcolor: log.deletionType === 'PERMANENT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                                                    color: log.deletionType === 'PERMANENT' ? '#f87171' : '#fbbf24',
                                                                    border: '1px solid',
                                                                    borderColor: log.deletionType === 'PERMANENT' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'
                                                                }}
                                                            />
                                                            <Typography variant="body2" fontWeight={600} sx={{ color: '#cbd5e1' }}>
                                                                {new Date(log.deletedAt).toLocaleDateString()}
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                                {new Date(log.deletedAt).toLocaleTimeString()}
                                                            </Typography>
                                                        </TableCell>

                                                        {/* Deleted User */}
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight={800} sx={{ color: 'white' }}>
                                                                {snap.firstName || 'Unnamed'} {snap.lastName || ''}
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ color: '#fbbf24', display: 'block', fontWeight: 600 }}>
                                                                TG ID: {snap.telegramId}
                                                            </Typography>
                                                            {snap.telegramUsername && (
                                                                <Typography variant="caption" sx={{ color: '#60a5fa', display: 'block' }}>
                                                                    @{snap.telegramUsername}
                                                                </Typography>
                                                            )}
                                                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.7rem' }}>
                                                                Ref: {snap.referralCode}
                                                            </Typography>
                                                        </TableCell>

                                                        {/* Trade Power & Reinvest */}
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight={850} sx={{ color: '#4ade80' }}>
                                                                ${(snap.tradePower || 0).toLocaleString()} <Typography component="span" variant="caption" sx={{ color: '#94a3b8' }}>TP</Typography>
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                                                                Reinvest: <strong style={{ color: '#facc15' }}>${(snap.totalReinvested || 0).toLocaleString()}</strong>
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                                Wallet: ${snap.walletBalance?.toFixed(2) || '0.00'}
                                                            </Typography>
                                                        </TableCell>

                                                        {/* Withdrawals */}
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight={750} sx={{ color: '#38bdf8' }}>
                                                                ${(withdrawals.totalCompletedAmount || 0).toFixed(2)} <Typography component="span" variant="caption" sx={{ color: '#94a3b8' }}>paid</Typography>
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                                                                {withdrawals.totalCompletedCount || 0} completed / {withdrawals.totalRequestedAmount ? `$${withdrawals.totalRequestedAmount.toFixed(2)} req` : '0 req'}
                                                            </Typography>
                                                            {withdrawals.totalPendingAmount > 0 && (
                                                                <Typography variant="caption" sx={{ color: '#fbbf24', display: 'block', fontWeight: 600 }}>
                                                                    ${withdrawals.totalPendingAmount.toFixed(2)} pending
                                                                </Typography>
                                                            )}
                                                        </TableCell>

                                                        {/* Referral Tree */}
                                                        <TableCell>
                                                            <Typography variant="body2" sx={{ color: '#cbd5e1', fontWeight: 600 }}>
                                                                {ref.referrerName ? ref.referrerName : (ref.referredById ? 'Upline ID Linked' : 'No Referrer')}
                                                            </Typography>
                                                            {ref.referrerTelegramId && (
                                                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                                    TG: {ref.referrerTelegramId}
                                                                </Typography>
                                                            )}
                                                            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>
                                                                Downlines: {ref.directReferralCount || 0} direct / {ref.totalDownlineCount || 0} total
                                                            </Typography>
                                                        </TableCell>

                                                        {/* Admin & IP Trace */}
                                                        <TableCell>
                                                            <Typography variant="body2" fontWeight={700} sx={{ color: 'white' }}>
                                                                {log.deletedBy?.name || log.deletedBy?.email || 'Admin'}
                                                            </Typography>
                                                            {log.authorizedByPassword && (
                                                                <Chip
                                                                    label={`🔑 ${log.authorizedByPassword.personName}`}
                                                                    size="small"
                                                                    sx={{
                                                                        my: 0.3,
                                                                        height: 18,
                                                                        fontSize: '0.65rem',
                                                                        fontWeight: 800,
                                                                        bgcolor: 'rgba(251, 191, 36, 0.15)',
                                                                        color: '#fbbf24',
                                                                        border: '1px solid rgba(251, 191, 36, 0.3)'
                                                                    }}
                                                                />
                                                            )}
                                                            <Typography variant="caption" sx={{ color: '#fbbf24', display: 'block', fontWeight: 600 }}>
                                                                IP: {log.ip || 'Unknown'}
                                                            </Typography>
                                                            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.3 }}>
                                                                <DevicesIcon sx={{ fontSize: 13, color: '#64748b' }} />
                                                                <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                                                                    {log.device || 'Unknown Device'}
                                                                </Typography>
                                                            </Stack>
                                                        </TableCell>

                                                        {/* Actions: Restore & Details */}
                                                        <TableCell align="right">
                                                            <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                                                                {log.isRestored ? (
                                                                    <Chip
                                                                        label="✅ Restored"
                                                                        size="small"
                                                                        sx={{
                                                                            height: 24,
                                                                            fontSize: '0.7rem',
                                                                            fontWeight: 800,
                                                                            bgcolor: 'rgba(34, 197, 94, 0.15)',
                                                                            color: '#4ade80',
                                                                            border: '1px solid rgba(34, 197, 94, 0.3)'
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <Button
                                                                        variant="contained"
                                                                        size="small"
                                                                        startIcon={<SettingsBackupRestoreIcon sx={{ fontSize: 15 }} />}
                                                                        onClick={() => {
                                                                            setRestoreTargetLog(log);
                                                                            setRestorePassword('');
                                                                            setRestoreError('');
                                                                        }}
                                                                        sx={{
                                                                            borderRadius: 2,
                                                                            textTransform: 'none',
                                                                            fontWeight: 800,
                                                                            fontSize: '0.75rem',
                                                                            bgcolor: '#f59e0b',
                                                                            color: '#000',
                                                                            '&:hover': { bgcolor: '#d97706' }
                                                                        }}
                                                                    >
                                                                        Restore
                                                                    </Button>
                                                                )}
                                                                <Button
                                                                    variant="outlined"
                                                                    size="small"
                                                                    startIcon={<InfoOutlinedIcon sx={{ fontSize: 16 }} />}
                                                                    onClick={() => setSelectedLog(log)}
                                                                    sx={{
                                                                        borderRadius: 2,
                                                                        textTransform: 'none',
                                                                        fontWeight: 700,
                                                                        fontSize: '0.75rem',
                                                                        borderColor: 'rgba(255,255,255,0.15)',
                                                                        color: '#f8fafc',
                                                                        '&:hover': {
                                                                            borderColor: '#fbbf24',
                                                                            bgcolor: 'rgba(251, 191, 36, 0.05)',
                                                                            color: '#fbbf24'
                                                                        }
                                                                    }}
                                                                >
                                                                    Details
                                                                </Button>
                                                            </Stack>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Card>
                    </Box>
                )}

                {/* TAB 2: FEATURE ACTIVATIONS */}
                {activeTab === 'requests' && (
                    <Box>
                        <Card
                            elevation={0}
                            sx={{
                                borderRadius: 5,
                                border: '1px solid rgba(255, 255, 255, 0.08)',
                                background: 'rgba(15, 23, 42, 0.4)',
                                backdropFilter: 'blur(12px)',
                                overflow: 'hidden'
                            }}
                        >
                            <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
                                <Table sx={{ minWidth: 650 }}>
                                    <TableHead>
                                        <TableRow sx={{ borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                                            <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Requested Date</TableCell>
                                            <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Feature Details</TableCell>
                                            <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Admin Details</TableCell>
                                            <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Licensing Fee</TableCell>
                                            <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</TableCell>
                                            <TableCell align="right" sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {requests.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center" sx={{ py: 8, color: '#64748b' }}>
                                                    <HistoryIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                                                    <Typography variant="body1" fontWeight={600}>
                                                        No activation tickets found
                                                    </Typography>
                                                    <Typography variant="caption">
                                                        New requests will appear here automatically when administrators click Activate.
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            requests.map((req) => (
                                                <TableRow key={req._id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' }, borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background-color 0.2s' }}>
                                                    <TableCell sx={{ color: '#94a3b8' }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                            {new Date(req.createdAt).toLocaleDateString()}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                                                            {new Date(req.createdAt).toLocaleTimeString()}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={850} sx={{ color: '#fbbf24' }}>
                                                            {req.featureTitle}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="body2" fontWeight={700} sx={{ color: 'white' }}>
                                                            {req.fullName}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                            {req.email}
                                                        </Typography>
                                                        {req.requestedBy && (
                                                            <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.5 }}>
                                                                User ID: {req.requestedBy}
                                                            </Typography>
                                                        )}
                                                        {req.ipAddress && (
                                                            <Typography variant="caption" sx={{ color: '#fbbf24', display: 'block', mt: 0.5, fontWeight: 600 }}>
                                                                IP: {req.ipAddress}
                                                            </Typography>
                                                        )}
                                                        {req.deviceInfo && (
                                                            <Typography variant="caption" sx={{ color: '#475569', display: 'block', fontSize: '0.65rem', mt: 0.2 }}>
                                                                {req.deviceInfo.substring(0, 50)}...
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                    <TableCell sx={{ color: 'white', fontWeight: 750 }}>
                                                        {req.price}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={req.status}
                                                            size="small"
                                                            sx={{
                                                                fontWeight: 700,
                                                                fontSize: '0.65rem',
                                                                textTransform: 'uppercase',
                                                                bgcolor: req.status === 'activation requested' 
                                                                    ? 'rgba(245, 158, 11, 0.12)' 
                                                                    : req.status === 'clicked'
                                                                        ? 'rgba(59, 130, 246, 0.12)'
                                                                        : 'rgba(22, 163, 74, 0.12)',
                                                                color: req.status === 'activation requested' 
                                                                    ? '#fbbf24' 
                                                                    : req.status === 'clicked'
                                                                        ? '#60a5fa'
                                                                        : '#22c55e',
                                                                border: req.status === 'activation requested' 
                                                                    ? '1px solid rgba(245, 158, 11, 0.25)' 
                                                                    : req.status === 'clicked'
                                                                        ? '1px solid rgba(59, 130, 246, 0.25)'
                                                                        : '1px solid rgba(22, 163, 74, 0.25)'
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {req.status === 'activation requested' ? (
                                                            <Button
                                                                variant="contained"
                                                                size="small"
                                                                startIcon={actionLoading === req._id ? <CircularProgress size={14} color="inherit" /> : <CheckCircleOutlineIcon />}
                                                                disabled={actionLoading !== null}
                                                                onClick={() => handleStatusUpdate(req._id, 'activated')}
                                                                sx={{
                                                                    borderRadius: 2,
                                                                    textTransform: 'none',
                                                                    fontWeight: 700,
                                                                    bgcolor: '#22c55e',
                                                                    color: '#020617',
                                                                    '&:hover': { bgcolor: '#16a34a' }
                                                                }}
                                                            >
                                                                Approve & Active
                                                            </Button>
                                                        ) : (
                                                            <Typography variant="caption" sx={{ color: '#475569', fontStyle: 'italic' }}>
                                                                No Actions Available
                                                            </Typography>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Card>
                    </Box>
                )}

                {/* SNAPSHOT DETAIL DIALOG */}
                {selectedLog && (
                    <Dialog
                        open={Boolean(selectedLog)}
                        onClose={() => setSelectedLog(null)}
                        maxWidth="md"
                        fullWidth
                        PaperProps={{
                            sx: {
                                bgcolor: '#0b132b',
                                color: 'white',
                                borderRadius: 5,
                                border: '1px solid rgba(255,255,255,0.1)',
                                boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
                                p: 1
                            }
                        }}
                    >
                        <DialogTitle sx={{ pb: 1 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Box sx={{ p: 1, borderRadius: 2, bgcolor: selectedLog.deletionType === 'PERMANENT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)' }}>
                                        <DeleteForeverIcon sx={{ color: selectedLog.deletionType === 'PERMANENT' ? '#f87171' : '#fbbf24', fontSize: 24 }} />
                                    </Box>
                                    <Box>
                                        <Typography variant="h6" fontWeight={850}>
                                            User Deletion Audit Snapshot
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                            Captured at: {new Date(selectedLog.deletedAt).toLocaleString()} ({selectedLog.deletionType} DELETION)
                                        </Typography>
                                    </Box>
                                </Stack>
                                <IconButton onClick={() => setSelectedLog(null)} sx={{ color: '#64748b' }}>
                                    <CloseIcon />
                                </IconButton>
                            </Stack>
                        </DialogTitle>

                        <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.08)', py: 3 }}>
                            {selectedLog.isRestored && (
                                <Alert
                                    severity="success"
                                    icon={<CheckCircleOutlineIcon sx={{ color: '#4ade80' }} />}
                                    sx={{
                                        mb: 3,
                                        bgcolor: 'rgba(34, 197, 94, 0.1)',
                                        color: '#4ade80',
                                        border: '1px solid rgba(34, 197, 94, 0.3)',
                                        borderRadius: 2.5
                                    }}
                                >
                                    <Typography variant="body2" fontWeight={800}>
                                        ✅ Account Successfully Restored on {new Date(selectedLog.restoredAt || '').toLocaleString()}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#86efac', display: 'block', mt: 0.3 }}>
                                        Authorized Person: {selectedLog.restoredByPassword?.personName || selectedLog.restoredBy?.name || 'Admin'}
                                        {selectedLog.restorationNotes ? ` — ${selectedLog.restorationNotes}` : ''}
                                    </Typography>
                                </Alert>
                            )}

                            <Grid container spacing={3}>
                                {/* User Identity Card */}
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3, p: 2 }}>
                                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#fbbf24', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <AccountCircleIcon fontSize="small" /> User Identification
                                        </Typography>
                                        <Stack spacing={1}>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Full Name:</Typography>
                                                <Typography variant="body2" fontWeight={700}>
                                                    {selectedLog.userSnapshot?.firstName} {selectedLog.userSnapshot?.lastName || ''}
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Telegram ID:</Typography>
                                                <Typography variant="body2" fontWeight={700} sx={{ color: '#60a5fa' }}>
                                                    {selectedLog.userSnapshot?.telegramId}
                                                </Typography>
                                            </Stack>
                                            {selectedLog.userSnapshot?.telegramUsername && (
                                                <Stack direction="row" justifyContent="space-between">
                                                    <Typography variant="caption" sx={{ color: '#64748b' }}>Username:</Typography>
                                                    <Typography variant="body2" fontWeight={600}>
                                                        @{selectedLog.userSnapshot.telegramUsername}
                                                    </Typography>
                                                </Stack>
                                            )}
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Referral Code:</Typography>
                                                <Typography variant="body2" fontWeight={700} sx={{ color: '#f59e0b' }}>
                                                    {selectedLog.userSnapshot?.referralCode}
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Account Created:</Typography>
                                                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                                    {selectedLog.userSnapshot?.userCreatedAt ? new Date(selectedLog.userSnapshot.userCreatedAt).toLocaleDateString() : 'N/A'}
                                                </Typography>
                                            </Stack>
                                        </Stack>
                                    </Card>
                                </Grid>

                                {/* Financials & Trade Power Snapshot */}
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3, p: 2 }}>
                                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#4ade80', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <MonetizationOnIcon fontSize="small" /> Financial Balances & Trade Power
                                        </Typography>
                                        <Stack spacing={1}>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Trade Power at Deletion:</Typography>
                                                <Typography variant="body2" fontWeight={800} sx={{ color: '#4ade80' }}>
                                                    ${(selectedLog.userSnapshot?.tradePower || 0).toLocaleString()} USDT
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Total Reinvested Amount:</Typography>
                                                <Typography variant="body2" fontWeight={700} sx={{ color: '#facc15' }}>
                                                    ${(selectedLog.userSnapshot?.totalReinvested || 0).toLocaleString()} USDT
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Main Wallet Balance:</Typography>
                                                <Typography variant="body2" fontWeight={700}>
                                                    ${selectedLog.userSnapshot?.walletBalance?.toFixed(3) || '0.000'} USDT
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Referral Wallet Balance:</Typography>
                                                <Typography variant="body2" fontWeight={700}>
                                                    ${selectedLog.userSnapshot?.referralWalletBalance?.toFixed(3) || '0.000'} USDT
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Active Plans Count:</Typography>
                                                <Typography variant="caption" sx={{ color: '#cbd5e1', fontWeight: 600 }}>
                                                    {selectedLog.userSnapshot?.activePlansCount || 0} active / {selectedLog.userSnapshot?.totalPlansCount || 0} total
                                                </Typography>
                                            </Stack>
                                        </Stack>
                                    </Card>
                                </Grid>

                                {/* Detailed Active Plans Snapshot */}
                                {selectedLog.userSnapshot?.activePlansSnapshot && selectedLog.userSnapshot.activePlansSnapshot.length > 0 && (
                                    <Grid size={{ xs: 12 }}>
                                        <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3, p: 2 }}>
                                            <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#38bdf8', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <AutoAwesomeIcon fontSize="small" /> Active Plans Snapshot & Remaining Lifespan
                                            </Typography>
                                            <Grid container spacing={1.5}>
                                                {selectedLog.userSnapshot.activePlansSnapshot.map((plan, pIdx) => (
                                                    <Grid size={{ xs: 12, md: 6 }} key={pIdx}>
                                                        <Paper sx={{ p: 1.5, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2 }}>
                                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                                <Typography variant="body2" fontWeight={800} sx={{ color: '#f8fafc' }}>
                                                                    {plan.planName || (plan.isReinvest ? 'Reinvestment Plan' : 'Standard Plan')}
                                                                </Typography>
                                                                <Chip
                                                                    label={`$${plan.amount} USDT`}
                                                                    size="small"
                                                                    sx={{ bgcolor: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 800 }}
                                                                />
                                                            </Stack>
                                                            <Stack spacing={0.5} sx={{ mt: 1 }}>
                                                                <Stack direction="row" justifyContent="space-between">
                                                                    <Typography variant="caption" sx={{ color: '#64748b' }}>Daily ROI Rate:</Typography>
                                                                    <Typography variant="caption" fontWeight={700} sx={{ color: '#4ade80' }}>
                                                                        {(plan.dailyRoiRate * 100).toFixed(2)}% (${(plan.amount * plan.dailyRoiRate).toFixed(3)}/day)
                                                                    </Typography>
                                                                </Stack>
                                                                <Stack direction="row" justifyContent="space-between">
                                                                    <Typography variant="caption" sx={{ color: '#64748b' }}>Completed ROI Days:</Typography>
                                                                    <Typography variant="caption" fontWeight={700} sx={{ color: '#cbd5e1' }}>
                                                                        {plan.completedRoiDays} days (${plan.totalRoiPaid?.toFixed(2)} paid)
                                                                    </Typography>
                                                                </Stack>
                                                                <Stack direction="row" justifyContent="space-between">
                                                                    <Typography variant="caption" sx={{ color: '#64748b' }}>Remaining Lifespan:</Typography>
                                                                    <Typography variant="caption" fontWeight={800} sx={{ color: '#fbbf24' }}>
                                                                        {plan.remainingDurationDays} days left
                                                                    </Typography>
                                                                </Stack>
                                                            </Stack>
                                                        </Paper>
                                                    </Grid>
                                                ))}
                                            </Grid>
                                        </Card>
                                    </Grid>
                                )}

                                {/* Pending Withdrawals Snapshot */}
                                {selectedLog.userSnapshot?.pendingWithdrawalsSnapshot && selectedLog.userSnapshot.pendingWithdrawalsSnapshot.length > 0 && (
                                    <Grid size={{ xs: 12 }}>
                                        <Card sx={{ bgcolor: 'rgba(245, 158, 11, 0.04)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 3, p: 2 }}>
                                            <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#fbbf24', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <MonetizationOnIcon fontSize="small" /> Pending Withdrawal Requests at Deletion ({selectedLog.userSnapshot.pendingWithdrawalsSnapshot.length})
                                            </Typography>
                                            <Stack spacing={1}>
                                                {selectedLog.userSnapshot.pendingWithdrawalsSnapshot.map((w, wIdx) => (
                                                    <Paper key={wIdx} sx={{ p: 1.5, bgcolor: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 2 }}>
                                                        <Stack direction="row" justifyContent="space-between">
                                                            <Typography variant="body2" fontWeight={800} sx={{ color: '#fbbf24' }}>
                                                                ${w.amount} USDT (Net: ${w.netAmount})
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                                                {new Date(w.createdAt).toLocaleString()}
                                                            </Typography>
                                                        </Stack>
                                                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontFamily: 'monospace', mt: 0.3 }}>
                                                            {w.network}: {w.walletAddress}
                                                        </Typography>
                                                    </Paper>
                                                ))}
                                            </Stack>
                                        </Card>
                                    </Grid>
                                )}

                                {/* Withdrawals Breakdown */}
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3, p: 2 }}>
                                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#38bdf8', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <MonetizationOnIcon fontSize="small" /> Withdrawals History
                                        </Typography>
                                        <Stack spacing={1}>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Total Completed Paid:</Typography>
                                                <Typography variant="body2" fontWeight={800} sx={{ color: '#38bdf8' }}>
                                                    ${(selectedLog.userSnapshot?.withdrawals?.totalCompletedAmount || 0).toFixed(2)} USDT
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Completed Tx Count:</Typography>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {selectedLog.userSnapshot?.withdrawals?.totalCompletedCount || 0} transactions
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Total Lifetime Requested:</Typography>
                                                <Typography variant="body2" fontWeight={600} sx={{ color: '#94a3b8' }}>
                                                    ${(selectedLog.userSnapshot?.withdrawals?.totalRequestedAmount || 0).toFixed(2)} USDT
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Pending at Deletion:</Typography>
                                                <Typography variant="body2" fontWeight={700} sx={{ color: selectedLog.userSnapshot?.withdrawals?.totalPendingAmount ? '#fbbf24' : '#64748b' }}>
                                                    ${(selectedLog.userSnapshot?.withdrawals?.totalPendingAmount || 0).toFixed(2)} USDT
                                                </Typography>
                                            </Stack>
                                        </Stack>
                                    </Card>
                                </Grid>

                                {/* Hierarchy & Referral Tree */}
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Card sx={{ bgcolor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3, p: 2 }}>
                                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#c084fc', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <AccountTreeIcon fontSize="small" /> Referral & Downline Structure
                                        </Typography>
                                        <Stack spacing={1}>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Referred By (Upline):</Typography>
                                                <Typography variant="body2" fontWeight={700} sx={{ color: '#e879f9' }}>
                                                    {selectedLog.userSnapshot?.referral?.referrerName || 'None / Direct'}
                                                </Typography>
                                            </Stack>
                                            {selectedLog.userSnapshot?.referral?.referrerTelegramId && (
                                                <Stack direction="row" justifyContent="space-between">
                                                    <Typography variant="caption" sx={{ color: '#64748b' }}>Upline TG ID:</Typography>
                                                    <Typography variant="caption" sx={{ color: '#cbd5e1' }}>
                                                        {selectedLog.userSnapshot.referral.referrerTelegramId}
                                                    </Typography>
                                                </Stack>
                                            )}
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Direct Referrals Count:</Typography>
                                                <Typography variant="body2" fontWeight={700}>
                                                    {selectedLog.userSnapshot?.referral?.directReferralCount || 0} users
                                                </Typography>
                                            </Stack>
                                            <Stack direction="row" justifyContent="space-between">
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Total Downline Count:</Typography>
                                                <Typography variant="body2" fontWeight={700}>
                                                    {selectedLog.userSnapshot?.referral?.totalDownlineCount || 0} users
                                                </Typography>
                                            </Stack>
                                        </Stack>
                                    </Card>
                                </Grid>

                                {/* Audit & Security Trace */}
                                <Grid size={{ xs: 12 }}>
                                    <Card sx={{ bgcolor: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: 3, p: 2 }}>
                                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#f87171', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <SecurityIcon fontSize="small" /> Execution Audit & Admin Security Trace
                                        </Typography>
                                        <Grid container spacing={2}>
                                            {selectedLog.authorizedByPassword && (
                                                <Grid size={{ xs: 12 }}>
                                                    <Paper sx={{ p: 1.5, bgcolor: 'rgba(251, 191, 36, 0.08)', border: '1px solid rgba(251, 191, 36, 0.25)', borderRadius: 2 }}>
                                                        <Typography variant="caption" sx={{ color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', display: 'block' }}>
                                                            🔑 Security Deletion Authorization Verified:
                                                        </Typography>
                                                        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 0.5 }}>
                                                            <Typography variant="body2" fontWeight={800} sx={{ color: 'white' }}>
                                                                Authorized Person: <span style={{ color: '#facc15' }}>{selectedLog.authorizedByPassword.personName}</span>
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                                                Key Used: <code style={{ color: '#fbbf24', background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: 4 }}>{selectedLog.authorizedByPassword.passwordKey}</code>
                                                            </Typography>
                                                        </Stack>
                                                    </Paper>
                                                </Grid>
                                            )}

                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Deleted By Admin:</Typography>
                                                <Typography variant="body2" fontWeight={700} sx={{ color: 'white' }}>
                                                    {selectedLog.deletedBy?.name || 'Admin'} ({selectedLog.deletedBy?.email || selectedLog.deletedBy?.adminId})
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#f87171' }}>
                                                    Role: {selectedLog.deletedBy?.role || 'admin'}
                                                </Typography>
                                            </Grid>

                                            <Grid size={{ xs: 12, sm: 6 }}>
                                                <Typography variant="caption" sx={{ color: '#64748b' }}>Network IP Address:</Typography>
                                                <Typography variant="body2" fontWeight={700} sx={{ color: '#fbbf24' }}>
                                                    {selectedLog.ip || 'Unknown'}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                                    Device: {selectedLog.device || 'Unknown'}
                                                </Typography>
                                            </Grid>

                                            <Grid size={{ xs: 12 }}>
                                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>User-Agent:</Typography>
                                                <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace', wordBreak: 'break-all', display: 'block', mt: 0.5, bgcolor: 'rgba(0,0,0,0.3)', p: 1, borderRadius: 1.5 }}>
                                                    {selectedLog.userAgent || 'N/A'}
                                                </Typography>
                                            </Grid>
                                        </Grid>
                                    </Card>
                                </Grid>
                            </Grid>
                        </DialogContent>

                        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
                            <Box>
                                {!selectedLog.isRestored && (
                                    <Button
                                        variant="contained"
                                        startIcon={<SettingsBackupRestoreIcon />}
                                        onClick={() => {
                                            const target = selectedLog;
                                            setSelectedLog(null);
                                            setRestoreTargetLog(target);
                                            setRestorePassword('');
                                            setRestoreError('');
                                        }}
                                        sx={{
                                            bgcolor: '#f59e0b',
                                            color: '#000',
                                            fontWeight: 800,
                                            borderRadius: 2.5,
                                            px: 3,
                                            '&:hover': { bgcolor: '#d97706' }
                                        }}
                                    >
                                        Restore This User
                                    </Button>
                                )}
                            </Box>
                            <Button
                                variant="contained"
                                onClick={() => setSelectedLog(null)}
                                sx={{
                                    bgcolor: 'rgba(255,255,255,0.08)',
                                    color: 'white',
                                    fontWeight: 700,
                                    borderRadius: 2.5,
                                    px: 3,
                                    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' }
                                }}
                            >
                                Close
                            </Button>
                        </DialogActions>
                    </Dialog>
                )}

                {/* RESTORE USER CONFIRMATION & SECURITY AUTHORIZATION DIALOG */}
                {restoreTargetLog && (
                    <Dialog
                        open={Boolean(restoreTargetLog)}
                        onClose={() => !restoring && setRestoreTargetLog(null)}
                        maxWidth="sm"
                        fullWidth
                        PaperProps={{
                            sx: {
                                bgcolor: '#0b132b',
                                color: 'white',
                                borderRadius: 4,
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                boxShadow: '0 25px 60px rgba(0,0,0,0.9)',
                                p: 1
                            }
                        }}
                    >
                        <DialogTitle>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Box sx={{ p: 1, borderRadius: 2, bgcolor: 'rgba(245, 158, 11, 0.15)' }}>
                                    <SettingsBackupRestoreIcon sx={{ color: '#fbbf24', fontSize: 24 }} />
                                </Box>
                                <Box>
                                    <Typography variant="h6" fontWeight={850}>
                                        Restore User Account
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                        Re-activate and resume investment plans from today
                                    </Typography>
                                </Box>
                            </Stack>
                        </DialogTitle>

                        <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.08)', py: 2.5 }}>
                            {restoreError && (
                                <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                    {restoreError}
                                </Alert>
                            )}

                            <Paper sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, mb: 2.5 }}>
                                <Typography variant="caption" sx={{ color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase' }}>
                                    Snapshot Details To Restore:
                                </Typography>
                                <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                                    <Grid size={{ xs: 6 }}>
                                        <Typography variant="caption" sx={{ color: '#64748b' }}>User Name:</Typography>
                                        <Typography variant="body2" fontWeight={700}>
                                            {restoreTargetLog.userSnapshot?.firstName} {restoreTargetLog.userSnapshot?.lastName || ''}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <Typography variant="caption" sx={{ color: '#64748b' }}>Telegram ID:</Typography>
                                        <Typography variant="body2" fontWeight={700} sx={{ color: '#60a5fa' }}>
                                            {restoreTargetLog.userSnapshot?.telegramId}
                                        </Typography>
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <Typography variant="caption" sx={{ color: '#64748b' }}>Trade Power:</Typography>
                                        <Typography variant="body2" fontWeight={800} sx={{ color: '#4ade80' }}>
                                            ${(restoreTargetLog.userSnapshot?.tradePower || 0).toLocaleString()} USDT
                                        </Typography>
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <Typography variant="caption" sx={{ color: '#64748b' }}>Wallet Balance:</Typography>
                                        <Typography variant="body2" fontWeight={700}>
                                            ${restoreTargetLog.userSnapshot?.walletBalance?.toFixed(3)} USDT
                                        </Typography>
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <Typography variant="caption" sx={{ color: '#64748b' }}>Active Plans Resuming:</Typography>
                                        <Typography variant="body2" fontWeight={700} sx={{ color: '#38bdf8' }}>
                                            {restoreTargetLog.userSnapshot?.activePlansCount || 0} active plan(s) will resume their remaining days starting today.
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Paper>

                            <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 2, fontSize: '0.85rem' }}>
                                To confirm this restoration, enter an authorized executive security password (e.g. <b>TradeEdge002</b> or <b>999Tradeedge</b>):
                            </Typography>

                            <TextField
                                fullWidth
                                label="Security Authorization Password"
                                type={showRestorePassword ? 'text' : 'password'}
                                value={restorePassword}
                                onChange={(e) => setRestorePassword(e.target.value)}
                                placeholder="Enter TradeEdge002 or 999Tradeedge"
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowRestorePassword(!showRestorePassword)} edge="end" sx={{ color: '#94a3b8' }}>
                                                {showRestorePassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                                sx={{
                                    bgcolor: 'rgba(0,0,0,0.3)',
                                    borderRadius: 2,
                                    '& .MuiOutlinedInput-root': {
                                        color: 'white',
                                        '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                                        '&:hover fieldset': { borderColor: '#fbbf24' },
                                        '&.Mui-focused fieldset': { borderColor: '#fbbf24' }
                                    },
                                    '& .MuiInputLabel-root': { color: '#94a3b8' },
                                    '& .MuiInputLabel-root.Mui-focused': { color: '#fbbf24' }
                                }}
                            />
                        </DialogContent>

                        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
                            <Button
                                variant="outlined"
                                onClick={() => setRestoreTargetLog(null)}
                                disabled={restoring}
                                sx={{ color: '#94a3b8', borderColor: 'rgba(255,255,255,0.15)', borderRadius: 2 }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleRestoreUser}
                                disabled={restoring || !restorePassword.trim()}
                                startIcon={restoring ? <CircularProgress size={16} color="inherit" /> : <SettingsBackupRestoreIcon />}
                                sx={{
                                    bgcolor: '#f59e0b',
                                    color: '#000',
                                    fontWeight: 800,
                                    borderRadius: 2,
                                    px: 3,
                                    '&:hover': { bgcolor: '#d97706' },
                                    '&.Mui-disabled': { bgcolor: 'rgba(245, 158, 11, 0.3)', color: 'rgba(0,0,0,0.4)' }
                                }}
                            >
                                {restoring ? 'Restoring...' : 'Confirm & Restore User'}
                            </Button>
                        </DialogActions>
                    </Dialog>
                )}
            </Container>
        </Box>
    );
}
