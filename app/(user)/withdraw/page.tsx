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
import type { Withdrawal, WalletSummary, Plan } from '@/types';

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
    const [plans, setPlans] = useState<Plan[]>([]);
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
                <IconButton onClick={() => router.back()} sx={{ color: '#06b6d4', bgcolor: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <ArrowBackIcon fontSize="small" />
                </IconButton>
                <Typography variant="h6" fontWeight={800} color="#f8fafc">Withdraw USDT</Typography>
            </Box>

            {/* Balance Card */}
            <Paper
                elevation={0}
                sx={{
                    p: 2.2,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.9) 100%)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#f8fafc',
                    mb: 3,
                    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                <Box sx={{ position: 'relative', zIndex: 1 }}>
                    <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1 }}>Available Balance</Typography>
                    <Typography variant="h4" fontWeight={900} sx={{ my: 0.5, letterSpacing: -1, color: '#34d399', textShadow: '0 0 12px rgba(52, 211, 153, 0.3)' }}>
                        {formatCurrency(wallet?.balance || 0)} <span style={{ fontSize: '1.2rem', fontWeight: 600, color: '#94a3b8' }}>USDT</span>
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <AccountBalanceWalletIcon sx={{ color: '#34d399', fontSize: 20 }} />
                            <Box sx={{ color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" component="span">Network:</Typography> 
                                <Chip label="BEP20" size="small" sx={{ height: 20, bgcolor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', fontWeight: 800, fontSize: 10, border: '1px solid rgba(52, 211, 153, 0.3)' }} />
                            </Box>
                        </Box>
                        <Button
                            size="small"
                            onClick={() => setReinvestModalOpen(true)}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 700,
                                color: '#38bdf8',
                                bgcolor: 'rgba(56, 189, 248, 0.12)',
                                border: '1px solid rgba(56, 189, 248, 0.25)',
                                px: 1.4,
                                py: 0.3,
                                borderRadius: 2,
                                fontSize: '0.72rem',
                                minWidth: 'auto',
                                '&:hover': { bgcolor: 'rgba(56, 189, 248, 0.2)' }
                            }}
                        >
                            Exchange to Compounding Power
                        </Button>
                    </Box>
                </Box>
                <Box sx={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.04 }}>
                    <AccountBalanceWalletIcon sx={{ fontSize: 150, color: '#ffffff' }} />
                </Box>
            </Paper>

            {/* Form */}
            <Paper
                elevation={0}
                sx={{
                    p: 2.5,
                    borderRadius: 2,
                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
                    mb: 3
                }}
            >
                <Typography variant="subtitle2" fontWeight={800} color="#f8fafc" sx={{ mb: 1.5 }}>Request Withdrawal</Typography>

                <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="#94a3b8" fontWeight={600} gutterBottom display="block">Withdrawal Amount (USDT)</Typography>
                    <TextField
                        fullWidth
                        placeholder={`Min ${wallet?.withdrawalSettings?.minWithdrawalAmount || WITHDRAWAL_CONFIG.MIN_AMOUNT} USDT`}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        type="number"
                        size="small"
                        InputProps={{
                            sx: {
                                borderRadius: 2,
                                bgcolor: 'rgba(30, 41, 59, 0.8)',
                                color: '#ffffff',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                fontWeight: 700,
                                fontSize: '1rem',
                                '& fieldset': { border: 'none' },
                            }
                        }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, px: 1 }}>
                        <Typography variant="caption" color="#94a3b8">Fee: {formatCurrency(fee)}</Typography>
                        <Typography variant="caption" color="#34d399" fontWeight={800}>Receive: {formatCurrency(netAmount)}</Typography>
                    </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="#94a3b8" fontWeight={600} gutterBottom display="block">USDT BEP20 Address</Typography>
                    <TextField
                        fullWidth
                        placeholder="Paste your BEP20 wallet address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        multiline
                        rows={2}
                        size="small"
                        InputProps={{
                            sx: {
                                borderRadius: 2,
                                bgcolor: 'rgba(30, 41, 59, 0.8)',
                                color: '#38bdf8',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                fontFamily: 'monospace',
                                fontSize: '0.85rem',
                                '& fieldset': { border: 'none' },
                            }
                        }}
                    />
                    <Alert severity="warning" sx={{ mt: 1, py: 0.5, borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.72rem' } }}>
                        Double check your address! We only support <strong>BEP20 (BNB Smart Chain)</strong>. Funds sent to wrong addresses or networks cannot be recovered.
                    </Alert>
                </Box>

                {cooldownActive && nextAvailableAt && (
                    <Alert severity="info" sx={{ mb: 2, borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.8rem' } }}>
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
                        borderRadius: 2,
                        py: 1.4,
                        fontWeight: 800,
                        textTransform: 'none',
                        fontSize: '0.92rem',
                        background: 'linear-gradient(135deg, #06b6d4 0%, #0284c7 100%)',
                        color: '#ffffff',
                        boxShadow: cooldownActive ? 'none' : '0 8px 25px rgba(6, 182, 212, 0.35)',
                        transition: 'all 0.15s ease',
                        '&:active': { transform: 'scale(0.97)' },
                    }}
                >
                    {submitting ? 'Processing...' : cooldownActive ? 'Cooldown Active' : 'Submit Request'}
                </Button>

                <Divider sx={{ my: 2, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                    <Typography variant="caption" color="#94a3b8" fontWeight={600}>OR</Typography>
                </Divider>

                <Button
                    fullWidth
                    variant="outlined"
                    size="medium"
                    onClick={() => setReinvestModalOpen(true)}
                    startIcon={<SwapHorizIcon fontSize="small" />}
                    sx={{
                        borderRadius: 2,
                        py: 1.2,
                        fontWeight: 700,
                        textTransform: 'none',
                        color: '#818cf8',
                        borderColor: 'rgba(129, 140, 248, 0.4)',
                        '&:hover': { borderColor: '#818cf8', bgcolor: 'rgba(129, 140, 248, 0.08)' }
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
