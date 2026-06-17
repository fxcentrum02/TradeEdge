'use client';

import React, { useState } from 'react';
import {
    Box, Typography, Button, Paper, Stack, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, CircularProgress, IconButton,
    Grid, Alert
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import CloseIcon from '@mui/icons-material/Close';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface LockedFeatureViewProps {
    title: string;
    description: string;
    icon?: React.ReactNode;
    price?: string;
    features?: string[];
    imageUrl?: string;
}

export default function LockedFeatureView({ 
    title, 
    description, 
    icon, 
    price = '$399.00 USD',
    features = [],
    imageUrl
}: LockedFeatureViewProps) {
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [fullName, setFullName] = useState('Admin');
    const [email, setEmail] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [success, setSuccess] = useState(false);

    const handleUpgradeClick = () => {
        setOpen(true);
        setSuccess(false);
        setErrorMsg('');

        // Notify server immediately that the user clicked on the main page
        fetch('/api/admin/feature-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                featureTitle: title.replace(' Locked', ''),
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
                    featureTitle: title.replace(' Locked', ''),
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

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '80vh',
                px: 2,
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 3, md: 4 },
                    borderRadius: 6,
                    bgcolor: 'white',
                    maxWidth: 820,
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
                        bgcolor: '#fbbf2410',
                        zIndex: 0
                    }}
                />

                <Stack spacing={2} sx={{ position: 'relative', zIndex: 1, mb: 4, maxWidth: 600, mx: 'auto' }} alignItems="center">
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            bgcolor: '#fff7ed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(245, 158, 11, 0.15)',
                            border: '2px solid #fef3c7',
                            mb: 1
                        }}
                    >
                        <LockOutlinedIcon sx={{ fontSize: 40, color: '#f59e0b' }} />
                    </Box>
                    <Typography variant="h4" fontWeight={900} sx={{ color: '#1e293b', letterSpacing: '-0.02em', textAlign: 'center' }}>
                        {title}
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', lineHeight: 1.6, textAlign: 'center', fontSize: '1.05rem' }}>
                        {description}
                    </Typography>
                </Stack>

                <Grid container spacing={{ xs: 3, md: 6 }} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
                    {/* Image Column */}
                    {imageUrl && (
                        <Grid size={{ xs: 12, md: 4 }}>
                            <Box
                                sx={{
                                    width: '100%',
                                    maxWidth: 320,
                                    mx: 'auto',
                                    borderRadius: 4,
                                    overflow: 'hidden',
                                    border: '1px solid rgba(0,0,0,0.1)',
                                    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                                    bgcolor: '#000',
                                    aspectRatio: '1/1',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <img 
                                    src={imageUrl} 
                                    alt="Feature Preview" 
                                    style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'cover' }} 
                                />
                            </Box>
                        </Grid>
                    )}

                    {/* Content Column */}
                    <Grid size={{ xs: 12, md: imageUrl ? 8 : 12 }}>
                        <Stack spacing={3} sx={{ textAlign: 'left', justifyContent: 'center', height: '100%' }}>
                            {features.length > 0 && (
                                <Box sx={{ py: 1 }}>
                                    <Grid container spacing={2.5}>
                                        {features.map((feature, idx) => (
                                            <Grid size={{ xs: 12, sm: 6 }} key={idx}>
                                                <Stack direction="row" spacing={2} alignItems="center">
                                                    <CheckCircleIcon sx={{ fontSize: 24, color: '#16a34a' }} />
                                                    <Typography variant="body1" sx={{ color: '#334155', fontWeight: 700, lineHeight: 1.2 }}>
                                                        {feature}
                                                    </Typography>
                                                </Stack>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </Box>
                            )}
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
                                py: 1.5,
                                borderRadius: 3,
                                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                                fontWeight: 700,
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
                            Activate Feature
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<SecurityIcon sx={{ fontSize: 20 }} />}
                            sx={{
                                px: 4,
                                py: 1.5,
                                borderRadius: 3,
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
                        * This feature requires AWS Security Cloud Service integration.
                    </Typography>
                </Stack>
            </Paper>

            {/* Upgrade Dialog */}
            <Dialog
                open={open}
                onClose={handleClose}
                PaperProps={{
                    sx: {
                        borderRadius: 6,
                        maxWidth: 460,
                        width: '100%',
                        p: 1.5,
                        bgcolor: '#ffffff',
                        boxShadow: '0 25px 60px rgba(0,0,0,0.15)',
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#0f172a', pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {success ? 'Activation Initiated' : `Unlock ${title.replace(' Locked', '')}`}
                    <IconButton onClick={handleClose} size="small" sx={{ color: '#94a3b8', '&:hover': { color: '#0f172a' } }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                
                <DialogContent sx={{ pb: 1 }}>
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
                                animation: 'pulse 2s infinite'
                            }}>
                                <CheckCircleIcon sx={{ fontSize: 48 }} />
                            </Box>
                            <Typography variant="h5" fontWeight={900} sx={{ color: '#1e293b', mb: 1.5, letterSpacing: '-0.02em' }}>
                                Request Submitted!
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6, mb: 3 }}>
                                Your activation ticket for <strong>{title.replace(' Locked', '')}</strong> has been successfully registered. The dev team is provisioning a dedicated container for this feature node.
                            </Typography>
                            <Box sx={{ bgcolor: '#f8fafc', p: 2, borderRadius: 3, border: '1px solid #e2e8f0', textAlign: 'left', mb: 3 }}>
                                <Stack direction="row" spacing={2} sx={{ mb: 1.5 }}>
                                    <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyAll: 'center', fontSize: '0.65rem', fontWeight: 800, pl: 0.6 }}>1</Box>
                                    <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700 }}>Ticket registered in core cluster</Typography>
                                </Stack>
                                <Stack direction="row" spacing={2} sx={{ mb: 1.5 }}>
                                    <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#fef3c7', display: 'flex', alignItems: 'center', justifyAll: 'center', fontSize: '0.65rem', fontWeight: 800, pl: 0.6, color: '#b45309' }}>2</Box>
                                    <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 700 }}>Awaiting license authorization (1-2 hrs)</Typography>
                                </Stack>
                                <Stack direction="row" spacing={2}>
                                    <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyAll: 'center', fontSize: '0.65rem', fontWeight: 800, pl: 0.6 }}>3</Box>
                                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>Dynamic gateway activation</Typography>
                                </Stack>
                            </Box>
                        </Box>
                    ) : (
                        <Box sx={{ py: 1 }}>
                            <Box sx={{ textAlign: 'center', mb: 3 }}>
                                <Typography variant="h4" fontWeight={900} sx={{ color: '#fbbf24', mb: 0.5 }}>
                                    {price}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                                    ONE-TIME ENTERPRISE LICENSE FEE
                                </Typography>
                            </Box>

                            <Typography variant="body2" sx={{ color: '#475569', lineHeight: 1.5, mb: 3, textAlign: 'center' }}>
                                Requesting activation deploys a dedicated sandboxed VPS container, links encrypted API tunnels, and boots the feature gateway.
                            </Typography>

                            {errorMsg && (
                                <Alert severity="error" variant="filled" sx={{ mb: 2.5, borderRadius: 2, fontSize: '0.8rem' }}>
                                    {errorMsg}
                                </Alert>
                            )}

                            <Stack spacing={2} sx={{ mb: 3 }}>
                                <TextField
                                    label="License Holder Name"
                                    fullWidth
                                    variant="outlined"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    size="small"
                                    disabled={submitting}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                                />
                                <TextField
                                    label="Verification Business Email"
                                    fullWidth
                                    variant="outlined"
                                    placeholder="admin@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    size="small"
                                    disabled={submitting}
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3 } }}
                                />
                            </Stack>

                            {/* Trust badges */}
                            <Box sx={{ borderTop: '1px dashed #e2e8f0', pt: 2, pb: 1 }}>
                                <Grid container spacing={1}>
                                    <Grid size={6}>
                                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b', fontWeight: 500 }}>
                                            🛡️ AWS Encrypted container
                                        </Typography>
                                    </Grid>
                                    <Grid size={6}>
                                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b', fontWeight: 500 }}>
                                            ⚡ Real-time API tunnel
                                        </Typography>
                                    </Grid>
                                    <Grid size={6}>
                                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b', fontWeight: 500 }}>
                                            🔑 256-bit Key Escrow
                                        </Typography>
                                    </Grid>
                                    <Grid size={6}>
                                        <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#64748b', fontWeight: 500 }}>
                                            📄 SOC2 compliant gateway
                                        </Typography>
                                    </Grid>
                                </Grid>
                            </Box>
                        </Box>
                    )}
                </DialogContent>
                
                <DialogActions sx={{ px: 3, pb: 2, pt: 0 }}>
                    {success ? (
                        <Button
                            fullWidth
                            variant="contained"
                            size="large"
                            onClick={handleClose}
                            sx={{
                                borderRadius: 3,
                                py: 1.3,
                                fontWeight: 700,
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
                                borderRadius: 3,
                                py: 1.3,
                                fontWeight: 700,
                                textTransform: 'none',
                                bgcolor: '#1e293b',
                                '&:hover': { bgcolor: '#0f172a' }
                            }}
                        >
                            {submitting ? <CircularProgress size={24} color="inherit" /> : 'Confirm & Request Activation'}
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    );
}
