'use client';

import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Button, Skeleton, Chip, Table, TableBody, TableCell, TableContainer, TableRow, Grid, Divider } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { formatCurrency } from '@/lib/utils';
import type { Plan } from '@/types';
import { useRouter } from 'next/navigation';

export default function PlansPage() {
    const router = useRouter();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [calcAmount, setCalcAmount] = useState<string>('100');

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await fetch('/api/plans');
                const data = await res.json();
                if (data.success) setPlans(data.data);
            } catch (error) {
                console.error('Plans error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchPlans();
    }, []);

    if (loading) {
        return (
            <Box sx={{ py: 2 }}>
                <Skeleton variant="rounded" height={60} sx={{ mb: 2, borderRadius: 3 }} />
                <Skeleton variant="rounded" height={200} sx={{ borderRadius: 3 }} />
            </Box>
        );
    }

    return (
        <Box sx={{ py: 1, pb: 10 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
                📈 Investment Tiers
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Invest any amount — your ROI rate is determined by the range your amount falls into.
            </Typography>

            {/* Profit Calculator */}
            <Card sx={{ borderRadius: 4, mb: 4, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    <Typography variant="subtitle2" fontWeight={800} display="flex" alignItems="center" gap={1}>
                        <TrendingUpIcon color="primary" sx={{ fontSize: 20 }} /> Profit Calculator
                    </Typography>
                </Box>
                <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={700} gutterBottom display="block">
                            INVESTMENT AMOUNT (USDT)
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <Box
                                component="input"
                                type="number"
                                value={calcAmount}
                                onChange={(e: any) => setCalcAmount(e.target.value)}
                                placeholder="Enter amount..."
                                sx={{
                                    flex: 1,
                                    height: 50,
                                    borderRadius: 3,
                                    border: '1px solid #cbd5e1',
                                    px: 2,
                                    fontSize: '1.25rem',
                                    fontWeight: 700,
                                    color: '#1e293b',
                                    outline: 'none',
                                    '&:focus': { borderColor: 'primary.main', boxShadow: '0 0 0 2px rgba(132, 204, 22, 0.2)' }
                                }}
                            />
                            <Typography variant="h6" fontWeight={800} color="text.secondary">USDT</Typography>
                        </Box>
                    </Box>

                    {(() => {
                        const amount = parseFloat(calcAmount) || 0;
                        const matchedPlan = plans.find(p =>
                            amount >= p.minAmount && (!p.maxAmount || amount < p.maxAmount)
                        );

                        if (!matchedPlan && amount > 0) {
                            return <Typography color="error" variant="caption">The amount entered does not match any existing tier.</Typography>;
                        }

                        const dailyRoi = matchedPlan?.dailyRoi || 0;
                        const dailyProfit = (amount * dailyRoi) / 100;
                        const duration = matchedPlan?.duration || 30;
                        const totalProfit = dailyProfit * duration;

                        return (
                            <Box sx={{ bgcolor: '#f8fafc', borderRadius: 3, p: 2 }}>
                                <Grid container spacing={2}>
                                    <Grid size={{ xs: 6 }}>
                                        <Typography variant="caption" color="text.secondary">Detected Tier</Typography>
                                        <Typography variant="body2" fontWeight={800}>{matchedPlan?.name || '-'}</Typography>
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <Typography variant="caption" color="text.secondary">Daily ROI</Typography>
                                        <Typography variant="body2" fontWeight={800} color="primary.main">{dailyRoi}%</Typography>
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <Typography variant="caption" color="text.secondary">Daily Earnings</Typography>
                                        <Typography variant="body2" fontWeight={800} color="success.main">{formatCurrency(dailyProfit)}</Typography>
                                    </Grid>
                                    <Grid size={{ xs: 6 }}>
                                        <Typography variant="caption" color="text.secondary">Total Profit ({duration}d)</Typography>
                                        <Typography variant="body2" fontWeight={800} color="success.main">{formatCurrency(totalProfit)}</Typography>
                                    </Grid>
                                    <Grid size={{ xs: 12 }}>
                                        <Divider sx={{ my: 1 }} />
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Typography variant="body2" fontWeight={700}>Total Return</Typography>
                                            <Typography variant="h6" fontWeight={800} color="primary.main">{formatCurrency(amount + totalProfit)}</Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Box>
                        );
                    })()}
                </CardContent>
            </Card>


            {/* Tier table */}
            <Card sx={{ borderRadius: 4, mb: 4, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <TableContainer>
                    <Table>
                        <TableBody>
                            {plans.length > 0 ? plans.map((plan, i) => (
                                <TableRow
                                    key={plan.id}
                                    sx={{ '&:last-child td': { border: 0 }, bgcolor: i % 2 === 0 ? 'transparent' : '#fafafa' }}
                                >
                                    <TableCell sx={{ py: 2 }}>
                                        <Typography variant="body2" fontWeight={700}>{plan.name}</Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatCurrency(plan.minAmount)}
                                            {plan.maxAmount ? ` – ${formatCurrency(plan.maxAmount)}` : '+'} USDT
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ py: 2 }}>
                                        <Chip
                                            label={`${plan.dailyRoi}% / day`}
                                            size="small"
                                            sx={{ bgcolor: '#ecfdf5', color: '#10b981', fontWeight: 700 }}
                                        />
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                            {plan.duration} days
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={2} align="center" sx={{ py: 4 }}>
                                        <Typography color="text.secondary" variant="body2">No tiers configured yet</Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Card>

            {/* Referral commission info */}
            <Card sx={{ borderRadius: 4, mb: 4, bgcolor: '#f0fdf4', border: '1px solid #86efac' }}>
                <CardContent sx={{ p: 2.5 }}>
                    <Typography variant="subtitle2" fontWeight={700} gutterBottom>💸 Referral Commissions</Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Box sx={{ flex: 1, textAlign: 'center', bgcolor: 'white', borderRadius: 2, p: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">Direct (Tier 1)</Typography>
                            <Typography variant="h6" fontWeight={800} color="#10b981">10%</Typography>
                            <Typography variant="caption" color="text.secondary">of invested amount</Typography>
                        </Box>
                        <Box sx={{ flex: 1, textAlign: 'center', bgcolor: 'white', borderRadius: 2, p: 1.5 }}>
                            <Typography variant="caption" color="text.secondary">Tiers 2–10</Typography>
                            <Typography variant="h6" fontWeight={800} color="#8b5cf6">1%</Typography>
                            <Typography variant="caption" color="text.secondary">each, per tier</Typography>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            <Button
                variant="contained"
                fullWidth
                size="large"
                startIcon={<TrendingUpIcon />}
                onClick={() => router.push('/buy-tp')}
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
                Buy Mining Power Now →
            </Button>
        </Box>
    );
}
