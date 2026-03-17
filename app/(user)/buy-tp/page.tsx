'use client';

import { useEffect, useState } from 'react';
import {
    Box, Card, CardContent, Typography, Button, TextField, Stepper, Step,
    StepLabel, Chip, CircularProgress, Alert, Divider, Paper, IconButton,
    Skeleton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import type { Plan, PaymentTicket } from '@/types';
import { useAuth } from '@/context/AuthContext';

export default function BuyMiningPowerPage() {
    const router = useRouter();
    const { authFetch } = useAuth();
    const [step, setStep] = useState(0); // 0: amount, 1: payment, 2: success
    const [amount, setAmount] = useState('');
    const [txId, setTxId] = useState('');
    const [matchedPlan, setMatchedPlan] = useState<Plan | null>(null);
    const [loadingPlan, setLoadingPlan] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [copiedAddress, setCopiedAddress] = useState(false);
    const [ticket, setTicket] = useState<PaymentTicket | null>(null);
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

    // Dynamic payment settings from DB
    const [paymentAddress, setPaymentAddress] = useState('');
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [loadingPayment, setLoadingPayment] = useState(true);

    // Fetch dynamic payment settings on mount
    useEffect(() => {
        const fetchPaymentSettings = async () => {
            try {
                const res = await fetch('/api/settings/payment');
                const data = await res.json();
                if (data.success && data.data) {
                    setPaymentAddress(data.data.receivingAddress || '');
                    setQrCodeUrl(data.data.qrCodeUrl || '');
                }
            } catch {
                // Fallback silently — address will show as empty
            } finally {
                setLoadingPayment(false);
            }
        };
        fetchPaymentSettings();
    }, []);

    // Look up matching plan tier as user types amount
    useEffect(() => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 50) {
            setMatchedPlan(null);
            return;
        }

        if (debounceTimer) clearTimeout(debounceTimer);
        const timer = setTimeout(async () => {
            setLoadingPlan(true);
            try {
                const res = await fetch(`/api/plans/tier?amount=${numAmount}`, { credentials: 'include' });
                const data = await res.json();
                if (data.success && data.data) {
                    setMatchedPlan(data.data);
                } else {
                    setMatchedPlan(null);
                }
            } catch {
                setMatchedPlan(null);
            } finally {
                setLoadingPlan(false);
            }
        }, 500);
        setDebounceTimer(timer);

        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [amount]);

    const numAmount = parseFloat(amount);
    const isValidAmount = !isNaN(numAmount) && numAmount >= 50;
    const dailyEarning = matchedPlan ? (numAmount * matchedPlan.dailyRoi) / 100 : 0;
    const totalEarning = matchedPlan ? dailyEarning * matchedPlan.duration : 0;

    const handleCopyAddress = async () => {
        await navigator.clipboard.writeText(paymentAddress);
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
    };

    const handleProceedToPayment = () => {
        setError('');
        if (!isValidAmount) {
            setError('Please enter a valid amount (minimum 50 USDT)');
            return;
        }
        if (!matchedPlan) {
            setError('No matching plan found for this amount');
            return;
        }
        setStep(1);
    };

    const handleSubmitTicket = async () => {
        setError('');
        if (!txId.trim()) {
            setError('Please enter your transaction ID / TX hash');
            return;
        }
        setSubmitting(true);
        try {
            const res = await authFetch('/api/plans/buy-tp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: numAmount, transactionId: txId.trim() }),
            });
            const data = await res.json();
            if (data.success) {
                setTicket(data.data);
                setStep(2);
            } else {
                setError(data.error || 'Failed to submit. Please try again.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Box sx={{ pb: 10 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                <IconButton onClick={() => router.back()} size="small">
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6" fontWeight={700}>Buy Mining Power</Typography>
            </Box>

            {/* Stepper */}
            <Stepper activeStep={step} sx={{ mb: 4 }}>
                <Step><StepLabel>Amount</StepLabel></Step>
                <Step><StepLabel>Payment</StepLabel></Step>
                <Step><StepLabel>Submitted</StepLabel></Step>
            </Stepper>

            {/* ─── STEP 0: Amount Entry ─── */}
            {step === 0 && (
                <Box>
                    <Card sx={{ borderRadius: 4, mb: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                                Enter Investment Amount (USDT)
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Minimum: 50 USDT. Payment via BEP20 network.
                            </Typography>

                            <TextField
                                fullWidth
                                label="Amount in USDT"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                type="number"
                                inputProps={{ min: 50, step: 1 }}
                                placeholder="e.g. 100"
                                sx={{ mb: 2 }}
                                InputProps={{
                                    endAdornment: <Typography color="text.secondary" variant="body2">USDT</Typography>
                                }}
                            />

                            {/* Plan Tier Preview */}
                            {isValidAmount && (
                                <Box>
                                    {loadingPlan ? (
                                        <Skeleton variant="rounded" height={80} sx={{ borderRadius: 2 }} />
                                    ) : matchedPlan ? (
                                        <Paper
                                            sx={{
                                                p: 2,
                                                borderRadius: 3,
                                                bgcolor: '#f0fdf4',
                                                border: '1px solid #86efac',
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                <Chip
                                                    icon={<TrendingUpIcon sx={{ fontSize: 16 }} />}
                                                    label={matchedPlan.name}
                                                    size="small"
                                                    sx={{ bgcolor: '#10b981', color: 'white', fontWeight: 700 }}
                                                />
                                                <Chip
                                                    label={`${matchedPlan.dailyRoi}% / day`}
                                                    size="small"
                                                    sx={{ bgcolor: '#dcfce7', color: '#16a34a', fontWeight: 700 }}
                                                />
                                            </Box>
                                            <Divider sx={{ my: 1 }} />
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="caption" color="text.secondary">Daily Earning</Typography>
                                                    <Typography variant="subtitle1" fontWeight={700} color="#10b981">
                                                        +{dailyEarning.toFixed(2)} USDT
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="caption" color="text.secondary">Duration</Typography>
                                                    <Typography variant="subtitle1" fontWeight={700}>
                                                        {matchedPlan.duration} days
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ textAlign: 'center' }}>
                                                    <Typography variant="caption" color="text.secondary">Total Earning</Typography>
                                                    <Typography variant="subtitle1" fontWeight={700} color="#10b981">
                                                        ~{totalEarning.toFixed(2)} USDT
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Paper>
                                    ) : (
                                        <Alert severity="warning">
                                            No plan tier found for this amount. Please check available plans.
                                        </Alert>
                                    )}
                                </Box>
                            )}

                            {!isValidAmount && amount && (
                                <Alert severity="error" sx={{ mt: 1 }}>Minimum investment is 50 USDT</Alert>
                            )}
                        </CardContent>
                    </Card>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        onClick={handleProceedToPayment}
                        disabled={!isValidAmount || !matchedPlan}
                        sx={{
                            background: 'linear-gradient(135deg, var(--brand-main) 0%, var(--brand-dark) 100%)',
                            borderRadius: 3,
                            py: 2,
                            fontWeight: 700,
                            fontSize: '1rem',
                            textTransform: 'none',
                            boxShadow: '0 4px 14px rgba(132,204,22,0.4)',
                        }}
                    >
                        Proceed to Payment →
                    </Button>
                </Box>
            )}

            {/* ─── STEP 1: Payment Instructions ─── */}
            {step === 1 && (
                <Box>
                    <Card sx={{ borderRadius: 4, mb: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                                Send {formatCurrency(numAmount)} USDT
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                Send <strong>{numAmount} USDT</strong> on the <strong>BEP20 (BSC)</strong> network to the address below.
                            </Typography>

                            {/* QR Code */}
                            {loadingPayment ? (
                                <Skeleton variant="rounded" width={180} height={180} sx={{ mx: 'auto', mb: 3, borderRadius: 3 }} />
                            ) : qrCodeUrl ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                                    <Box
                                        sx={{
                                            p: 1.5,
                                            bgcolor: 'white',
                                            borderRadius: 3,
                                            border: '1px solid #e2e8f0',
                                            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                                            display: 'inline-block',
                                        }}
                                    >
                                        <img
                                            src={qrCodeUrl}
                                            alt="Payment QR Code"
                                            style={{ width: 160, height: 160, display: 'block', borderRadius: 6 }}
                                        />
                                    </Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                                        Scan to get the payment address
                                    </Typography>
                                </Box>
                            ) : null}

                            {/* Wallet Address */}
                            <Paper
                                sx={{
                                    p: 2,
                                    borderRadius: 3,
                                    bgcolor: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    mb: 3,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    justifyContent: 'space-between',
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    sx={{
                                        color: 'text.primary',
                                        fontFamily: 'monospace',
                                        wordBreak: 'break-all',
                                        flex: 1,
                                    }}
                                >
                                    {loadingPayment ? (
                                        <Skeleton width="80%" />
                                    ) : (
                                        paymentAddress || 'Address not configured'
                                    )}
                                </Typography>
                                <IconButton
                                    onClick={handleCopyAddress}
                                    size="small"
                                    disabled={!paymentAddress || loadingPayment}
                                    sx={{
                                        bgcolor: copiedAddress ? '#10b981' : '#e2e8f0',
                                        color: copiedAddress ? 'white' : 'text.secondary',
                                        '&:hover': { bgcolor: copiedAddress ? '#059669' : '#cbd5e1' },
                                    }}
                                >
                                    {copiedAddress ? <CheckCircleIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                                </IconButton>
                            </Paper>

                            <Alert severity="warning" sx={{ mb: 3 }}>
                                ⚠️ Only send USDT on <strong>BEP20 (BSC)</strong> network. Sending on wrong network will result in permanent loss of funds.
                            </Alert>

                            {/* Plan summary */}
                            {matchedPlan && (
                                <Box sx={{ bgcolor: '#f8fafc', borderRadius: 2, p: 2, mb: 3 }}>
                                    <Typography variant="caption" color="text.secondary">Your Plan</Typography>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                        <Typography variant="body2" fontWeight={600}>{matchedPlan.name} Tier</Typography>
                                        <Chip label={`${matchedPlan.dailyRoi}%/day`} size="small" sx={{ bgcolor: '#dcfce7', color: '#16a34a', fontWeight: 700, fontSize: '0.7rem' }} />
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                        <Typography variant="body2" color="text.secondary">Investment</Typography>
                                        <Typography variant="body2" fontWeight={600}>{numAmount} USDT</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                                        <Typography variant="body2" color="text.secondary">Daily Earning</Typography>
                                        <Typography variant="body2" fontWeight={600} color="#10b981">+{dailyEarning.toFixed(2)} USDT</Typography>
                                    </Box>
                                </Box>
                            )}

                            {/* TX ID Input */}
                            <TextField
                                fullWidth
                                label="Transaction ID / TX Hash"
                                value={txId}
                                onChange={(e) => setTxId(e.target.value)}
                                placeholder="Paste your transaction hash here"
                                multiline
                                rows={2}
                                sx={{ mb: 1 }}
                                helperText="After sending, paste the transaction hash from your wallet as proof of payment."
                            />
                        </CardContent>
                    </Card>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            onClick={() => setStep(0)}
                            sx={{ borderRadius: 3, py: 1.5, textTransform: 'none', flex: 0.4 }}
                        >
                            Back
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSubmitTicket}
                            disabled={submitting || !txId.trim()}
                            fullWidth
                            size="large"
                            sx={{
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                borderRadius: 3,
                                py: 1.5,
                                fontWeight: 700,
                                textTransform: 'none',
                                flex: 0.6,
                            }}
                        >
                            {submitting ? <CircularProgress size={20} color="inherit" /> : 'Submit for Approval'}
                        </Button>
                    </Box>
                </Box>
            )}

            {/* ─── STEP 2: Success ─── */}
            {step === 2 && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mx: 'auto',
                            mb: 3,
                        }}
                    >
                        <CheckCircleIcon sx={{ color: 'white', fontSize: 40 }} />
                    </Box>
                    <Typography variant="h5" fontWeight={800} gutterBottom>
                        Payment Submitted! 🎉
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        Your payment of <strong>{numAmount} USDT</strong> has been submitted for review.
                        Our team will verify and activate your mining power within <strong>24 hours</strong>.
                    </Typography>

                    <Paper sx={{ p: 2, borderRadius: 3, bgcolor: '#f8fafc', mb: 4, textAlign: 'left' }}>
                        <Typography variant="caption" color="text.secondary">Ticket ID</Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                            {ticket?.id}
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="caption" color="text.secondary">Status</Typography>
                        <Box sx={{ mt: 0.5 }}>
                            <Chip label="PENDING REVIEW" size="small" sx={{ bgcolor: '#fef3c7', color: '#d97706', fontWeight: 700 }} />
                        </Box>
                    </Paper>

                    <Button
                        variant="contained"
                        fullWidth
                        onClick={() => router.push('/dashboard')}
                        sx={{
                            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                            borderRadius: 3,
                            py: 2,
                            fontWeight: 700,
                            textTransform: 'none',
                        }}
                    >
                        Back to Dashboard
                    </Button>
                </Box>
            )}
        </Box>
    );
}
