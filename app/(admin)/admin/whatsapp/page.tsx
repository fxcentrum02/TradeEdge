'use client';

import React, { useState } from 'react';
import {
    Box, Typography, Button, Paper, Stack, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, CircularProgress, IconButton,
    Grid, Tabs, Tab, Avatar, Card, CardContent, Divider, Alert
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import CloseIcon from '@mui/icons-material/Close';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import SendIcon from '@mui/icons-material/Send';
import InfoIcon from '@mui/icons-material/Info';

const NOTIFICATION_TEMPLATES = [
    {
        key: 'deposit',
        label: 'Deposit',
        title: '🟢 Deposit Successful',
        body: 'Your deposit has been approved and credited to your account. Your mining power is now active.',
        details: [
            { label: 'Amount', value: '500.00 USDT' },
            { label: 'Mining Power', value: '+500 MP' },
            { label: 'Status', value: 'COMPLETED' },
        ],
        buttonText: '⚡ Open Dashboard',
        footer: 'Trade Edge Automation'
    },
    {
        key: 'withdraw',
        label: 'Withdraw',
        title: '🔴 Withdrawal Processed',
        body: 'Your withdrawal request has been completed and sent to your registered crypto wallet address.',
        details: [
            { label: 'Amount', value: '150.00 USDT' },
            { label: 'Tx Hash', value: '0x9a8f...3d2e' },
            { label: 'Status', value: 'SUCCESS' },
        ],
        buttonText: '💸 View Transaction',
        footer: 'Trade Edge Wallet Security'
    },
    {
        key: 'new_user',
        label: 'New User',
        title: '🤝 New Team Member',
        body: 'Great news! A new user has registered using your referral link. Tap below to see your updated downline tree.',
        details: [
            { label: 'User', value: '@alex_miner' },
            { label: 'Level', value: 'Level 1 Direct' },
            { label: 'Bonus', value: 'Active ROI Share Enabled' },
        ],
        buttonText: '👥 View My Team',
        footer: 'Trade Edge Referral System'
    },
    {
        key: 'reinvest',
        label: 'Reinvest',
        title: '🔄 Reinvest Completed',
        body: 'Your reinvestment of daily earnings was processed successfully. Compounding has been applied.',
        details: [
            { label: 'Amount', value: '75.00 USDT' },
            { label: 'Compounding', value: '+75 MP' },
            { label: 'New Daily ROI', value: '4.50 USDT/day' },
        ],
        buttonText: '📈 Track Growth',
        footer: 'Trade Edge Compounding'
    },
    {
        key: 'owner_alerts',
        label: 'Owner',
        title: '👑 Owner / Admin Alert',
        body: 'Owner Alert: A new transaction activity has occurred on Trade Edge. Action may be required.',
        details: [
            { label: 'Event', value: 'New Deposit Ticket Submitted' },
            { label: 'User', value: '@trader_pro (ID: 8872)' },
            { label: 'Amount', value: '1,200.00 USDT' },
            { label: 'Action Required', value: 'Approve / Reject Ticket' },
        ],
        buttonText: '🔑 Open Admin Panel',
        footer: 'Trade Edge Admin Core Engine'
    }
];

export default function WhatsAppAlertsPage() {
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [fullName, setFullName] = useState('Admin');
    const [email, setEmail] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [success, setSuccess] = useState(false);

    const price = '$399.00 USD + WhatsApp Charges';

    const handleUpgradeClick = () => {
        setOpen(true);
        setSuccess(false);
        setErrorMsg('');

        // Log the main page click alert immediately
        fetch('/api/admin/feature-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                featureTitle: 'WhatsApp Business Alerts',
                price,
                action: 'click'
            })
        }).catch(() => {});
    };

    const handleClose = () => {
        setOpen(false);
        setSubmitting(false);
        setSuccess(false);
        setErrorMsg('');
        setEmail('');
    };

    const handleSubmit = async () => {
        if (!fullName.trim() || !email.trim()) {
            setErrorMsg('Please enter both your name and business email.');
            return;
        }
        setErrorMsg('');
        setSubmitting(true);
        try {
            const res = await fetch('/api/admin/feature-requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    featureTitle: 'WhatsApp Business Alerts',
                    fullName,
                    email,
                    price
                })
            });
            const data = await res.json();
            if (data.success) {
                setSuccess(true);
            } else {
                setErrorMsg(data.error || 'Failed to submit activation request.');
            }
        } catch {
            setErrorMsg('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const currentTemplate = NOTIFICATION_TEMPLATES[activeTab];

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '85vh',
                px: 2,
                py: 4
            }}
        >
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
                        bgcolor: '#25d3660a', // Subtle WhatsApp green glow
                        zIndex: 0
                    }}
                />

                <Stack spacing={2} sx={{ position: 'relative', zIndex: 1, mb: 5, maxWidth: 650, mx: 'auto' }} alignItems="center">
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            bgcolor: '#f0fdf4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(37, 211, 102, 0.15)',
                            border: '2px solid #dcfce7',
                            mb: 1
                        }}
                    >
                        <WhatsAppIcon sx={{ fontSize: 42, color: '#25d366' }} />
                    </Box>
                    <Typography variant="h4" fontWeight={900} sx={{ color: '#1e293b', letterSpacing: '-0.02em', textAlign: 'center' }}>
                        WhatsApp Business Alerts
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', lineHeight: 1.6, textAlign: 'center', fontSize: '1.05rem' }}>
                        Notify your users instantly directly on WhatsApp. Deliver deposit, withdrawal, reinvest, and referral notifications using interactive, rich messaging template cards.
                    </Typography>
                </Stack>

                <Grid container spacing={3} alignItems="stretch" sx={{ position: 'relative', zIndex: 1, mb: 4 }}>
                    {/* Interactive Phone Preview Column */}
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'center' }}>
                            {/* Device Frame */}
                            <Box
                                sx={{
                                    width: '100%',
                                    maxWidth: 300,
                                    height: 480,
                                    borderRadius: '40px',
                                    border: '10px solid #1e293b',
                                    position: 'relative',
                                    boxShadow: '0 20px 50px rgba(0,0,0,0.15)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    overflow: 'hidden',
                                    bgcolor: '#efeae2', // WhatsApp chat wallpaper color
                                }}
                            >
                                {/* Phone Notch */}
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: 110,
                                        height: 18,
                                        bgcolor: '#1e293b',
                                        borderBottomLeftRadius: '12px',
                                        borderBottomRightRadius: '12px',
                                        zIndex: 10
                                    }}
                                />

                                {/* WhatsApp Header */}
                                <Box
                                    sx={{
                                        bgcolor: '#075e54',
                                        color: 'white',
                                        pt: 3.5,
                                        pb: 1,
                                        px: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }}
                                >
                                    <Avatar sx={{ width: 28, height: 28, bgcolor: 'var(--brand-main)', fontSize: 13, color: '#1a1a1a', fontWeight: 900 }}>
                                        TE
                                    </Avatar>
                                    <Box>
                                        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1 }}>
                                            Trade Edge Alerts
                                        </Typography>
                                        <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.65rem' }}>
                                            Official Business Bot
                                        </Typography>
                                    </Box>
                                </Box>

                                {/* WhatsApp Chat Area */}
                                <Box sx={{ flex: 1, p: 2, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                                    {/* Message Card */}
                                    <Box
                                        sx={{
                                            bgcolor: 'white',
                                            borderRadius: 2.5,
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                                            width: '100%',
                                            position: 'relative',
                                            overflow: 'hidden',
                                            border: '1px solid rgba(0,0,0,0.05)',
                                            mb: 1.5,
                                            animation: 'fadeIn 0.3s ease-in-out'
                                        }}
                                    >
                                        {/* Optional Image Area */}
                                        <Box sx={{ p: 2, pb: 1.5 }}>
                                            <Typography variant="subtitle2" fontWeight={800} color="#1f2937" sx={{ display: 'block', mb: 1 }}>
                                                {currentTemplate.title}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4, mb: 1.5 }}>
                                                {currentTemplate.body}
                                            </Typography>

                                            <Stack spacing={1} sx={{ bgcolor: '#f9fafb', p: 1.5, borderRadius: 2, border: '1px solid #f3f4f6' }}>
                                                {currentTemplate.details.map((detail, index) => (
                                                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                                            {detail.label}
                                                        </Typography>
                                                        <Typography variant="caption" fontWeight={700} color="#374151" sx={{ fontSize: '0.65rem' }}>
                                                            {detail.value}
                                                        </Typography>
                                                    </Box>
                                                ))}
                                            </Stack>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.6rem', mt: 1, opacity: 0.8 }}>
                                                {currentTemplate.footer}
                                            </Typography>
                                        </Box>
                                        
                                        {/* Button Actions - WhatsApp Quick Reply style */}
                                        <Box sx={{ borderTop: '1px solid #f3f4f6', bgcolor: '#fafafa', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Button
                                                size="small"
                                                variant="text"
                                                disabled
                                                startIcon={<SendIcon sx={{ fontSize: 12, color: '#0ea5e9' }} />}
                                                sx={{
                                                    textTransform: 'none',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 700,
                                                    color: '#0ea5e9 !important',
                                                    p: 0.2
                                                }}
                                            >
                                                {currentTemplate.buttonText}
                                            </Button>
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Grid>

                    {/* Features Column */}
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Stack spacing={4} sx={{ height: '100%', justifyContent: 'center' }}>
                            <Box>
                                <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Select Alert Template Preview:
                                </Typography>
                                <Tabs
                                    value={activeTab}
                                    onChange={(e, val) => setActiveTab(val)}
                                    variant="scrollable"
                                    scrollButtons="auto"
                                    sx={{
                                        borderBottom: '1px solid #e2e8f0',
                                        '& .MuiTab-root': { 
                                            textTransform: 'none', 
                                            fontWeight: 700, 
                                            fontSize: '0.85rem',
                                            minWidth: 'auto',
                                            px: 1.5
                                        },
                                        '& .Mui-selected': { color: '#25d366 !important' },
                                        '& .MuiTabs-indicator': { bgcolor: '#25d366' },
                                    }}
                                >
                                    {NOTIFICATION_TEMPLATES.map((t, idx) => (
                                        <Tab key={t.key} label={t.label} />
                                    ))}
                                </Tabs>
                            </Box>

                            <Stack spacing={2}>
                                <Typography variant="h6" fontWeight={800} color="#334155">
                                    Feature Specs
                                </Typography>
                                <Grid container spacing={2}>
                                    {[
                                        "Automated withdrawal notifications",
                                        "Instant deposit receipt confirmations",
                                        "Level 1-20 downline welcome notifications",
                                        "Compounding & reinvest updates",
                                        "Interactive quick-action buttons",
                                        "Owner/Admin transaction tracking alerts",
                                        "Custom marketing campaign integration"
                                    ].map((feat, idx) => (
                                        <Grid size={{ xs: 12, sm: 6 }} key={idx}>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <CheckCircleIcon sx={{ fontSize: 20, color: '#25d366' }} />
                                                <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
                                                    {feat}
                                                </Typography>
                                            </Stack>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Stack>
                            
                            <Paper sx={{ p: 2.5, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 3 }}>
                                <Stack direction="row" spacing={2} alignItems="flex-start">
                                    <InfoIcon sx={{ color: '#25d366', mt: 0.2 }} />
                                    <Typography variant="body2" color="#166534" sx={{ lineHeight: 1.6 }}>
                                        <b>Pricing Terms:</b> The WhatsApp integration requires a one-time gateway setup charge of <b>$399.00 USD</b>, plus standard Meta API message transmission charges based on destination country rates.
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
                                background: 'linear-gradient(135deg, #25d366 0%, #128c7e 100%)',
                                fontWeight: 800,
                                textTransform: 'none',
                                fontSize: '1rem',
                                boxShadow: '0 8px 20px rgba(37, 211, 102, 0.25)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #128c7e 0%, #075e54 100%)',
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
                        * This feature requires Meta Business API Cloud Service integration.
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
                    {success ? 'Activation Initiated' : 'Unlock WhatsApp Alerts'}
                    <IconButton onClick={handleClose} size="small" sx={{ color: '#94a3b8' }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    {success ? (
                        <Box sx={{ textAlign: 'center', py: 3, px: 1 }}>
                            <Box sx={{
                                display: 'inline-flex',
                                p: 2,
                                borderRadius: '50%',
                                bgcolor: '#f0fdf4',
                                color: '#16a34a',
                                mb: 3,
                                boxShadow: '0 8px 24px rgba(22, 163, 74, 0.15)',
                            }}>
                                <CheckCircleIcon sx={{ fontSize: 48 }} />
                            </Box>
                            <Typography variant="h5" fontWeight={900} sx={{ color: '#1e293b', mb: 1.5, letterSpacing: '-0.02em' }}>
                                Request Submitted!
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6 }}>
                                Your activation ticket for <strong>WhatsApp Business Alerts</strong> has been successfully registered. The dev team is provisioning a dedicated container for this feature node.
                            </Typography>
                        </Box>
                    ) : (
                        <Box sx={{ textAlign: 'center', py: 2 }}>
                            <Box sx={{
                                display: 'inline-flex',
                                p: 2,
                                borderRadius: '50%',
                                bgcolor: '#f0fdf4',
                                color: '#25d366',
                                mb: 2
                            }}>
                                <CloudDoneIcon sx={{ fontSize: 32 }} />
                            </Box>
                            <Typography variant="h5" fontWeight={900} color="primary" gutterBottom>
                                {price}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                                Get lifetime access to the WhatsApp Notification Engine, including interactive button replies for all core platform activities.
                            </Typography>

                            {errorMsg && (
                                <Alert severity="error" variant="filled" sx={{ mb: 2.5, borderRadius: 2, fontSize: '0.8rem' }}>
                                    {errorMsg}
                                </Alert>
                            )}

                            <Stack spacing={2} sx={{ textAlign: 'left' }}>
                                <TextField
                                    label="Full Name"
                                    fullWidth
                                    variant="outlined"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    size="small"
                                    disabled={submitting}
                                />
                                <TextField
                                    label="Business Email"
                                    fullWidth
                                    variant="outlined"
                                    placeholder="admin@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    size="small"
                                    disabled={submitting}
                                />
                            </Stack>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 0 }}>
                    {success ? (
                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            onClick={handleClose}
                            sx={{
                                borderRadius: 3.5,
                                py: 1.8,
                                fontWeight: 800,
                                textTransform: 'none',
                                bgcolor: '#0f172a',
                                '&:hover': { bgcolor: '#1e293b' }
                            }}
                        >
                            Understood, Close
                        </Button>
                    ) : (
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
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    );
}
