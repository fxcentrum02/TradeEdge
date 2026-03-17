'use client';

import React, { useState } from 'react';
import {
    Box, Typography, Button, Paper, Stack, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, CircularProgress, IconButton,
    Grid
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import CloseIcon from '@mui/icons-material/Close';
import CloudDoneIcon from '@mui/icons-material/CloudDone';

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

    const handleUpgradeClick = () => setOpen(true);
    const handleClose = () => {
        setOpen(false);
        setSubmitting(false); // Reset loader on close
    };

    const handleSubmit = () => {
        setSubmitting(true);
        // User requested just to have a loader on submit
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
                            Upgrade Plan - {price}
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
                        borderRadius: 5,
                        maxWidth: 450,
                        width: '100%',
                        p: 1
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 800, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    Unlock AWS Cloud Security
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
                            bgcolor: '#f0fdf4',
                            color: '#16a34a',
                            mb: 2
                        }}>
                            <CloudDoneIcon />
                        </Box>
                        <Typography variant="h5" fontWeight={900} color="primary" gutterBottom>
                            {price}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Get lifetime access to advanced security tools, including global broadcasts and automated fraud detection.
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
                            borderRadius: 3,
                            py: 1.5,
                            fontWeight: 700,
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
