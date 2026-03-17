'use client';

import { useEffect, useState } from 'react';
import {
    Box, Card, CardContent, Typography, Skeleton, Avatar, Chip, Paper,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Divider, Stack
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import StarsIcon from '@mui/icons-material/Stars';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

interface LeaderboardEntry {
    rank: number;
    displayName: string;
    totalEarnings: number;
    tradePower: number;
    badge: string;
    rankName: string;
    color: string;
}

export default function LeaderboardPage() {
    const { authFetch } = useAuth();
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [userPosition, setUserPosition] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await authFetch('/api/leaderboard');
                const data = await res.json();
                if (data.success) {
                    setLeaderboard(data.data.leaderboard);
                    setUserPosition(data.data.userPosition);
                }
            } catch (error) {
                console.error('Leaderboard error:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchLeaderboard();
    }, [authFetch]);

    if (loading) {
        return (
            <Box sx={{ py: 2 }}>
                <Skeleton variant="rounded" height={100} sx={{ mb: 2, borderRadius: 3 }} />
                <Skeleton variant="rounded" height={400} sx={{ borderRadius: 3 }} />
            </Box>
        );
    }

    const topThree = leaderboard.slice(0, 3);
    const remaining = leaderboard.slice(3);

    return (
        <Box sx={{ pb: 10 }}>
            {/* Header */}
            <Box sx={{ mb: 3, textAlign: 'center' }}>
                <Typography variant="h5" fontWeight={800} sx={{ color: '#1e293b', mb: 0.5 }}>
                    🏆 Hall of Fame
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Our top performers and master traders
                </Typography>
            </Box>

            {/* Current User Rank Card */}
            {userPosition && (
                <Paper
                    elevation={0}
                    sx={{
                        p: 2, mb: 4, borderRadius: 4,
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        boxShadow: '0 8px 32px rgba(16, 185, 129, 0.25)'
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 48, height: 48 }}>
                            <Typography variant="h6" fontWeight={800}>#{userPosition}</Typography>
                        </Avatar>
                        <Box>
                            <Typography variant="caption" sx={{ opacity: 0.9 }}>Your Global Rank</Typography>
                            <Typography variant="subtitle1" fontWeight={800}>Keep trading to climb higher!</Typography>
                        </Box>
                    </Box>
                    <StarsIcon sx={{ opacity: 0.5, fontSize: 40 }} />
                </Paper>
            )}

            {/* Podium (Top 3) */}
            <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ mb: 4, px: 1 }}>
                {/* 2nd Place */}
                {topThree[1] && (
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                        <Box sx={{ mb: 1, position: 'relative', display: 'inline-block' }}>
                            <Avatar sx={{ width: 60, height: 60, border: '3px solid #cbd5e1', mx: 'auto', bgcolor: '#f1f5f9' }}>
                                <Typography variant="h4">{topThree[1].badge}</Typography>
                            </Avatar>
                            <Box sx={{ position: 'absolute', bottom: -5, right: -5, bgcolor: '#cbd5e1', color: '#475569', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                                <Typography variant="caption" fontWeight={900}>2</Typography>
                            </Box>
                        </Box>
                        <Typography variant="caption" fontWeight={700} noWrap display="block">{topThree[1].displayName.split(' ')[0]}</Typography>
                        <Typography variant="caption" color="primary.main" fontWeight={800}>{formatCurrency(topThree[1].totalEarnings)}</Typography>
                    </Box>
                )}

                {/* 1st Place */}
                {topThree[0] && (
                    <Box sx={{ flex: 1.2, textAlign: 'center' }}>
                        <Box sx={{ mb: 1, position: 'relative', display: 'inline-block' }}>
                            <Avatar sx={{ width: 80, height: 80, border: '4px solid #f59e0b', mx: 'auto', bgcolor: '#fffbeb', boxShadow: '0 0 20px rgba(245, 158, 11, 0.3)' }}>
                                <Typography variant="h3">{topThree[0].badge}</Typography>
                            </Avatar>
                            <Box sx={{ position: 'absolute', bottom: -5, right: -5, bgcolor: '#f59e0b', color: 'white', width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                                <EmojiEventsIcon sx={{ fontSize: 16 }} />
                            </Box>
                        </Box>
                        <Typography variant="subtitle2" fontWeight={800} noWrap display="block">{topThree[0].displayName.split(' ')[0]}</Typography>
                        <Typography variant="body2" color="primary.main" fontWeight={900}>{formatCurrency(topThree[0].totalEarnings)}</Typography>
                    </Box>
                )}

                {/* 3rd Place */}
                {topThree[2] && (
                    <Box sx={{ flex: 1, textAlign: 'center' }}>
                        <Box sx={{ mb: 1, position: 'relative', display: 'inline-block' }}>
                            <Avatar sx={{ width: 60, height: 60, border: '3px solid #b45309', mx: 'auto', bgcolor: '#fff7ed' }}>
                                <Typography variant="h4">{topThree[2].badge}</Typography>
                            </Avatar>
                            <Box sx={{ position: 'absolute', bottom: -5, right: -5, bgcolor: '#b45309', color: 'white', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                                <Typography variant="caption" fontWeight={900}>3</Typography>
                            </Box>
                        </Box>
                        <Typography variant="caption" fontWeight={700} noWrap display="block">{topThree[2].displayName.split(' ')[0]}</Typography>
                        <Typography variant="caption" color="primary.main" fontWeight={800}>{formatCurrency(topThree[2].totalEarnings)}</Typography>
                    </Box>
                )}
            </Stack>

            {/* List for 4-10 */}
            <Card sx={{ borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <TableContainer>
                    <Table size="medium">
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 800, width: 50 }}>#</TableCell>
                                <TableCell sx={{ fontWeight: 800 }}>MEMBER</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 800 }}>EARNINGS</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {remaining.map((user) => (
                                <TableRow key={user.rank} sx={{ '&:last-child td': { border: 0 } }}>
                                    <TableCell>
                                        <Typography variant="body2" fontWeight={800} color="text.secondary">
                                            {user.rank}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Typography sx={{ fontSize: 20 }}>{user.badge}</Typography>
                                            <Box>
                                                <Typography variant="body2" fontWeight={700}>{user.displayName}</Typography>
                                                <Typography variant="caption" sx={{ color: user.color, fontWeight: 700, fontSize: '0.65rem', textTransform: 'uppercase' }}>
                                                    {user.rankName}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Typography variant="body2" fontWeight={800} color="primary.main">
                                            {formatCurrency(user.totalEarnings)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                            {user.tradePower.toLocaleString()} MP
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Card>

            <Box sx={{ mt: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 3, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    Leaderboard updates in real-time. Earnings include ROI and referral focus.
                </Typography>
            </Box>
        </Box>
    );
}
