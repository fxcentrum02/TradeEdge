'use client';

import { useState, useEffect, useMemo } from 'react';
import {
    Box, Typography, Paper, Grid, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Card, CardContent,
    Button, IconButton, TextField, InputAdornment, Avatar,
    Breadcrumbs, Link, Chip, Skeleton, Collapse, List, ListItem,
    ListItemAvatar, ListItemText, Divider, Stack, useMediaQuery,
    useTheme
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { HierarchyLevelStat, HierarchyTreeNode } from '@/types';

// ===========================================
// TREE NODE COMPONENT
// ===========================================

interface TreeItemProps {
    node: HierarchyTreeNode;
    level: number;
}

const TreeItem = ({ node, level }: TreeItemProps) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [children, setChildren] = useState<HierarchyTreeNode[]>(node.children || []);

    const hasChildren = node.directReferralCount > 0;

    const handleToggle = async () => {
        if (!expanded && children.length === 0 && hasChildren) {
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/reports/hierarchy?rootUserId=${node.id}&depth=1`);
                const data = await res.json();
                if (data.success && data.data.explorerTree) {
                    setChildren(data.data.explorerTree);
                }
            } catch (err) {
                console.error('Failed to fetch children:', err);
            } finally {
                setLoading(false);
            }
        }
        setExpanded(!expanded);
    };

    return (
        <Box sx={{ ml: level > 0 ? (isMobile ? 1.5 : 3) : 0, mb: 0.5 }}>
            <Paper
                elevation={0}
                sx={{
                    p: isMobile ? 1 : 1.5,
                    border: '1px solid #e2e8f0',
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? 1 : 2,
                    flexDirection: isMobile ? 'column' : 'row',
                    '&:hover': { bgcolor: '#f1f5f9' },
                    cursor: hasChildren ? 'pointer' : 'default'
                }}
                onClick={handleToggle}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: 1 }}>
                    {hasChildren ? (
                        <IconButton size="small" sx={{ p: 0 }}>
                            {expanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                        </IconButton>
                    ) : (
                        <Box sx={{ width: 24 }} />
                    )}

                    <Avatar
                        sx={{
                            width: isMobile ? 28 : 32,
                            height: isMobile ? 28 : 32,
                            bgcolor: 'primary.main',
                            fontSize: isMobile ? 12 : 14,
                            fontWeight: 700
                        }}
                    >
                        {node.firstName?.charAt(0) || '?'}
                    </Avatar>

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant={isMobile ? "caption" : "body2"} fontWeight={700} noWrap display="block">
                            {node.firstName} {node.lastName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block', fontSize: '0.65rem' }}>
                            @{node.telegramUsername || node.telegramId}
                        </Typography>
                    </Box>

                    {isMobile && (
                        <Chip
                            label={`${node.directReferralCount}/${node.totalReferralCount}`}
                            size="small"
                            variant="outlined"
                            sx={{ height: 16, fontSize: '0.55rem', px: 0.5 }}
                        />
                    )}
                </Box>

                {!isMobile ? (
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ textAlign: 'right' }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Mining Power
                            </Typography>
                            <Typography variant="body2" fontWeight={700} color="primary.main">
                                {formatCurrency(node.tradePower)}
                            </Typography>
                        </Box>
                        <Divider orientation="vertical" flexItem />
                        <Box sx={{ textAlign: 'right', minWidth: 80 }}>
                            <Typography variant="caption" color="text.secondary" display="block">
                                Referrals
                            </Typography>
                            <Chip
                                icon={<PeopleIcon sx={{ fontSize: '0.8rem !important' }} />}
                                label={`${node.directReferralCount} / ${node.totalReferralCount}`}
                                size="small"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.65rem' }}
                            />
                        </Box>
                    </Stack>
                ) : (
                    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 0.5, borderTop: '1px solid #f1f5f9' }}>
                        <Typography variant="caption" color="primary.main" fontWeight={700}>
                            Power: {formatCurrency(node.tradePower)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            ID: {node.telegramId}
                        </Typography>
                    </Box>
                )}
            </Paper>

            <Collapse in={expanded} timeout="auto">
                <Box sx={{ mt: 1 }}>
                    {loading ? (
                        <Box sx={{ ml: 6, p: 1 }}>
                            <Skeleton variant="text" width="60%" height={24} />
                            <Skeleton variant="text" width="40%" height={24} />
                        </Box>
                    ) : (
                        children.map((child) => (
                            <TreeItem key={child.id} node={child} level={level + 1} />
                        ))
                    )}
                </Box>
            </Collapse>
        </Box>
    );
};

// ===========================================
// MAIN PAGE COMPONENT
// ===========================================

export default function HierarchyPage() {
    const [stats, setStats] = useState<HierarchyLevelStat[]>([]);
    const [rootUsers, setRootUsers] = useState<HierarchyTreeNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const isTablet = useMediaQuery(theme.breakpoints.down('md'));


    useEffect(() => {
        fetch('/api/admin/reports/hierarchy')
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    setStats(data.data.stats);
                    setRootUsers(data.data.rootUsers);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const filteredRoots = useMemo(() => {
        if (!searchTerm) return rootUsers;
        return rootUsers.filter(u =>
            u.telegramUsername?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.telegramId.includes(searchTerm)
        );
    }, [rootUsers, searchTerm]);

    const totalUsers = stats.reduce((sum, s) => sum + s.count, 0);
    const totalTP = stats.reduce((sum, s) => sum + s.totalTradePower, 0);

    return (
        <Box>
            <Box sx={{ mb: 4 }}>
                <Typography variant={isMobile ? "h5" : "h4"} fontWeight={800} gutterBottom>
                    User Hierarchy Report
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Overall platform network distribution and genealogy explorer (up to 20 tiers).
                </Typography>
            </Box>

            {/* Global Stats Grid */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card sx={{ borderRadius: 4, bgcolor: '#0f172a', color: 'white', overflow: 'hidden', position: 'relative' }}>
                        <CardContent sx={{ p: isMobile ? 3 : 4 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box>
                                    <Typography variant="overline" sx={{ color: '#94a3b8', fontWeight: 700, letterSpacing: 1, fontSize: isMobile ? '0.6rem' : '0.75rem' }}>
                                        Platform Reach
                                    </Typography>
                                    <Typography variant={isMobile ? "h4" : "h3"} fontWeight={800} sx={{ mt: 1 }}>
                                        {formatNumber(totalUsers)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#94a3b8', mt: 1, display: 'block' }}>
                                        Total registered users
                                    </Typography>
                                </Box>
                                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.1)', width: isMobile ? 48 : 56, height: isMobile ? 48 : 56 }}>
                                    <PeopleIcon sx={{ color: 'primary.main', fontSize: isMobile ? 24 : 32 }} />
                                </Avatar>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Card sx={{ borderRadius: 4, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                        <CardContent sx={{ p: isMobile ? 3 : 4 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <Box>
                                    <Typography variant="overline" sx={{ color: 'rgba(0,0,0,0.5)', fontWeight: 700, letterSpacing: 1, fontSize: isMobile ? '0.6rem' : '0.75rem' }}>
                                        Network Power
                                    </Typography>
                                    <Typography variant={isMobile ? "h4" : "h3"} fontWeight={800} sx={{ mt: 1 }}>
                                        {formatCurrency(totalTP)}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(0,0,0,0.5)', mt: 1, display: 'block' }}>
                                        Aggregated mining power
                                    </Typography>
                                </Box>
                                <Avatar sx={{ bgcolor: 'rgba(0,0,0,0.1)', width: isMobile ? 48 : 56, height: isMobile ? 48 : 56 }}>
                                    <TrendingUpIcon sx={{ color: 'white', fontSize: isMobile ? 24 : 32 }} />
                                </Avatar>
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Tier Breakdown Table */}
            <Paper sx={{ borderRadius: 4, mb: 4, overflow: 'hidden', border: '1px solid #e2e8f0' }} elevation={0}>
                <Box sx={{ p: 3, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <TrendingUpIcon color="primary" />
                    <Typography variant="h6" fontWeight={700}>Platform Tier Distribution</Typography>
                </Box>
                <TableContainer>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 700, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>Tier Level</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>User Count</TableCell>
                                {!isMobile && <TableCell align="center" sx={{ fontWeight: 700 }}>Market Share (Users)</TableCell>}
                                <TableCell align="right" sx={{ fontWeight: 700, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>Total Mining Power</TableCell>
                                {!isMobile && <TableCell align="right" sx={{ fontWeight: 700 }}>Avg. MP / User</TableCell>}
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                [1, 2, 3, 4, 5].map((i) => (
                                    <TableRow key={i}>
                                        <TableCell><Skeleton width={80} /></TableCell>
                                        <TableCell align="center"><Skeleton width={60} /></TableCell>
                                        <TableCell align="center"><Skeleton width={100} /></TableCell>
                                        <TableCell align="right"><Skeleton width={120} /></TableCell>
                                        <TableCell align="right"><Skeleton width={100} /></TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                stats.map((tier) => (
                                    <TableRow key={tier.tier} hover>
                                        <TableCell>
                                            <Chip
                                                label={`T${tier.tier}`}
                                                size="small"
                                                sx={{ fontWeight: 700, bgcolor: tier.tier === 1 ? 'primary.main' : '#f1f5f9', color: tier.tier === 1 ? 'white' : 'inherit', height: 20, fontSize: '0.65rem' }}
                                            />
                                        </TableCell>
                                        <TableCell align="center" sx={{ fontWeight: 600, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
                                            {formatNumber(tier.count)}
                                        </TableCell>
                                        {!isMobile && (
                                            <TableCell align="center">
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                                    <Box sx={{ flex: 1, height: 6, bgcolor: '#f1f5f9', borderRadius: 3, maxWidth: 100 }}>
                                                        <Box
                                                            sx={{
                                                                height: '100%',
                                                                width: `${(tier.count / (totalUsers || 1)) * 100}%`,
                                                                bgcolor: 'primary.main',
                                                                borderRadius: 3
                                                            }}
                                                        />
                                                    </Box>
                                                    <Typography variant="caption" fontWeight={600}>
                                                        {((tier.count / (totalUsers || 1)) * 100).toFixed(1)}%
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        )}
                                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
                                            {formatCurrency(tier.totalTradePower)}
                                        </TableCell>
                                        {!isMobile && (
                                            <TableCell align="right">
                                                {tier.count > 0 ? formatCurrency(tier.totalTradePower / tier.count) : '$0.00'}
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Tree Explorer Section */}
            <Typography variant="h5" fontWeight={800} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <AccountTreeIcon color="primary" /> Genealogy Explorer
            </Typography>

            <Paper sx={{ p: isMobile ? 2 : 3, borderRadius: 4, minHeight: 400, border: '1px solid #e2e8f0' }} elevation={0}>
                {/* Search / Filter */}
                <Box sx={{ mb: 3 }}>
                    <TextField
                        fullWidth
                        placeholder="Search top-level referrers by name or username..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ color: '#94a3b8' }} />
                                </InputAdornment>
                            ),
                            sx: { borderRadius: 3, bgcolor: '#f8fafc' }
                        }}
                    />
                </Box>

                <Typography variant="subtitle2" sx={{ mb: 2, color: '#64748b', fontWeight: 700 }}>
                    ROOT USERS (DIRECT REFERRERS)
                </Typography>

                <Stack spacing={1}>
                    {loading ? (
                        [1, 2, 3].map(i => <Skeleton key={i} variant="rounded" height={60} sx={{ borderRadius: 2 }} />)
                    ) : filteredRoots.length === 0 ? (
                        <Box sx={{ py: 8, textAlign: 'center' }}>
                            <Typography color="text.secondary">No top-level users found.</Typography>
                        </Box>
                    ) : (
                        filteredRoots.map((user) => (
                            <TreeItem key={user.id} node={user} level={0} />
                        ))
                    )}
                </Stack>
            </Paper>
        </Box>
    );
}
