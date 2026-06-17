'use client';

import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Button, Paper, Stack, Grid, Card, CardContent,
    Dialog, DialogTitle, DialogContent, DialogActions, TextField,
    CircularProgress, IconButton, Alert, List, ListItem, ListItemIcon, ListItemText,
    Chip
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import CloseIcon from '@mui/icons-material/Close';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PsychologyIcon from '@mui/icons-material/Psychology';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SpeedIcon from '@mui/icons-material/Speed';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InfoIcon from '@mui/icons-material/Info';

export default function AIAnalyticsLockedPage() {
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // AI audit generation states
    const [generating, setGenerating] = useState(false);
    const [auditOutput, setAuditOutput] = useState<string | null>(null);

    const price = '$499.00 USD';

    const handleUpgradeClick = () => setOpen(true);
    const handleClose = () => {
        setOpen(false);
        setSubmitting(false);
    };

    const handleSubmit = () => {
        setSubmitting(true);
    };

    const handleGenerateAudit = () => {
        setGenerating(true);
        setAuditOutput(null);
        setTimeout(() => {
            setGenerating(false);
            setAuditOutput(
                `[AI SYSTEM AUDIT REPORT - TRADE EDGE ENGINE]
--------------------------------------------------
● POOL SUSTAINABILITY: 94% (EXTREMELY HEALTHY)
● 14-DAY LIQUIDITY RISK: LOW (2.4% PROBABILITY OF RESIDUAL GAP)
● INCOMING VELOCITY COEFFICIENT: +18.4% GROWTH

[KEY OBSERVATIONS]
1. Referral nodes in Tier 2/Tier 3 are exhibiting high viral growth coefficients, outperforming direct signups.
2. The reinvestment rate is stabilized at 42%. This reduces short-term withdrawal liabilities.

[RECOMMENDED ACTION ITEMS]
✔ Setup a "+5% ROI booster promo code" valid for 48 hours to lock in weekend deposit volume spikes.
✔ Note: Duplicate IP logs flag 3 specific downlines transferring commissions in rapid succession. Recommend fraud team investigation.`
            );
        }, 1500);
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', px: 2, py: 4 }}>
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 3, md: 5 },
                    borderRadius: 6,
                    bgcolor: 'white',
                    maxWidth: 1000,
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
                        bgcolor: '#faf5ff', // purple glow
                        zIndex: 0
                    }}
                />

                <Stack spacing={2} sx={{ position: 'relative', zIndex: 1, mb: 5, maxWidth: 650, mx: 'auto' }} alignItems="center">
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            bgcolor: '#f5f3ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(139, 92, 246, 0.15)',
                            border: '2px solid #ddd6fe',
                            mb: 1
                        }}
                    >
                        <PsychologyIcon sx={{ fontSize: 42, color: '#8b5cf6' }} />
                    </Box>
                    <Typography variant="h4" fontWeight={900} sx={{ color: '#1e293b', letterSpacing: '-0.02em', textAlign: 'center' }}>
                        AI-Powered Business Intelligence
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', lineHeight: 1.6, textAlign: 'center', fontSize: '1.05rem' }}>
                        Automate platform analytics and forecast cash flow health. Predict user retention rates, detect fraud anomalies, and receive real-time optimization alerts.
                    </Typography>
                </Stack>

                <Grid container spacing={4} sx={{ position: 'relative', zIndex: 1, mb: 4 }} alignItems="stretch">
                    {/* Simulated KPI Metrics Grid */}
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Stack spacing={2.5}>
                            <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Predicted Health Scores:
                            </Typography>
                            
                            <Grid container spacing={2}>
                                <Grid size={6}>
                                    <Card sx={{ bgcolor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 3, textAlign: 'center' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={600}>Stability Score</Typography>
                                            <Typography variant="h5" fontWeight={900} color="#8b5cf6" sx={{ mt: 0.5 }}>94%</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={6}>
                                    <Card sx={{ bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 3, textAlign: 'center' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={600}>Liquidity Risk</Typography>
                                            <Typography variant="h5" fontWeight={900} color="#16a34a" sx={{ mt: 0.5 }}>2.4%</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={6}>
                                    <Card sx={{ bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 3, textAlign: 'center' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={600}>Deposit Growth</Typography>
                                            <Typography variant="h5" fontWeight={900} color="#1e40af" sx={{ mt: 0.5 }}>+18.4%</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={6}>
                                    <Card sx={{ bgcolor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 3, textAlign: 'center' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Typography variant="caption" color="text.secondary" fontWeight={600}>Reinvest Target</Typography>
                                            <Typography variant="h5" fontWeight={900} color="#d97706" sx={{ mt: 0.5 }}>42%</Typography>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>

                            <Paper sx={{ p: 2.5, bgcolor: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 3 }}>
                                <Stack direction="row" spacing={1.5}>
                                    <AutoAwesomeIcon sx={{ color: '#8b5cf6', mt: 0.2 }} />
                                    <Typography variant="body2" color="#6b21a8" sx={{ lineHeight: 1.6 }}>
                                        <b>AI Risk Model:</b> The engine runs predictive monte-carlo simulations of deposit/withdrawal patterns to ensure the ROI settlement pool is optimized against black-swan cash-out events.
                                    </Typography>
                                </Stack>
                            </Paper>
                        </Stack>
                    </Grid>

                    {/* Interactive AI Terminal Column */}
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Card sx={{ height: '100%', borderRadius: 4, border: '1px solid #e2e8f0', bgcolor: '#0f172a', display: 'flex', flexDirection: 'column', color: '#f8fafc', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                            <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="subtitle2" fontWeight={800} color="#94a3b8" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <SpeedIcon sx={{ color: '#8b5cf6', fontSize: 18 }} />
                                        AI System Consultant
                                    </Typography>
                                    <Chip label="GPT-4 Integration" size="small" sx={{ bgcolor: '#1e293b', color: '#a78bfa', fontWeight: 700, fontSize: '0.65rem', border: '1px solid #7c3aed' }} />
                                </Box>

                                <Box sx={{ flex: 1, bgcolor: '#020617', border: '1px solid #1e293b', borderRadius: 2.5, p: 2, fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: 1.5, minHeight: 180, display: 'flex', flexDirection: 'column', justifyContent: auditOutput ? 'flex-start' : 'center', alignItems: auditOutput ? 'stretch' : 'center' }}>
                                    {generating ? (
                                        <Box sx={{ textAlign: 'center' }}>
                                            <CircularProgress size={24} sx={{ color: '#8b5cf6', mb: 1.5 }} />
                                            <Typography variant="caption" sx={{ color: '#94a3b8', display: 'block' }}>Analyzing platform cashflow histories...</Typography>
                                        </Box>
                                    ) : auditOutput ? (
                                        <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap', color: '#38bdf8', fontFamily: 'monospace', m: 0 }}>
                                            {auditOutput}
                                        </Typography>
                                    ) : (
                                        <Box sx={{ textAlign: 'center', px: 2 }}>
                                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2, color: '#64748b' }}>
                                                Click Generate Audit to perform a simulated AI sustainability assessment of the platform cashflow reserves.
                                            </Typography>
                                            <Button 
                                                variant="contained" 
                                                onClick={handleGenerateAudit}
                                                size="small"
                                                sx={{ 
                                                    textTransform: 'none', 
                                                    fontWeight: 700, 
                                                    bgcolor: '#8b5cf6',
                                                    '&:hover': { bgcolor: '#7c3aed' }
                                                }}
                                            >
                                                Generate Audit
                                            </Button>
                                        </Box>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
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
                                background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                                fontWeight: 800,
                                textTransform: 'none',
                                fontSize: '1rem',
                                boxShadow: '0 8px 16px rgba(139, 92, 246, 0.2)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
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
                        * This feature requires AWS AI Analytics Cloud integration.
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
                    Unlock AI Business Analytics
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
                            bgcolor: '#f5f3ff',
                            color: '#8b5cf6',
                            mb: 2
                        }}>
                            <CloudDoneIcon sx={{ fontSize: 32 }} />
                        </Box>
                        <Typography variant="h5" fontWeight={900} color="primary" gutterBottom>
                            {price}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Get lifetime access to AI Business Intelligence tools, including cashflow sustainability predictions and system security audit reports.
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
