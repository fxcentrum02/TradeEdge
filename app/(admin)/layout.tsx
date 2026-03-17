'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    Box, Drawer, AppBar, Toolbar, Typography, List, ListItem, ListItemButton,
    ListItemIcon, ListItemText, IconButton, useMediaQuery, useTheme, Avatar,
    Chip, Divider, Collapse, Snackbar, Alert
} from '@mui/material';
import { pusherClient } from '@/lib/pusher-client';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import LayersIcon from '@mui/icons-material/Layers';
import PaymentIcon from '@mui/icons-material/Payment';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import LogoutIcon from '@mui/icons-material/Logout';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SettingsIcon from '@mui/icons-material/Settings';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import CampaignIcon from '@mui/icons-material/Campaign';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import LockIcon from '@mui/icons-material/Lock';
 
const drawerWidth = 268;

const getNavItems = (pendingTickets: number, pendingWithdrawals: number) => [
    {
        text: 'Dashboard',
        icon: <DashboardIcon />,
        path: '/admin',
        badge: null,
    },
    {
        text: 'Analytics & Settlements',
        icon: <AnalyticsIcon />,
        path: '/admin/analytics',
        badge: null,
    },
    {
        text: 'Deposit Tickets',
        icon: <ReceiptLongIcon />,
        path: '/admin/tickets',
        badge: pendingTickets > 0 ? pendingTickets.toString() : null,
    },
    {
        text: 'Withdrawals',
        icon: <AccountBalanceIcon />,
        path: '/admin/withdrawals',
        badge: pendingWithdrawals > 0 ? pendingWithdrawals.toString() : null,
    },
    {
        text: 'Plans / Tiers',
        icon: <LayersIcon />,
        path: '/admin/plans',
        badge: null,
    },
    {
        text: 'Users',
        icon: <PeopleIcon />,
        path: '/admin/users',
        badge: null,
    },
    {
        text: 'Hierarchy Tree',
        icon: <AccountTreeIcon />,
        path: '/admin/hierarchy',
        badge: null,
    },
    {
        text: 'Settings',
        icon: <SettingsIcon />,
        path: '/admin/settings',
        badge: null,
    },
    {
        text: 'Broadcast Tool',
        icon: <CampaignIcon />,
        path: '/admin/broadcast',
        badge: null,
        isLocked: true,
    },
    {
        text: 'Fraud Detection',
        icon: <SecurityIcon />,
        path: '/admin/fraud',
        badge: null,
        isLocked: true,
    },
    {
        text: 'Auto-Payout Engine',
        icon: <AccountBalanceIcon />,
        path: '/admin/payouts',
        badge: null,
        isLocked: true,
    },
    {
        text: 'Maintenance Mode',
        icon: <SettingsSuggestIcon />,
        path: '/admin/maintenance',
        badge: null,
        isLocked: true,
    },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    const [appSettings, setAppSettings] = useState<{ appName: string, brandColor: string }>({
        appName: 'Trade Edge',
        brandColor: 'var(--brand-main)'
    });

    const [sidebarStats, setSidebarStats] = useState({ pendingTickets: 0, pendingWithdrawals: 0 });

    useEffect(() => {
        fetch('/api/admin/settings')
            .then(res => res.json())
            .then(data => {
                if (data.success && data.data) {
                    setAppSettings({
                        appName: data.data.appName || 'Trade Edge',
                        brandColor: data.data.brandColor || 'var(--brand-main)'
                    });
                }
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        // Fetch stats on load and when pathname changes (e.g., navigating back to tickets lists)
        const fetchStats = () => {
            fetch('/api/admin/sidebar-stats')
                .then(res => res.json())
                .then(data => {
                    if (data.success && data.data) {
                        setSidebarStats(data.data);
                    }
                })
                .catch(() => { });
        };

        fetchStats();

        // Subscribing to Pusher for real-time notifications
        const channel = pusherClient.subscribe('admin-notifications');

        channel.bind('new-ticket', (data: any) => {
            fetchStats(); // Update sidebar badges
        });

        channel.bind('new-withdrawal', (data: any) => {
            fetchStats(); // Update sidebar badges
        });

        channel.bind('ticket-processed', (data: any) => {
            fetchStats(); // Update sidebar badges
        });

        // Listen for global cron events to potentially refresh analytics data
        const globalChannel = pusherClient.subscribe('global-events');
        globalChannel.bind('roi-settled', () => {
            fetchStats();
        });

        return () => {
            pusherClient.unsubscribe('admin-notifications');
            pusherClient.unsubscribe('global-events');
        };

    }, [pathname]);

    const brandColor = appSettings.brandColor;
    const appName = appSettings.appName;
    const brandInitials = appName.substring(0, 2).toUpperCase();

    const navItems = getNavItems(sidebarStats.pendingTickets, sidebarStats.pendingWithdrawals);

    const drawer = (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#0f172a' }}>
            {/* Brand */}
            <Box sx={{ p: 3, pb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                        sx={{
                            width: 36,
                            height: 36,
                            borderRadius: 2,
                            background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Typography sx={{ color: 'white', fontWeight: 900, fontSize: 16 }}>{brandInitials}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="subtitle1" fontWeight={700} sx={{ color: 'white', lineHeight: 1.2 }}>
                            {appName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                            Admin Panel
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 1 }} />

            {/* Nav Items */}
            <List sx={{ flex: 1, px: 1.5, py: 1 }}>
                {navItems.map((item) => {
                    const isActive = pathname === item.path || (item.path !== '/admin' && pathname.startsWith(item.path));
                    return (
                        <ListItem key={item.text} disablePadding sx={{ mb: 0.5 }}>
                            <ListItemButton
                                selected={isActive}
                                onClick={() => {
                                    router.push(item.path);
                                    if (isMobile) setMobileOpen(false);
                                }}
                                sx={{
                                    borderRadius: 2,
                                    py: 1.3,
                                    color: isActive ? 'white' : '#94a3b8',
                                    bgcolor: isActive ? `${brandColor}22 !important` : 'transparent',
                                    '&:hover': {
                                        bgcolor: 'rgba(255,255,255,0.06)',
                                        color: 'white',
                                    },
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                <ListItemIcon sx={{ color: isActive ? brandColor : '#64748b', minWidth: 38 }}>
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={item.text}
                                    primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: isActive ? 600 : 400 }}
                                />
                                {item.badge && (
                                    <Chip
                                        label={item.badge}
                                        size="small"
                                        sx={{ height: 18, fontSize: '0.6rem', bgcolor: brandColor, color: '#1a1a1a', fontWeight: 700 }}
                                    />
                                )}
                                {(item as any).isLocked && (
                                    <LockIcon sx={{ fontSize: 14, color: '#f59e0b', ml: 1, opacity: 0.8 }} />
                                )}
                                {isActive && (
                                    <Box sx={{ width: 3, height: 20, bgcolor: brandColor, borderRadius: 4, ml: 0.5 }} />
                                )}
                            </ListItemButton>
                        </ListItem>
                    );
                })}
            </List>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

            {/* Footer */}
            <Box sx={{ p: 2 }}>
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.04)',
                    }}
                >
                    <Avatar sx={{ width: 32, height: 32, bgcolor: brandColor, color: '#1a1a1a', fontWeight: 700, fontSize: 13 }}>
                        A
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" fontWeight={600} sx={{ color: 'white', display: 'block' }}>
                            Admin
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.65rem' }}>
                            Superadmin
                        </Typography>
                    </Box>
                    <IconButton
                        size="small"
                        onClick={() => router.push('/')}
                        sx={{ color: '#64748b', '&:hover': { color: '#ef4444' } }}
                    >
                        <LogoutIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>
        </Box>
    );

    if (pathname === '/admin/login') {
        return <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>{children}</Box>;
    }

    return (
        <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
            {/* AppBar — mobile only */}
            <AppBar
                position="fixed"
                elevation={0}
                sx={{
                    width: { md: `calc(100% - ${drawerWidth}px)` },
                    ml: { md: `${drawerWidth}px` },
                    bgcolor: 'white',
                    color: 'text.primary',
                    borderBottom: '1px solid #e2e8f0',
                    display: { md: 'none' },
                }}
            >
                <Toolbar sx={{ minHeight: '56px !important' }}>
                    <IconButton edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2 }}>
                        <MenuIcon />
                    </IconButton>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                            sx={{
                                width: 28,
                                height: 28,
                                borderRadius: 1.5,
                                background: `linear-gradient(135deg, ${brandColor} 0%, ${brandColor}dd 100%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Typography sx={{ color: 'white', fontWeight: 900, fontSize: 12 }}>{brandInitials}</Typography>
                        </Box>
                        <Typography variant="subtitle1" fontWeight={700}>{appName} Admin</Typography>
                    </Box>
                </Toolbar>
            </AppBar>

            {/* Sidebar */}
            <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={() => setMobileOpen(false)}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        '& .MuiDrawer-paper': { width: drawerWidth, border: 'none' },
                    }}
                >
                    {drawer}
                </Drawer>
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        '& .MuiDrawer-paper': { width: drawerWidth, border: 'none', boxShadow: '4px 0 20px rgba(0,0,0,0.08)' },
                    }}
                    open
                >
                    {drawer}
                </Drawer>
            </Box>

            {/* Main content */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: { xs: 2, md: 4 },
                    width: { md: `calc(100% - ${drawerWidth}px)` },
                    mt: { xs: 7, md: 0 },
                    minHeight: '100vh',
                }}
            >
                {children}
            </Box>
        </Box>
    );
}
