'use client';

import { useState, useEffect } from 'react';
import {
    Dialog, DialogContent, Typography, Button, Box, IconButton, Chip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SpeedIcon from '@mui/icons-material/Speed';
import DashboardCustomizeIcon from '@mui/icons-material/DashboardCustomize';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';

const LOCAL_STORAGE_KEY = 'trade_edge_ui_v2_announced';

export default function NewUiAnnouncementModal() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        try {
            const hasSeenAnnouncement = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (!hasSeenAnnouncement) {
                // Show modal after 800ms for smooth load transition
                const timer = setTimeout(() => setOpen(true), 800);
                return () => clearTimeout(timer);
            }
        } catch {
            // Ignore localStorage errors
        }
    }, []);

    const handleClose = () => {
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, 'true');
        } catch {
            // Ignore localStorage errors
        }
        setOpen(false);
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="xs"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    background: 'linear-gradient(180deg, #070b15 0%, #0f172a 100%)',
                    border: '1px solid rgba(6, 182, 212, 0.35)',
                    boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(6, 182, 212, 0.2)',
                    color: '#f8fafc',
                    overflow: 'hidden',
                    position: 'relative',
                }
            }}
        >
            {/* Ambient Background Glow Effect */}
            <Box
                sx={{
                    position: 'absolute',
                    top: -60,
                    right: -60,
                    width: 180,
                    height: 180,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, rgba(0,0,0,0) 70%)',
                    pointerEvents: 'none',
                }}
            />
            <Box
                sx={{
                    position: 'absolute',
                    bottom: -60,
                    left: -60,
                    width: 180,
                    height: 180,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(52, 211, 153, 0.2) 0%, rgba(0,0,0,0) 70%)',
                    pointerEvents: 'none',
                }}
            />

            {/* Close Button */}
            <IconButton
                onClick={handleClose}
                sx={{
                    position: 'absolute',
                    right: 12,
                    top: 12,
                    color: '#94a3b8',
                    zIndex: 2,
                    '&:hover': { color: '#ffffff', bgcolor: 'rgba(255, 255, 255, 0.1)' },
                }}
            >
                <CloseIcon />
            </IconButton>

            <DialogContent sx={{ p: 3, pt: 3.5, textAlign: 'center', position: 'relative', zIndex: 1 }}>
                {/* Header Badge */}
                <Box sx={{ mb: 2 }}>
                    <Chip
                        icon={<AutoAwesomeIcon sx={{ fontSize: '1rem', color: '#38bdf8 !important' }} />}
                        label="Brand New Experience"
                        size="small"
                        sx={{
                            background: 'rgba(6, 182, 212, 0.15)',
                            color: '#38bdf8',
                            border: '1px solid rgba(6, 182, 212, 0.35)',
                            fontWeight: 800,
                            fontSize: '0.72rem',
                            letterSpacing: 0.5,
                            px: 1,
                            py: 0.5,
                            mb: 1.5,
                        }}
                    />
                    <Typography variant="h5" fontWeight={900} color="#ffffff" gutterBottom sx={{ letterSpacing: -0.5 }}>
                        Welcome to Trade Edge <span style={{ color: '#06b6d4' }}>v2.0</span>
                    </Typography>
                    <Typography variant="body2" color="#94a3b8" sx={{ lineHeight: 1.6, px: 1 }}>
                        We’ve completely redesigned your workspace with a premium Dark Luxury Tech UI, sharper card aesthetics, and ultra-fast navigation.
                    </Typography>
                </Box>

                {/* Feature Highlights */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3, textAlign: 'left' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8, p: 1.5, borderRadius: 2, bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', display: 'flex' }}>
                            <DashboardCustomizeIcon fontSize="small" />
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" fontWeight={800} color="#f8fafc">
                                Dark Obsidian & Crisp Square Cards
                            </Typography>
                            <Typography variant="caption" color="#94a3b8" sx={{ display: 'block', mt: 0.2 }}>
                                High-contrast dark obsidian cards with zero clutter.
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8, p: 1.5, borderRadius: 2, bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(52, 211, 153, 0.15)', color: '#34d399', display: 'flex' }}>
                            <SpeedIcon fontSize="small" />
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" fontWeight={800} color="#f8fafc">
                                20-Tier Network & Milestone Hub
                            </Typography>
                            <Typography variant="caption" color="#94a3b8" sx={{ display: 'block', mt: 0.2 }}>
                                Real-time downline analytics, date filtering, and milestone bonuses.
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.8, p: 1.5, borderRadius: 2, bgcolor: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', display: 'flex' }}>
                            <AccountBalanceWalletIcon fontSize="small" />
                        </Box>
                        <Box>
                            <Typography variant="subtitle2" fontWeight={800} color="#f8fafc">
                                Instant Compounding & Withdrawals
                            </Typography>
                            <Typography variant="caption" color="#94a3b8" sx={{ display: 'block', mt: 0.2 }}>
                                Compounding power reinvestments starting from 1001 USDT with instant wallet updates.
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                {/* Primary Action Button */}
                <Button
                    fullWidth
                    variant="contained"
                    onClick={handleClose}
                    sx={{
                        background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                        color: '#ffffff',
                        borderRadius: 2,
                        py: 1.5,
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        textTransform: 'none',
                        boxShadow: '0 8px 25px rgba(16, 185, 129, 0.35)',
                        transition: 'all 0.15s ease',
                        '&:active': { transform: 'scale(0.97)' },
                    }}
                >
                    Explore New UI ✨
                </Button>
            </DialogContent>
        </Dialog>
    );
}
