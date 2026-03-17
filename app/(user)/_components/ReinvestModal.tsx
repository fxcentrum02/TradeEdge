'use client';

import { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, Typography, Box, Alert,
    InputAdornment, IconButton, CircularProgress,
    Divider, Paper, Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { formatCurrency } from '@/lib/utils';
import type { Plan } from '@/types';
import { useAuth } from '@/context/AuthContext';

interface ReinvestModalProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (data: any) => void;
    balance: number;
    plans: Plan[];
}

export default function ReinvestModal({ open, onClose, onSuccess, balance, plans }: ReinvestModalProps) {
    const { authFetch } = useAuth();
    const [amount, setAmount] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [matchedPlan, setMatchedPlan] = useState<Plan | null>(null);

    useEffect(() => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 50) {
            setMatchedPlan(null);
            return;
        }

        // Find the matching plan tier
        const plan = plans.find(p =>
            numAmount >= p.minAmount &&
            (p.maxAmount == null || numAmount <= p.maxAmount)
        );
        setMatchedPlan(plan || null);
    }, [amount, plans]);

    const handleReinvest = async () => {
        setError('');
        const numAmount = parseFloat(amount);

        if (!numAmount || numAmount < 50) {
            setError('Minimum reinvestment is 50 USDT');
            return;
        }

        if (numAmount > balance) {
            setError('Insufficient balance');
            return;
        }

        if (!matchedPlan) {
            setError('No matching plan found for this amount');
            return;
        }

        setLoading(true);
        try {
            const res = await authFetch('/api/wallet/reinvest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: numAmount }),
            });
            const data = await res.json();
            if (data.success) {
                onSuccess(data.data);
                setAmount('');
                onClose();
            } else {
                setError(data.error || 'Failed to process reinvestment');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const numAmount = parseFloat(amount) || 0;
    const dailyEarning = matchedPlan ? (numAmount * matchedPlan.dailyRoi) / 100 : 0;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xs"
            PaperProps={{
                sx: { borderRadius: 4, p: 1 }
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 1 }}>
                <Typography variant="h6" fontWeight={800}>Compounding Power</Typography>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                <Box sx={{ mb: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <AccountBalanceWalletIcon sx={{ color: '#10b981' }} />
                    <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>Available Balance</Typography>
                        <Typography variant="subtitle1" fontWeight={700}>{formatCurrency(balance)}</Typography>
                    </Box>
                </Box>

                <TextField
                    fullWidth
                    label="Amount to Reinvest (USDT)"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Min 50 USDT"
                    autoFocus
                    InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        sx: { borderRadius: 3 }
                    }}
                    sx={{ mb: 2 }}
                />

                {matchedPlan && (
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2,
                            borderRadius: 3,
                            bgcolor: '#f0fdf4',
                            border: '1px solid #dcfce7',
                            mb: 2
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                            <Chip
                                label={matchedPlan.name}
                                size="small"
                                sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 700 }}
                            />
                            <Typography variant="subtitle2" fontWeight={700} color="#10b981">
                                {matchedPlan.dailyRoi}% / day
                            </Typography>
                        </Box>
                        <Divider sx={{ mb: 1.5, opacity: 0.5 }} />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Box>
                                <Typography variant="caption" color="text.secondary" display="block">Daily ROI</Typography>
                                <Typography variant="body2" fontWeight={700}>+{dailyEarning.toFixed(2)} USDT</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant="caption" color="text.secondary" display="block">Duration</Typography>
                                <Typography variant="body2" fontWeight={700}>{matchedPlan.duration} Days</Typography>
                            </Box>
                        </Box>
                    </Paper>
                )}

                {error && <Alert severity="error" sx={{ borderRadius: 2, mb: 1 }}>{error}</Alert>}

                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1, mt: 1 }}>
                    * Using your balance for Compounding Power activates a new ROI plan. Funds are moved from your wallet to active mining.
                </Typography>
            </DialogContent>

            <DialogActions sx={{ p: 2, pt: 0 }}>
                <Button
                    fullWidth
                    variant="contained"
                    onClick={handleReinvest}
                    disabled={loading || !matchedPlan || numAmount > balance}
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <TrendingUpIcon />}
                    sx={{
                        py: 1.5,
                        borderRadius: 3,
                        textTransform: 'none',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
                    }}
                >
                    {loading ? 'Processing...' : 'Confirm Exchange'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
