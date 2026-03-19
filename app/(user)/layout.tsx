'use client';

import { Box, Container, Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
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

    useEffect(() => {
        if (pathname === '/dashboard') setValue(0);
        else if (pathname === '/referrals') setValue(1);
        else if (pathname === '/transactions') setValue(2);
    }, [pathname]);

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
                bgcolor: '#f3e8ff', // Light purple background from image
                pb: 10,
            }}
        >
            <Container maxWidth="sm" sx={{ px: 2, py: 2 }}>
                {children}
            </Container>

            <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1000, borderRadius: '20px 20px 0 0', overflow: 'hidden' }} elevation={3}>
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
                        height: 70,
                        '& .MuiBottomNavigationAction-root': {
                            color: 'text.secondary',
                            '&.Mui-selected': {
                                color: '#10b981', // Green for active
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
