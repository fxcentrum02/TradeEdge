'use client';

import { useState } from 'react';
import {
    Box, Typography, Card, CardContent, Grid, Stack,
    Switch, FormControlLabel, TextField, Button,
    Alert, Divider, Chip, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';
import HistoryIcon from '@mui/icons-material/History';
import LockedFeatureView from '../_components/LockedFeatureView';

export default function AutoPayoutsPage() {
    // Feature is locked initially
    const isLocked = true;

    if (isLocked) {
        return (
            <LockedFeatureView
                title="Automated Payout Engine Locked"
                description="Eliminate manual processing and speed up user payouts. Purchase the AWS Payout Gateway integration to enable 1-click automated USDT transfers directly through your Binance Pay or Metamask API."
                price="$499.00 USD"
                features={[
                    "1-Click automated withdrawals",
                    "Binance Pay API integration",
                    "Custom auto-payout limits",
                    "Real-time balance monitoring"
                ]}
                imageUrl="/previews/payouts.png"
            />
        );
    }

    return (
        <Box sx={{ p: 4 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
                <Box>
                    <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
                        ⚡ Automated Payout Engine
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Configure API gateways for 1-click or fully automated user withdrawals.
                    </Typography>
                </Box>
                <Chip label="ONLINE" color="success" sx={{ fontWeight: 700 }} />
            </Stack>

            <Grid container spacing={4}>
                {/* Configuration */}
                <Grid size={{ xs: 12, md: 5 }}>
                    <Card sx={{ borderRadius: 4, height: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <SettingsInputComponentIcon color="primary" />
                                Gateway Configuration
                            </Typography>
                            <Divider sx={{ my: 2 }} />
                            
                            <Stack spacing={3}>
                                <FormControlLabel
                                    control={<Switch defaultChecked />}
                                    label="Enable Automated Processing"
                                />
                                <TextField
                                    label="Binance API Key"
                                    fullWidth
                                    type="password"
                                    defaultValue="************************"
                                    size="small"
                                />
                                <TextField
                                    label="Secret Key"
                                    fullWidth
                                    type="password"
                                    defaultValue="************************"
                                    size="small"
                                />
                                <TextField
                                    label="Max Automated Amount (per tx)"
                                    fullWidth
                                    defaultValue="100.00"
                                    size="small"
                                    helperText="Amount to auto-pay without manual review"
                                />
                                <Button variant="contained" fullWidth sx={{ borderRadius: 2, py: 1.5, fontWeight: 700 }}>
                                    Save Configuration
                                </Button>
                            </Stack>
                        </CardContent>
                    </Card>
                </Grid>

                {/* Stats */}
                <Grid size={{ xs: 12, md: 7 }}>
                    <Card sx={{ borderRadius: 4, height: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" fontWeight={700} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <AccountBalanceIcon color="primary" />
                                Balance & Payout Status
                            </Typography>
                            <Divider sx={{ my: 2 }} />

                            <Grid container spacing={2} sx={{ mb: 4 }}>
                                <Grid size={6}>
                                    <Paper sx={{ p: 2, bgcolor: '#f8fafc', textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary">Wallet Balance</Typography>
                                        <Typography variant="h5" fontWeight={800}>4,250.00 USDT</Typography>
                                    </Paper>
                                </Grid>
                                <Grid size={6}>
                                    <Paper sx={{ p: 2, bgcolor: '#f0fdf4', textAlign: 'center' }}>
                                        <Typography variant="caption" color="text.secondary">Total Auto-Paid</Typography>
                                        <Typography variant="h5" fontWeight={800} color="#16a34a">12,840.10 USDT</Typography>
                                    </Paper>
                                </Grid>
                            </Grid>

                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Recent Auto-Transactions</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>User</TableCell>
                                            <TableCell>Amount</TableCell>
                                            <TableCell>Status</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {[
                                            { user: '@jack_crypto', amount: '45.00', status: 'SUCCESS' },
                                            { user: '@miner_pro', amount: '120.00', status: 'SUCCESS' },
                                            { user: '@trader77', amount: '12.50', status: 'SUCCESS' },
                                        ].map((tx, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{tx.user}</TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" fontWeight={600}>{tx.amount} USDT</Typography>
                                                </TableCell>
                                                <TableCell><Chip label={tx.status} size="small" color="success" sx={{ fontSize: '0.65rem' }} /></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
