'use client';

import React, { useState } from 'react';
import {
    Box, Typography, Button, Paper, Stack, Grid, Card, CardContent,
    LinearProgress, Avatar, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, CircularProgress, IconButton, Divider
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import CloseIcon from '@mui/icons-material/Close';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CardGiftcardIcon from '@mui/icons-material/CardGiftcard';
import InfoIcon from '@mui/icons-material/Info';

const PREVIEW_REWARDS = [
    {
        name: 'Apple Watch Series 9',
        requirement: 'Bronze Rank • $10,000 Direct Volume',
        points: '1,000 XP',
        progress: 80,
        unlockedCount: 12,
        icon: '⌚',
        color: '#3b82f6'
    },
    {
        name: 'iPhone 15 Pro Max',
        requirement: 'Silver Rank • $50,000 Team Volume',
        points: '5,000 XP',
        progress: 45,
        unlockedCount: 3,
        icon: '📱',
        color: '#8b5cf6'
    },
    {
        name: 'VIP Trip to Dubai',
        requirement: 'Gold Rank • $250,000 Team Volume',
        points: '25,000 XP',
        progress: 15,
        unlockedCount: 1,
        icon: '✈️',
        color: '#f59e0b'
    },
    {
        name: 'Mercedes-Benz C-Class',
        requirement: 'Diamond Rank • $1,000,000 Team Volume',
        points: '100,000 XP',
        progress: 3,
        unlockedCount: 0,
        icon: '🚗',
        color: '#ef4444'
    }
];

export default function RewardsLockedPage() {
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const price = '$349.00 USD';

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
                        bgcolor: '#e0f2fe',
                        zIndex: 0
                    }}
                />

                <Stack spacing={2} sx={{ position: 'relative', zIndex: 1, mb: 5, maxWidth: 650, mx: 'auto' }} alignItems="center">
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            bgcolor: '#fef3c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(245, 158, 11, 0.15)',
                            border: '2px solid #fef3c7',
                            mb: 1
                        }}
                    >
                        <EmojiEventsIcon sx={{ fontSize: 42, color: '#f59e0b' }} />
                    </Box>
                    <Typography variant="h4" fontWeight={900} sx={{ color: '#1e293b', letterSpacing: '-0.02em', textAlign: 'center' }}>
                        Gamified Achievements & Rewards
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', lineHeight: 1.6, textAlign: 'center', fontSize: '1.05rem' }}>
                        Supercharge downline team growth. Offer ranks, points, and physical goods in a fully-integrated rewards catalog for achieving team sales volumes.
                    </Typography>
                </Stack>

                <Grid container spacing={{ xs: 4, md: 6 }} alignItems="stretch" sx={{ position: 'relative', zIndex: 1, mb: 4 }}>
                    {/* Catalog Preview Column */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Stack spacing={3}>
                            <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Interactive Reward Catalog Preview:
                            </Typography>
                            
                            {PREVIEW_REWARDS.map((reward, index) => (
                                <Card key={index} sx={{ borderRadius: 3, border: '1px solid #f1f5f9', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                                    <CardContent sx={{ p: 2.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
                                            <Avatar sx={{ bgcolor: `${reward.color}15`, width: 44, height: 44, fontSize: 24 }}>
                                                {reward.icon}
                                            </Avatar>
                                            <Box sx={{ flex: 1 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="subtitle2" fontWeight={800} color="#1e293b">
                                                        {reward.name}
                                                    </Typography>
                                                    <Typography variant="caption" fontWeight={700} color="primary" sx={{ bgcolor: '#eff6ff', px: 1, py: 0.2, borderRadius: 1 }}>
                                                        {reward.points}
                                                    </Typography>
                                                </Box>
                                                <Typography variant="caption" color="text.secondary">
                                                    {reward.requirement}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Box sx={{ flex: 1 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                                        Global Target Progress
                                                    </Typography>
                                                    <Typography variant="caption" fontWeight={700} color="#475569">
                                                        {reward.progress}%
                                                    </Typography>
                                                </Box>
                                                <LinearProgress 
                                                    variant="determinate" 
                                                    value={reward.progress} 
                                                    sx={{ 
                                                        height: 6, 
                                                        borderRadius: 3, 
                                                        bgcolor: '#e2e8f0', 
                                                        '& .MuiLinearProgress-bar': { bgcolor: reward.color, borderRadius: 3 } 
                                                    }} 
                                                />
                                            </Box>
                                            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.65rem' }}>
                                                    Claimed
                                                </Typography>
                                                <Typography variant="subtitle2" fontWeight={800} color="#1e293b">
                                                    {reward.unlockedCount}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>
                            ))}
                        </Stack>
                    </Grid>

                    {/* Features Column */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Stack spacing={4} sx={{ height: '100%', justifyContent: 'center' }}>
                            <Stack spacing={2}>
                                <Typography variant="h6" fontWeight={800} color="#334155">
                                    Why Implement Gamification?
                                </Typography>
                                <Grid container spacing={2}>
                                    {[
                                        "Drives team volume and active recruitment",
                                        "Automated XP and rank tracking on payouts",
                                        "Milestone notifications sent to Telegram bots",
                                        "Built-in verification queue for shipping physical rewards",
                                        "Customizable direct-volume criteria thresholds",
                                        "Boosts user lifecycle and retention values"
                                    ].map((feat, idx) => (
                                        <Grid size={{ xs: 12 }} key={idx}>
                                            <Stack direction="row" spacing={1.5} alignItems="center">
                                                <CheckCircleIcon sx={{ fontSize: 20, color: '#f59e0b' }} />
                                                <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600 }}>
                                                    {feat}
                                                </Typography>
                                            </Stack>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Stack>

                            <Paper sx={{ p: 2.5, bgcolor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 3 }}>
                                <Stack direction="row" spacing={2} alignItems="flex-start">
                                    <InfoIcon sx={{ color: '#f59e0b', mt: 0.2 }} />
                                    <Typography variant="body2" color="#78350f" sx={{ lineHeight: 1.6 }}>
                                        <b>Platform Mechanics:</b> The shop system connects to the user's Downline repository automatically. When users achieve rank volumes, the system prompts them to verify their delivery address or wallet ID.
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
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                fontWeight: 800,
                                textTransform: 'none',
                                fontSize: '1rem',
                                boxShadow: '0 8px 16px rgba(245, 158, 11, 0.2)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                                    transform: 'translateY(-2px)',
                                },
                                transition: 'all 0.2s ease'
                            }}
                        >
                            Upgrade Plan
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
                        * This feature requires Gamification Achievement Database integration.
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
                    Unlock Achievement Shop
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
                            bgcolor: '#fff9db',
                            color: '#f59e0b',
                            mb: 2
                        }}>
                            <CloudDoneIcon sx={{ fontSize: 32 }} />
                        </Box>
                        <Typography variant="h5" fontWeight={900} color="primary" gutterBottom>
                            {price}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Get lifetime access to the Achievements Engine, including custom rank triggers and shipping confirmation queues.
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
