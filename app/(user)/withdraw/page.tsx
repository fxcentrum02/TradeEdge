'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    Box, Typography, Paper, TextField, Button, Avatar,
    Divider, IconButton, Skeleton, Alert, Snackbar,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
    Card, CardContent
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import HistoryIcon from '@mui/icons-material/History';
import SendIcon from '@mui/icons-material/Send';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useRouter } from 'next/navigation';
import ReinvestModal from '../_components/ReinvestModal';
import { formatCurrency, formatRelativeTime, truncateAddress } from '@/lib/utils';
import { pusherClient } from '@/lib/pusher-client';
import { WITHDRAWAL_CONFIG } from '@/lib/constants';
import type { Withdrawal, WalletSummary } from '@/types';

export default function WithdrawalPage() {
    const router = useRouter();
    const { authFetch } = useAuth();
    const [wallet, setWallet] = useState<WalletSummary | null>(null);
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [loading, setLoading] = useState(true);
    const [amount, setAmount] = useState('');
    const [address, setAddress] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
    const [plans, setPlans] = useState<any[]>([]);
    const [reinvestModalOpen, setReinvestModalOpen] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const [wRes, hRes, pRes] = await Promise.all([
                authFetch('/api/wallet'),
                authFetch('/api/withdrawals'),
                authFetch('/api/plans')
            ]);

            const wData = await wRes.json();
            if (wData.success) {
                setWallet(wData.data);
                // Auto-fill address from last used if current address is empty
                if (wData.data.withdrawalSettings?.lastWithdrawalAddress && !address) {
                    setAddress(wData.data.withdrawalSettings.lastWithdrawalAddress);
                }
            }
            const hData = await hRes.json();
            const pData = await pRes.json();

            if (hData.success) setWithdrawals(hData.data.items || []);
            if (pData.success) setPlans(pData.data);
        } catch (error) {
            console.error('Fetch error:', error);
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    useEffect(() => {
        fetchData();

        let userChannel: any = null;
        // The authFetch ensures we have the user context in the dashboard/layout,
        // but we might need to rely on standard fetching until we have the ID.
        // Assuming we can get it from the session or another route, it's safer to extract it from the wallet data.

        return () => {
            // Cleanup standard polling or sockets if established later
        };
    }, [fetchData]);

    useEffect(() => {
        // Since useAuth doesn't expose the user object directly here, 
        // we'll extract the user ID from the first withdrawal record if available,
        // or wait for a more robust method.
        if (withdrawals.length > 0) {
            const userId = withdrawals[0].userId;
            const channelName = `user-${userId}-notifications`;
            const userChannel = pusherClient.subscribe(channelName);

            userChannel.bind('withdrawal-approved', (data: any) => {
                setSnackbar({
                    open: true,
                    message: `Withdrawal of ${data.amount} USDT approved!`,
                    severity: 'success'
                });
                fetchData();
            });

            userChannel.bind('withdrawal-rejected', (data: any) => {
                setSnackbar({
                    open: true,
                    message: `Withdrawal of ${data.amount} USDT rejected.`,
                    severity: 'error'
                });
                fetchData();
            });

            return () => {
                pusherClient.unsubscribe(channelName);
            };
        }
    }, [withdrawals, fetchData]);

    const handleWithdraw = async () => {
        const numAmount = parseFloat(amount);
        const minAmount = wallet?.withdrawalSettings?.minWithdrawalAmount || WITHDRAWAL_CONFIG.MIN_AMOUNT;

        if (!numAmount || numAmount < minAmount) {
            setSnackbar({ open: true, message: `Minimum withdrawal is ${minAmount} USDT`, severity: 'error' });
            return;
        }
        if (!address.trim() || address.length < 20) {
            setSnackbar({ open: true, message: 'Please enter a valid BEP20 address', severity: 'error' });
            return;
        }
        if (wallet && numAmount > wallet.balance) {
            setSnackbar({ open: true, message: 'Insufficient balance', severity: 'error' });
            return;
        }

        setSubmitting(true);
        try {
            const res = await authFetch('/api/withdrawals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: numAmount, walletAddress: address.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                setSnackbar({ open: true, message: 'Withdrawal request submitted!', severity: 'success' });
                setAmount('');
                fetchData();
            } else {
                setSnackbar({ open: true, message: data.error || 'Withdrawal failed', severity: 'error' });
            }
        } catch (error) {
            setSnackbar({ open: true, message: 'Network error', severity: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleReinvestSuccess = (data: any) => {
        setSnackbar({ open: true, message: `Successfully exchanged ${data.amount} USDT to Compounding Power!`, severity: 'success' });
        fetchData();
    };

    // Calculate dynamic fee
    let fee = 0;
    const numAmount = parseFloat(amount) || 0;
    if (wallet?.withdrawalSettings) {
        if (wallet.withdrawalSettings.withdrawalFeeType === 'FIXED') {
            fee = numAmount > 0 ? wallet.withdrawalSettings.withdrawalFeeValue : 0;
        } else {
            fee = numAmount * (wallet.withdrawalSettings.withdrawalFeeValue / 100);
        }
    } else {
        fee = Math.max(WITHDRAWAL_CONFIG.MIN_FEE, numAmount * (WITHDRAWAL_CONFIG.FEE_PERCENTAGE / 100));
    }
    const netAmount = Math.max(0, numAmount - fee);
    
    // Cooldown logic
    const lastWithdrawalAt = wallet?.withdrawalSettings?.lastWithdrawalAt;
    const cooldownActive = lastWithdrawalAt ? (() => {
        const last = new Date(lastWithdrawalAt);
        const now = new Date();
        return (now.getTime() - last.getTime()) < 24 * 60 * 60 * 1000;
    })() : false;

    const nextAvailableAt = lastWithdrawalAt ? new Date(new Date(lastWithdrawalAt).getTime() + 24 * 60 * 60 * 1000) : null;
    const hoursRemaining = nextAvailableAt ? Math.max(0, Math.ceil((nextAvailableAt.getTime() - new Date().getTime()) / (1000 * 60 * 60))) : 0;

    if (loading) {
        return (
            <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Skeleton variant="circular" width={40} height={40} />
                    <Skeleton variant="text" width={150} height={40} sx={{ ml: 2 }} />
                </Box>
                <Skeleton variant="rounded" height={160} sx={{ borderRadius: 4, mb: 3 }} />
                <Skeleton variant="rounded" height={300} sx={{ borderRadius: 4 }} />
            </Box>
        );
    }

    return (
        <Box sx={{ pb: 4 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                <IconButton onClick={() => router.back()} sx={{ bgcolor: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Typography variant="h6" fontWeight={800} color="#1e293b">Withdraw USDT</Typography>
            </Box>

            {/* Balance Card */}
            <Paper
                sx={{
                    p: 2,
                    borderRadius: 4,
                    bgcolor: 'white',
                    color: '#1e293b',
                    mb: 3,
                    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.05)',
                    position: 'relative',
                    overflow: 'hidden',
                    border: '1px solid #f1f5f9'
                }}
            >
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 1 }}>Available Balance</Typography>
                    <Typography variant="h4" fontWeight={900} sx={{ my: 0.5, letterSpacing: -1, color: '#1e293b' }}>
                        {formatCurrency(wallet?.balance || 0)} <span style={{ fontSize: '1.2rem', fontWeight: 500, color: '#64748b' }}>USDT</span>
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AccountBalanceWalletIcon sx={{ color: '#10b981', fontSize: 20 }} />
                            <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" component="span">Network:</Typography> 
                                <Chip label="BEP20" size="small" sx={{ height: 20, bgcolor: '#ecfdf5', color: '#10b981', fontWeight: 700, fontSize: 10 }} />
                            </Box>
                        </Box>
                        <Button
                            size="small"
                            onClick={() => setReinvestModalOpen(true)}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                color: '#8b5cf6',
                                bgcolor: 'rgba(139, 92, 246, 0.08)',
                                px: 1.2,
                                py: 0.2,
                                borderRadius: 2,
                                fontSize: '0.7rem',
                                minWidth: 'auto',
                                '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.15)' }
                            }}
                        >
                            Exchange to Compounding Power
                        </Button>
                    </Box>
                </Box>
                <Box sx={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.05 }}>
                    <AccountBalanceWalletIcon sx={{ fontSize: 150 }} />
                </Box>
            </Paper>

            {/* Form */}
            <Paper sx={{ p: 2, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.04)', mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Request Withdrawal</Typography>

                <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} gutterBottom display="block">Withdrawal Amount (USDT)</Typography>
                    <TextField
                        fullWidth
                        placeholder={`Min ${wallet?.withdrawalSettings?.minWithdrawalAmount || WITHDRAWAL_CONFIG.MIN_AMOUNT} USDT`}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        type="number"
                        size="small"
                        InputProps={{
                            sx: { borderRadius: 3, bgcolor: '#f8fafc', fontWeight: 600, fontSize: '1rem' }
                        }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, px: 1 }}>
                        <Typography variant="caption" color="text.secondary">Fee: {formatCurrency(fee)}</Typography>
                        <Typography variant="caption" color="#10b981" fontWeight={700}>Receive: {formatCurrency(netAmount)}</Typography>
                    </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} gutterBottom display="block">USDT BEP20 Address</Typography>
                    <TextField
                        fullWidth
                        placeholder="Paste your BEP20 wallet address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        multiline
                        rows={2}
                        size="small"
                        InputProps={{
                            sx: { borderRadius: 3, bgcolor: '#f8fafc', fontFamily: 'monospace', fontSize: '0.85rem' }
                        }}
                    />
                    <Alert severity="warning" sx={{ mt: 1, py: 0, borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.7rem' } }}>
                        Double check your address! We only support <strong>BEP20 (BNB Smart Chain)</strong>. Funds sent to wrong addresses or networks cannot be recovered.
                    </Alert>
                </Box>

                {cooldownActive && nextAvailableAt && (
                    <Alert severity="info" sx={{ mb: 2, borderRadius: 3, '& .MuiAlert-message': { fontSize: '0.8rem' } }}>
                        Withdrawals are limited to once every 24 hours. Next available: <strong>{nextAvailableAt.toLocaleString()}</strong> ({hoursRemaining}h remaining).
                    </Alert>
                )}

                <Button
                    fullWidth
                    variant="contained"
                    size="medium"
                    disabled={submitting || cooldownActive}
                    onClick={handleWithdraw}
                    startIcon={<SendIcon fontSize="small" />}
                    sx={{
                        borderRadius: 3,
                        py: 1.2,
                        fontWeight: 700,
                        textTransform: 'none',
                        fontSize: '0.9rem',
                        boxShadow: cooldownActive ? 'none' : '0 8px 20px rgba(59, 130, 246, 0.3)',
                        bgcolor: 'var(--brand-main)',
                        '&:hover': { bgcolor: 'var(--brand-dark)' }
                    }}
                >
                    {submitting ? 'Processing...' : cooldownActive ? 'Cooldown Active' : 'Submit Request'}
                </Button>

                <Divider sx={{ my: 2 }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>OR</Typography>
                </Divider>

                <Button
                    fullWidth
                    variant="outlined"
                    size="medium"
                    onClick={() => setReinvestModalOpen(true)}
                    startIcon={<SwapHorizIcon fontSize="small" />}
                    sx={{
                        borderRadius: 3,
                        py: 1,
                        fontWeight: 600,
                        textTransform: 'none',
                        color: '#8b5cf6',
                        borderColor: '#8b5cf6',
                        '&:hover': { borderColor: '#7c3aed', bgcolor: 'rgba(139, 92, 246, 0.04)' }
                    }}
                >
                    Exchange to Compounding Power
                </Button>
            </Paper>

            {/* History */}
            {withdrawals.length > 0 && (
                <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, px: 1 }}>
                        <HistoryIcon color="action" />
                        <Typography variant="subtitle1" fontWeight={700}>Withdrawal History</Typography>
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {withdrawals.map((w) => (
                            <Card key={w.id} sx={{ borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
                                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                                        <Box>
                                            <Typography variant="body2" fontWeight={800} color="#1e293b">
                                                {formatCurrency(w.amount)} USDT
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                Net: {formatCurrency(w.netAmount)}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={w.status}
                                            size="small"
                                            sx={{
                                                fontWeight: 700,
                                                fontSize: '0.65rem',
                                                bgcolor: w.status === 'COMPLETED' ? '#dcfce7' : w.status === 'PENDING' ? '#fef3c7' : '#fee2e2',
                                                color: w.status === 'COMPLETED' ? '#16a34a' : w.status === 'PENDING' ? '#d97706' : '#dc2626',
                                            }}
                                        />
                                    </Box>
                                    <Divider sx={{ my: 1, borderStyle: 'dashed' }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#64748b' }}>
                                            {truncateAddress(w.walletAddress)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatRelativeTime(w.createdAt as any)}
                                        </Typography>
                                    </Box>
                                    {w.txHash && (
                                        <Box sx={{ mt: 1, p: 1, bgcolor: '#f8fafc', borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#10b981', fontWeight: 600 }}>
                                                TX: {w.txHash.substring(0, 16)}...
                                            </Typography>
                                            <IconButton size="small" onClick={() => navigator.clipboard.writeText(w.txHash!)}>
                                                <FileCopyIcon sx={{ fontSize: 14 }} />
                                            </IconButton>
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </Box>
                </Box>
            )}

            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={snackbar.severity} sx={{ borderRadius: 3 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            <ReinvestModal
                open={reinvestModalOpen}
                onClose={() => setReinvestModalOpen(false)}
                onSuccess={handleReinvestSuccess}
                balance={wallet?.balance || 0}
                plans={plans}
            />
        </Box>
    );
}
