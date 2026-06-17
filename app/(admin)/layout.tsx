'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
    Box, Drawer, AppBar, Toolbar, Typography, List, ListItem, ListItemButton,
    ListItemIcon, ListItemText, IconButton, useMediaQuery, useTheme, Avatar,
    Chip, Divider
} from '@mui/material';
import { pusherClient } from '@/lib/pusher-client';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PeopleIcon from '@mui/icons-material/People';
import LayersIcon from '@mui/icons-material/Layers';
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
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import RedeemIcon from '@mui/icons-material/Redeem';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ForumIcon from '@mui/icons-material/Forum';
import PsychologyIcon from '@mui/icons-material/Psychology';
 
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
    {
        text: 'WhatsApp Alerts',
        icon: <WhatsAppIcon />,
        path: '/admin/whatsapp',
        badge: null,
        isLocked: true,
    },
    {
        text: 'Achievement Shop',
        icon: <RedeemIcon />,
        path: '/admin/rewards',
        badge: null,
        isLocked: true,
    },
    {
        text: 'Promo Campaigns',
        icon: <LocalOfferIcon />,
        path: '/admin/campaigns',
        badge: null,
        isLocked: true,
    },
    {
        text: 'Live CRM Support',
        icon: <ForumIcon />,
        path: '/admin/crm',
        badge: null,
        isLocked: true,
    },
    {
        text: 'AI Analytics',
        icon: <PsychologyIcon />,
        path: '/admin/ai-analytics',
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

        channel.bind('new-ticket', () => {
            fetchStats(); // Update sidebar badges
        });

        channel.bind('new-withdrawal', () => {
            fetchStats(); // Update sidebar badges
        });

        channel.bind('ticket-processed', () => {
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
    const mainItems = navItems.filter((item) => !item.isLocked);
    const lockedItems = navItems.filter((item) => item.isLocked);

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

            {/* Nav Items Scroll Container */}
            <Box 
                sx={{ 
                    flex: 1, 
                    overflowY: 'auto', 
                    px: 1.5, 
                    py: 1,
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'rgba(255,255,255,0.12) transparent',
                    '@supports not (scrollbar-color: auto)': {
                        '&::-webkit-scrollbar': {
                            width: '6px',
                        },
                        '&::-webkit-scrollbar-thumb': {
                            backgroundColor: 'rgba(255,255,255,0.12)',
                            borderRadius: '4px',
                        },
                        '&::-webkit-scrollbar-track': {
                            backgroundColor: 'transparent',
                        }
                    }
                }}
            >
                {/* Main Panel */}
                <List sx={{ p: 0 }}>
                    {mainItems.map((item) => {
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
                                        py: 1.1,
                                        color: isActive ? 'white' : '#94a3b8',
                                        bgcolor: isActive ? `${brandColor}22 !important` : 'transparent',
                                        '&:hover': {
                                            bgcolor: 'rgba(255,255,255,0.06)',
                                            color: 'white',
                                        },
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    <ListItemIcon sx={{ color: isActive ? brandColor : '#64748b', minWidth: 34 }}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        primaryTypographyProps={{ fontSize: '0.85rem', fontWeight: isActive ? 600 : 400 }}
                                    />
                                    {item.badge && (
                                        <Chip
                                            label={item.badge}
                                            size="small"
                                            sx={{ height: 18, fontSize: '0.6rem', bgcolor: brandColor, color: '#1a1a1a', fontWeight: 700 }}
                                        />
                                    )}
                                    {isActive && (
                                        <Box sx={{ width: 3, height: 20, bgcolor: brandColor, borderRadius: 4, ml: 0.5 }} />
                                    )}
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>

                {/* Enterprise Add-ons Section Header */}
                <Box sx={{ mt: 2.5, mb: 1, px: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography
                        variant="caption"
                        sx={{
                            color: '#fbbf24',
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            fontSize: '0.65rem',
                            textTransform: 'uppercase',
                            opacity: 0.85
                        }}
                    >
                        Enterprise Add-ons
                    </Typography>
                    <Box sx={{ flex: 1, height: '1px', bgcolor: 'rgba(245, 158, 11, 0.15)' }} />
                </Box>

                {/* Premium / Locked Items */}
                <List sx={{ p: 0 }}>
                    {lockedItems.map((item) => {
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
                                        py: 1.1,
                                        color: isActive ? '#fef08a' : '#94a3b8',
                                        bgcolor: isActive 
                                            ? 'rgba(245, 158, 11, 0.15) !important' 
                                            : 'rgba(245, 158, 11, 0.02)',
                                        border: isActive 
                                            ? '1px solid rgba(245, 158, 11, 0.3)' 
                                            : '1px solid rgba(255, 255, 255, 0.03)',
                                        '&:hover': {
                                            bgcolor: 'rgba(245, 158, 11, 0.08)',
                                            border: '1px solid rgba(245, 158, 11, 0.25)',
                                            color: '#fef08a',
                                            '& .MuiListItemIcon-root': {
                                                color: '#fbbf24',
                                            }
                                        },
                                        transition: 'all 0.2s ease',
                                    }}
                                >
                                    <ListItemIcon 
                                        sx={{ 
                                            color: isActive ? '#fbbf24' : 'rgba(245, 158, 11, 0.5)', 
                                            minWidth: 34,
                                            transition: 'color 0.2s ease'
                                        }}
                                    >
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        primaryTypographyProps={{ 
                                            fontSize: '0.85rem', 
                                            fontWeight: isActive ? 600 : 400,
                                            sx: {
                                                color: isActive ? '#fef08a' : '#cbd5e1',
                                            }
                                        }}
                                    />
                                    
                                    {/* Stylized Premium Badges */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <Box 
                                            sx={{
                                                fontSize: '0.55rem',
                                                fontWeight: 800,
                                                px: 0.8,
                                                py: 0.2,
                                                borderRadius: 1,
                                                bgcolor: 'rgba(245, 158, 11, 0.12)',
                                                color: '#fbbf24',
                                                border: '1px solid rgba(245, 158, 11, 0.25)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em'
                                            }}
                                        >
                                            PRO
                                        </Box>
                                        <LockIcon sx={{ fontSize: 13, color: '#fbbf24' }} />
                                    </Box>
                                    
                                    {isActive && (
                                        <Box sx={{ width: 3, height: 20, bgcolor: '#fbbf24', borderRadius: 4, ml: 0.5 }} />
                                    )}
                                </ListItemButton>
                            </ListItem>
                        );
                    })}
                </List>
            </Box>

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
                        '& .MuiDrawer-paper': { width: drawerWidth, border: 'none', bgcolor: '#0f172a' },
                    }}
                >
                    {drawer}
                </Drawer>
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        '& .MuiDrawer-paper': { width: drawerWidth, border: 'none', boxShadow: '4px 0 20px rgba(0,0,0,0.08)', bgcolor: '#0f172a' },
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
