'use client';

import React, { useState } from 'react';
import {
    Box, Typography, Button, Paper, Stack, Grid, Card, CardContent,
    TextField, MenuItem, Select, FormControl, InputLabel,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, IconButton
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import CloseIcon from '@mui/icons-material/Close';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import InfoIcon from '@mui/icons-material/Info';

const PREVIEW_CAMPAIGNS = [
    {
        code: 'VIP_INFLUENCER_50',
        type: 'Free Mining Power',
        value: '+50 MP',
        claimed: '100 / 100',
        deposits: '$18,400.00 USDT',
        status: 'COMPLETED'
    },
    {
        code: 'SUMMER_DEPOSIT_20',
        type: 'Deposit Bonus',
        value: '20% extra TP',
        claimed: '45 / 250',
        deposits: '$6,850.00 USDT',
        status: 'ACTIVE'
    },
    {
        code: 'REINVEST_BOOST_5',
        type: 'Compounding Bonus',
        value: '+5% daily yield',
        claimed: '12 / 500',
        deposits: '$1,200.00 USDT',
        status: 'ACTIVE'
    }
];

export default function CampaignsLockedPage() {
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Mock Form State for interactivity
    const [formCode, setFormCode] = useState('GOLDEN_HOUR');
    const [formType, setFormType] = useState('mining_power');
    const [formValue, setFormValue] = useState('20');
    const [formLimit, setFormLimit] = useState('100');

    const price = '$299.00 USD';

    const handleUpgradeClick = () => setOpen(true);
    const handleClose = () => {
        setOpen(false);
        setSubmitting(false);
    };

    const handleSubmit = () => {
        setSubmitting(true);
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', px: 2, py: 4 }}>
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 3, md: 5 },
                    borderRadius: 6,
                    bgcolor: 'white',
                    maxWidth: 950,
                    width: '100%',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.1)',
                    border: '1px solid rgba(0,0,0,0.06)',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Background Decoration */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: -40,
                        right: -40,
                        width: 150,
                        height: 150,
                        borderRadius: '50%',
                        bgcolor: '#fdf2f8', // pink glow
                        zIndex: 0
                    }}
                />

                <Stack spacing={2} sx={{ position: 'relative', zIndex: 1, mb: 5, maxWidth: 650, mx: 'auto' }} alignItems="center">
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            bgcolor: '#fdf2f8',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(219, 39, 119, 0.15)',
                            border: '2px solid #fbcfe8',
                            mb: 1
                        }}
                    >
                        <LocalOfferIcon sx={{ fontSize: 42, color: '#db2777' }} />
                    </Box>
                    <Typography variant="h4" fontWeight={900} sx={{ color: '#1e293b', letterSpacing: '-0.02em', textAlign: 'center' }}>
                        Growth & Promo Campaigns
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', lineHeight: 1.6, textAlign: 'center', fontSize: '1.05rem' }}>
                        Create coupon codes, custom voucher links, and marketing analytics to track conversion ratios of your promotional payouts and referrals.
                    </Typography>
                </Stack>

                <Grid container spacing={{ xs: 4, md: 5 }} alignItems="stretch" sx={{ position: 'relative', zIndex: 1, mb: 4 }}>
                    {/* Mock Creator Form Column */}
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Card sx={{ borderRadius: 4, height: '100%', border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="subtitle2" fontWeight={800} color="#1e293b" sx={{ mb: 2 }}>
                                    Promo Code Creator
                                </Typography>
                                <Stack spacing={2.5}>
                                    <TextField
                                        label="Promo Code Name"
                                        fullWidth
                                        value={formCode}
                                        onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                                        size="small"
                                    />
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Promo Type</InputLabel>
                                        <Select
                                            value={formType}
                                            label="Promo Type"
                                            onChange={(e) => setFormType(e.target.value)}
                                        >
                                            <MenuItem value="mining_power">Free Mining Power (USDT/MP)</MenuItem>
                                            <MenuItem value="deposit_bonus">Deposit Match %</MenuItem>
                                            <MenuItem value="roi_boost">Daily ROI Settlement Booster</MenuItem>
                                        </Select>
                                    </FormControl>
                                    <TextField
                                        label="Value"
                                        fullWidth
                                        value={formValue}
                                        onChange={(e) => setFormValue(e.target.value)}
                                        size="small"
                                        placeholder="e.g. 50 MP or 10%"
                                    />
                                    <TextField
                                        label="Usage Limit Cap"
                                        fullWidth
                                        value={formLimit}
                                        onChange={(e) => setFormLimit(e.target.value)}
                                        size="small"
                                    />
                                    <Button
                                        variant="contained"
                                        disabled
                                        sx={{
                                            mt: 1,
                                            py: 1.2,
                                            borderRadius: 2.5,
                                            textTransform: 'none',
                                            fontWeight: 700,
                                            background: 'linear-gradient(135deg, #db2777 0%, #be185d 100%)',
                                        }}
                                    >
                                        Create Campaign
                                    </Button>
                                </Stack>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Stats List Column */}
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Stack spacing={3} sx={{ height: '100%', justifyContent: 'space-between' }}>
                            <TableContainer component={Paper} sx={{ borderRadius: 4, border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                                <Table size="small">
                                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 800, py: 1.5 }}>Code</TableCell>
                                            <TableCell sx={{ fontWeight: 800, py: 1.5 }}>Reward</TableCell>
                                            <TableCell sx={{ fontWeight: 800, py: 1.5 }}>Claimed</TableCell>
                                            <TableCell sx={{ fontWeight: 800, py: 1.5 }}>Total Sales</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {PREVIEW_CAMPAIGNS.map((camp, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell sx={{ py: 1.5 }}>
                                                    <Typography variant="body2" fontWeight={700} color="#1e293b">
                                                        {camp.code}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {camp.type}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ py: 1.5 }}>
                                                    <Chip label={camp.value} size="small" sx={{ bgcolor: '#fdf2f8', color: '#db2777', fontWeight: 700, fontSize: '0.7rem' }} />
                                                </TableCell>
                                                <TableCell sx={{ py: 1.5 }}>
                                                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                                                        {camp.claimed}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ py: 1.5 }}>
                                                    <Typography variant="body2" fontWeight={700} color="#16a34a">
                                                        {camp.deposits}
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <Paper sx={{ p: 2.5, bgcolor: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: 3 }}>
                                <Stack direction="row" spacing={2} alignItems="flex-start">
                                    <InfoIcon sx={{ color: '#db2777', mt: 0.2 }} />
                                    <Typography variant="body2" color="#9d174d" sx={{ lineHeight: 1.6 }}>
                                        <b>Conversion Tracking:</b> This module includes UTM attribution tracking. If users register through an influencer's custom code link, the analytics board tracks downline transaction conversions.
                                    </Typography>
                                </Stack>
                            </Paper>
                        </Stack>
                    </Grid>
                </Grid>

                {/* Bottom CTA Section */}
                <Stack spacing={2} alignItems="center" sx={{ mt: 5, position: 'relative', zIndex: 1 }}>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={2}
                        sx={{ width: '100%', justifyContent: 'center' }}
                    >
                        <Button
                            variant="contained"
                            onClick={handleUpgradeClick}
                            startIcon={<RocketLaunchIcon sx={{ fontSize: 20 }} />}
                            sx={{
                                px: 6,
                                py: 1.8,
                                borderRadius: 3.5,
                                background: 'linear-gradient(135deg, #db2777 0%, #be185d 100%)',
                                fontWeight: 800,
                                textTransform: 'none',
                                fontSize: '1rem',
                                boxShadow: '0 8px 16px rgba(219, 39, 119, 0.2)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #be185d 0%, #9d174d 100%)',
                                    transform: 'translateY(-2px)',
                                },
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Activate Feature
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<SecurityIcon sx={{ fontSize: 20 }} />}
                            sx={{
                                px: 4,
                                py: 1.8,
                                borderRadius: 3.5,
                                color: '#64748b',
                                borderColor: '#e2e8f0',
                                fontWeight: 700,
                                textTransform: 'none',
                                fontSize: '1rem',
                                '&:hover': {
                                    borderColor: '#cbd5e1',
                                    bgcolor: '#f8fafc'
                                }
                            }}
                        >
                            Contact Support
                        </Button>
                    </Stack>

                    <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.75rem', fontWeight: 500 }}>
                        * This feature requires Promo Code Database integration.
                    </Typography>
                </Stack>
            </Paper>

            {/* Upgrade Dialog */}
            <Dialog
                open={open}
                onClose={handleClose}
                PaperProps={{
                    sx: {
                        borderRadius: 5,
                        maxWidth: 450,
                        width: '100%',
                        p: 1
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Unlock Campaign Engine
                    <IconButton onClick={handleClose} size="small" sx={{ color: '#94a3b8' }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Box sx={{
                            display: 'inline-flex',
                            p: 2,
                            borderRadius: '50%',
                            bgcolor: '#fdf2f8',
                            color: '#db2777',
                            mb: 2
                        }}>
                            <CloudDoneIcon sx={{ fontSize: 32 }} />
                        </Box>
                        <Typography variant="h5" fontWeight={900} color="primary" gutterBottom>
                            {price}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Get lifetime access to the Promo & Campaign Builder, including code verification logs and click-to-purchase ratios.
                        </Typography>

                        <Stack spacing={2} sx={{ textAlign: 'left' }}>
                            <TextField
                                label="Full Name"
                                fullWidth
                                variant="outlined"
                                defaultValue="Admin"
                                size="small"
                                disabled={submitting}
                            />
                            <TextField
                                label="Business Email"
                                fullWidth
                                variant="outlined"
                                placeholder="admin@example.com"
                                size="small"
                                disabled={submitting}
                            />
                        </Stack>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 0 }}>
                    <Button
                        fullWidth
                        variant="contained"
                        size="large"
                        disabled={submitting}
                        onClick={handleSubmit}
                        sx={{
                            borderRadius: 3.5,
                            py: 1.8,
                            fontWeight: 800,
                            textTransform: 'none',
                            bgcolor: '#1e293b',
                            '&:hover': { bgcolor: '#0f172a' }
                        }}
                    >
                        {submitting ? <CircularProgress size={24} color="inherit" /> : 'Activate Now'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
