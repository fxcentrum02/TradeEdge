'use client';

import { useState, useEffect } from 'react';
import {
    Box, Card, CardContent, Typography, Stack, Grid,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Paper, Avatar, Chip, CircularProgress, Alert, IconButton, Tooltip,
    Divider
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PersonIcon from '@mui/icons-material/Person';
import LinkIcon from '@mui/icons-material/Link';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAuth } from '@/context/AuthContext';
import LockedFeatureView from '../_components/LockedFeatureView';

export default function FraudDashboard() {
    const { authFetch } = useAuth();
    const [data, setData] = useState<{ duplicateIps: any[], suspiciousReferrers: any[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Temporary: Feature is locked
    const isLocked = true;

    if (isLocked) {
        return (
            <LockedFeatureView
                title="Fraud Detection Locked"
                description="Secure your platform with enterprise-grade threat intelligence. Purchase the AWS Security Cloud Service to enable real-time multi-account detection, IP bundling analysis, and referral farming prevention."
                features={[
                    "Real-time IP monitoring",
                    "Device fingerprinting",
                    "Referral farming prevention",
                    "Automated suspicion flagging"
                ]}
                imageUrl="/previews/fraud.png"
            />
        );
    }

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await authFetch('/api/admin/fraud');
            const result = await res.json();
            if (result.success) {
                setData(result.data);
            } else {
                setError(result.error || 'Failed to fetch fraud data');
            }
        } catch (err) {
            setError('An error occurred while fetching data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ p: 4 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
                        🛡️ Fraud & Multi-Account Detection
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Identify suspicious activities, duplicate IP addresses, and referral farming.
                    </Typography>
                </Box>
                <IconButton onClick={fetchData} sx={{ bgcolor: 'white', boxShadow: 1 }}>
                    <RefreshIcon />
                </IconButton>
            </Stack>

            {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}

            {!data || (data.duplicateIps.length === 0 && data.suspiciousReferrers.length === 0) ? (
                <Alert severity="success" icon={<WarningAmberIcon />} sx={{ borderRadius: 3 }}>
                    No immediate fraud threats detected. Your system looks clean!
                </Alert>
            ) : (
                <Grid container spacing={4}>
                    {/* Duplicate IPs */}
                    <Grid size={12}>
                        <Card sx={{ borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="h6" fontWeight={700} sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    🌐 Duplicate IP Addresses
                                    <Chip label={data.duplicateIps.length} size="small" color="error" variant="outlined" />
                                </Typography>
                                <TableContainer component={Box} sx={{ maxHeight: 400 }}>
                                    <Table stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>IP Address</TableCell>
                                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Account Count</TableCell>
                                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Associated Users</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.duplicateIps.map((group) => (group &&
                                                <TableRow key={group._id} hover>
                                                    <TableCell><Typography fontWeight={600} color="primary">{group._id}</Typography></TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={`${group.count} Accounts`}
                                                            color={group.count > 3 ? "error" : "warning"}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
                                                            {group.users?.map((u: any) => (
                                                                <Tooltip key={u.id} title={`ID: ${u.id}`}>
                                                                    <Chip
                                                                        avatar={<Avatar><PersonIcon /></Avatar>}
                                                                        label={u.username || u.firstName || 'Unknown'}
                                                                        size="small"
                                                                        variant="outlined"
                                                                        sx={{ mb: 0.5 }}
                                                                    />
                                                                </Tooltip>
                                                            ))}
                                                        </Stack>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Referral Velocity */}
                    <Grid size={12}>
                        <Card sx={{ borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="h6" fontWeight={700} sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    🚀 Suspicious Referral Bursts
                                    <Chip label={data.suspiciousReferrers.length} size="small" color="error" variant="outlined" />
                                </Typography>
                                <TableContainer component={Box}>
                                    <Table>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Referrer</TableCell>
                                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Burst Window</TableCell>
                                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>New Signups</TableCell>
                                                <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Risk Level</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {data.suspiciousReferrers.map((group, idx) => (
                                                <TableRow key={idx} hover>
                                                    <TableCell>
                                                        <Typography fontWeight={600}>{group.referrerUsername || group.referrerName}</Typography>
                                                        <Typography variant="caption" color="text.secondary">{group.referrerId}</Typography>
                                                    </TableCell>
                                                    <TableCell>{group.hour}:00 - {group.hour}:59</TableCell>
                                                    <TableCell>
                                                        <Typography fontWeight={700} color="error.main">{group.count} signups</Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={group.count > 10 ? "CRITICAL" : "HIGH"}
                                                            color="error"
                                                            size="small"
                                                            sx={{ fontWeight: 800 }}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}
        </Box>
    );
}
