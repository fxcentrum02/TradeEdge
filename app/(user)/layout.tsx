'use client';

import { Box, Container, Paper, BottomNavigation, BottomNavigationAction, CircularProgress } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import PeopleIcon from '@mui/icons-material/People';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Typography, Button } from '@mui/material';

export default function UserLayout({ children }: { children: React.ReactNode }) {
    const { user, isAuthenticated, isLoading, isTelegramMissing } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [value, setValue] = useState(0);

    const [maintenance, setMaintenance] = useState<{ active: boolean; duration: string }>({ active: false, duration: '' });
    const [checkingMaintenance, setCheckingMaintenance] = useState(true);

    const checkMaintenanceMode = async () => {
        try {
            const res = await fetch('/api/settings/maintenance');
            const data = await res.json();
            if (data.success && data.data) {
                setMaintenance({
                    active: data.data.maintenanceMode || false,
                    duration: data.data.maintenanceEstimatedDuration || ''
                });
            }
        } catch (err) {
            console.error('Failed to check maintenance mode:', err);
        } finally {
            setCheckingMaintenance(false);
        }
    };

    useEffect(() => {
        checkMaintenanceMode();
    }, []);

    useEffect(() => {
        if (pathname === '/dashboard') setValue(0);
        else if (pathname === '/referrals') setValue(1);
        else if (pathname === '/transactions') setValue(2);
    }, [pathname]);

    if (checkingMaintenance) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(135deg, #020617 0%, #0f172a 100%)',
                    color: 'white'
                }}
            >
                <CircularProgress color="warning" />
            </Box>
        );
    }

    if (maintenance.active) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 3,
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #020617 0%, #0f172a 100%)',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Decorative background glows */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '15%',
                        left: '10%',
                        width: 250,
                        height: 250,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%)',
                        zIndex: 0,
                        filter: 'blur(30px)'
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: '15%',
                        right: '10%',
                        width: 300,
                        height: 300,
                        borderRadius: '50%',
                        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.1) 0%, transparent 70%)',
                        zIndex: 0,
                        filter: 'blur(40px)'
                    }}
                />

                <Box
                    sx={{
                        position: 'relative',
                        zIndex: 1,
                        maxWidth: 420,
                        width: '100%',
                        p: 4,
                        borderRadius: 6,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(15, 23, 42, 0.5)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 3
                    }}
                >
                    <Box
                        sx={{
                            width: 72,
                            height: 72,
                            borderRadius: '50%',
                            bgcolor: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid rgba(245, 158, 11, 0.25)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            animation: 'pulse 2s infinite ease-in-out',
                            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.15)',
                            '@keyframes pulse': {
                                '0%, 100%': { transform: 'scale(1)', opacity: 1, boxShadow: '0 8px 24px rgba(245, 158, 11, 0.15)' },
                                '50%': { transform: 'scale(1.05)', opacity: 0.8, boxShadow: '0 12px 32px rgba(245, 158, 11, 0.25)' }
                            }
                        }}
                    >
                        <Typography sx={{ fontSize: 36 }}>🔧</Typography>
                    </Box>

                    <Box>
                        <Typography variant="h5" fontWeight={900} sx={{ mb: 1, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            System Maintenance
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#94a3b8', lineHeight: 1.6, px: 1 }}>
                            We are performing scheduled core upgrades to enhance transaction execution speed and security. Normal services will resume shortly.
                        </Typography>
                    </Box>

                    {maintenance.duration && (
                        <Box
                            sx={{
                                width: '100%',
                                py: 1.5,
                                px: 2,
                                borderRadius: 3,
                                bgcolor: 'rgba(245, 158, 11, 0.06)',
                                border: '1px solid rgba(245, 158, 11, 0.15)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 0.5
                            }}
                        >
                            <Typography variant="caption" sx={{ color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Estimated Duration
                            </Typography>
                            <Typography variant="body1" fontWeight={750} sx={{ color: 'white' }}>
                                {maintenance.duration}
                            </Typography>
                        </Box>
                    )}

                    <Button
                        variant="contained"
                        fullWidth
                        onClick={() => {
                            setCheckingMaintenance(true);
                            checkMaintenanceMode();
                        }}
                        disabled={checkingMaintenance}
                        sx={{
                            mt: 1,
                            bgcolor: '#fbbf24',
                            color: '#0f172a',
                            fontWeight: 800,
                            borderRadius: 3,
                            py: 1.5,
                            textTransform: 'none',
                            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.2)',
                            transition: 'all 0.2s',
                            '&:hover': {
                                bgcolor: '#f59e0b',
                                transform: 'translateY(-1px)',
                                boxShadow: '0 12px 28px rgba(245, 158, 11, 0.3)'
                            }
                        }}
                    >
                        {checkingMaintenance ? <CircularProgress size={22} color="inherit" /> : 'Check Status Again'}
                    </Button>
                </Box>
            </Box>
        );
    }

    // If we are definitely outside Telegram and not authenticated, show the error screen
    if (isTelegramMissing && !user) {
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
                        Please open this application through the official Telegram Mini App link to access this page.
                    </Typography>

                    <Button
                        variant="contained"
                        fullWidth
                        href={`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'bot'}/${process.env.NEXT_PUBLIC_TELEGRAM_MINI_APP_NAME || 'app'}`}
                        target="_blank"
                        sx={{
                            background: '#0088cc',
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

    return (
        <Box
            sx={{
                minHeight: '100vh',
                background: 'linear-gradient(180deg, #070b15 0%, #0f172a 50%, #020617 100%)',
                color: '#f8fafc',
                position: 'relative',
                overflowX: 'hidden',
                pb: 10,
            }}
        >
            {/* Ambient Background Glowing Orbs */}
            <Box
                sx={{
                    position: 'fixed',
                    top: -120,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 500,
                    height: 500,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(99, 102, 241, 0.08) 40%, transparent 70%)',
                    pointerEvents: 'none',
                    zIndex: 0,
                    filter: 'blur(60px)',
                }}
            />
            <Box
                sx={{
                    position: 'fixed',
                    bottom: 0,
                    right: -100,
                    width: 400,
                    height: 400,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)',
                    pointerEvents: 'none',
                    zIndex: 0,
                    filter: 'blur(60px)',
                }}
            />

            <Container maxWidth="sm" sx={{ px: 2, py: 2, position: 'relative', zIndex: 1 }}>
                {children}
            </Container>

            {/* Midnight Glassmorphic Bottom Navigation Bar */}
            <Paper
                elevation={0}
                sx={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    borderRadius: '24px 24px 0 0',
                    overflow: 'hidden',
                    background: 'rgba(15, 23, 42, 0.92)',
                    backdropFilter: 'blur(24px) saturate(180%)',
                    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 -12px 40px rgba(0, 0, 0, 0.5)',
                }}
            >
                <BottomNavigation
                    showLabels
                    value={value}
                    onChange={(event, newValue) => {
                        setValue(newValue);
                        if (newValue === 0) router.push('/dashboard');
                        if (newValue === 1) router.push('/referrals');
                        if (newValue === 2) router.push('/transactions');
                    }}
                    sx={{
                        height: 72,
                        background: 'transparent',
                        '& .MuiBottomNavigationAction-root': {
                            color: '#64748b',
                            py: 1,
                            transition: 'all 0.2s ease',
                            '& .MuiSvgIcon-root': {
                                fontSize: '1.4rem',
                                transition: 'transform 0.2s ease',
                            },
                            '&.Mui-selected': {
                                color: '#06b6d4',
                                fontWeight: 700,
                                '& .MuiSvgIcon-root': {
                                    transform: 'scale(1.18)',
                                    filter: 'drop-shadow(0 2px 8px rgba(6, 182, 212, 0.4))',
                                },
                            },
                        },
                    }}
                >
                    <BottomNavigationAction label="Home" icon={<HomeIcon />} />
                    <BottomNavigationAction label="Friends" icon={<PeopleIcon />} />
                    <BottomNavigationAction label="History" icon={<ReceiptLongIcon />} />
                </BottomNavigation>
            </Paper>
        </Box>
    );
}
