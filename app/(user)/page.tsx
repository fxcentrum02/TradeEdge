'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, Typography, Button } from '@mui/material';
import { useAuth } from '@/context/AuthContext';
import { remoteLog } from '@/lib/logger';

export default function UserHomePage() {
    const router = useRouter();
    const { isAuthenticated, isLoading, isTelegramMissing } = useAuth();

    useEffect(() => {
        // Once we are authenticated, move to dashboard immediately
        if (isAuthenticated) {
            remoteLog('Root page: Authenticated, redirecting to dashboard');
            router.replace('/dashboard');
        }
    }, [isAuthenticated, router]);

    if (isTelegramMissing) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    p: 3,
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
                }}
            >
                <Box
                    sx={{
                        width: 80,
                        height: 80,
                        borderRadius: '20px',
                        background: 'rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 1
                    }}
                >
                    <Typography sx={{ fontSize: 40 }}>📱</Typography>
                </Box>

                <Box>
                    <Typography variant="h5" fontWeight={800} gutterBottom>
                        Telegram Access Required
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280, mx: 'auto', mb: 4 }}>
                        Please open this application through the official Telegram Mini App link to access your dashboard.
                    </Typography>

                    <Button
                        variant="contained"
                        fullWidth
                        href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'bot'}/${process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME || 'app'}`}
                        target="_blank"
                        sx={{
                            background: '#0088cc', // Telegram Blue
                            borderRadius: '12px',
                            py: 1.5,
                            fontWeight: 700,
                            textTransform: 'none',
                            '&:hover': { background: '#0077b5' }
                        }}
                    >
                        Open in Telegram
                    </Button>
                </Box>
            </Box>
        );
    }

    const message = (() => {
        if (isLoading) return 'Signing you in...';
        if (isAuthenticated) return 'Welcome back! Redirecting...';
        return 'Connecting to Telegram...';
    })();

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
            }}
        >
            {/* Logo */}
            <Box
                sx={{
                    width: 90,
                    height: 90,
                    borderRadius: '24px',
                    background: 'linear-gradient(135deg, var(--brand-main) 0%, var(--brand-dark) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 40px rgba(132,204,22,0.35)',
                }}
            >
                <Typography sx={{ fontSize: 40 }}>💹</Typography>
            </Box>

            <Box sx={{ textAlign: 'center' }}>
                <Typography
                    variant="h5"
                    fontWeight={800}
                    sx={{ color: '#1e293b', letterSpacing: '-0.5px' }}
                >
                    Trade Edge
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                    Smart ROI Investment Platform
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
                <CircularProgress
                    size={28}
                    sx={{ color: 'var(--brand-main)' }}
                />
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {message}
                </Typography>
            </Box>
        </Box>
    );
}
