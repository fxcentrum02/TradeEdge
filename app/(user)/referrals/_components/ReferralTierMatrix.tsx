'use client';

import {
    Box, Card, TableContainer, Table, TableHead, TableRow, TableCell,
    TableBody, Typography, Paper, Chip
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { formatCurrency } from '@/lib/utils';
import type { ReferralTier } from '@/types';

const ROI_COMMISSION_PERCENTAGES = [
    20, 15, 10, 5, 5, 
    4, 4, 3, 3, 2, 
    2, 1.5, 1.5, 1, 1.5, 
    1.5, 2, 2, 3, 3
];

interface ReferralTierMatrixProps {
    tierBreakdown: ReferralTier[];
    tier20TotalCount: number;
    onTierClick?: (tier: number, userCount: number) => void;
}

export default function ReferralTierMatrix({ tierBreakdown, tier20TotalCount, onTierClick }: ReferralTierMatrixProps) {
    return (
        <Box>
            {/* Tier Table Header */}
            <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1 }}>
                <Typography variant="caption" fontWeight={700} color="#94a3b8">
                    Tiered Earnings (20 Levels)
                </Typography>
                <Chip
                    label={`${tier20TotalCount || 0} users`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255, 255, 255, 0.08)', color: '#f8fafc', fontWeight: 600, fontSize: '0.65rem', height: 20 }}
                />
            </Box>

            {/* Matrix Table Card */}
            <Card
                sx={{
                    borderRadius: 2,
                    overflow: 'hidden',
                    background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.45)',
                }}
            >
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: 'rgba(255, 255, 255, 0.04)' }}>
                                <TableCell sx={{ fontWeight: 800, color: '#94a3b8' }}>Tier</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 800, color: '#94a3b8' }}>Users (A/T)</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800, color: '#94a3b8' }}>Investment</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800, color: '#94a3b8' }}>Earnings</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {tierBreakdown.map((tier) => (
                                <TableRow
                                    key={tier.tier}
                                    onClick={() => onTierClick && onTierClick(tier.tier, tier.userCount)}
                                    sx={{
                                        cursor: tier.tier === 1 && tier.userCount > 0 ? 'pointer' : 'default',
                                        opacity: tier.isUnlocked ? 1 : 0.5,
                                        bgcolor: tier.isUnlocked ? 'transparent' : 'rgba(0,0,0,0.2)',
                                        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.04)' },
                                    }}
                                >
                                    <TableCell sx={{ fontWeight: 700, color: '#f1f5f9' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            Tier {tier.tier}
                                            {!tier.isUnlocked && <LockIcon sx={{ fontSize: '0.8rem', color: '#f87171', ml: 0.5 }} />}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        <Typography variant="body2" fontWeight={700} color="#f8fafc">
                                            {tier.activeUserCount} / {tier.userCount}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 600, color: '#94a3b8' }}>
                                        {formatCurrency(tier.totalInvested)}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 800, color: tier.isUnlocked ? '#34d399' : '#64748b' }}>
                                        {formatCurrency(tier.totalEarnings)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Card>

            {/* Tier Percentages Breakdown */}
            <Box sx={{ mt: 3, mb: 1, px: 1 }}>
                <Typography variant="caption" fontWeight={700} color="#94a3b8" gutterBottom display="block">
                    ROI Commission Structure (by Tier)
                </Typography>
                <Paper sx={{ p: 2, borderRadius: 2, border: '1px solid rgba(255, 255, 255, 0.08)', background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%)' }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1.5 }}>
                        {ROI_COMMISSION_PERCENTAGES.map((pct, i) => (
                            <Box key={i} sx={{ textAlign: 'center' }}>
                                <Typography variant="caption" color="#94a3b8" sx={{ fontSize: '0.62rem', display: 'block', fontWeight: 600 }}>
                                    T{i + 1}
                                </Typography>
                                <Typography variant="body2" fontWeight={800} color="#38bdf8">
                                    {pct}%
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Paper>
                <Typography variant="caption" color="#64748b" sx={{ mt: 1.5, display: 'block', fontStyle: 'italic', px: 1 }}>
                    * You earn these percentages based on the daily ROI earned by your network in each respective tier.
                </Typography>
            </Box>
        </Box>
    );
}
