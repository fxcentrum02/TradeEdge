'use client';

import { Dialog, DialogContent, Button, Typography, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VpnLockIcon from '@mui/icons-material/VpnLock';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TelegramIcon from '@mui/icons-material/Telegram';
import SecurityIcon from '@mui/icons-material/Security';

interface TelegramVpnModalProps {
    open: boolean;
    onClose: () => void;
}

export default function TelegramVpnModal({ open, onClose }: TelegramVpnModalProps) {
    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xs"
            PaperProps={{
                sx: {
                    borderRadius: 5,
                    p: 1.5,
                    overflow: 'hidden',
                    background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
                }
            }}
            sx={{
                '& .MuiDialog-container': {
                    alignItems: { xs: 'center', sm: 'center' } // Centered layout optimized for mobile/desktop
                },
                backdropFilter: 'blur(6px)',
            }}
        >
            {/* Top Close Button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                    <CloseIcon />
                </IconButton>
            </Box>

            <DialogContent sx={{ pt: 1, pb: 3, px: 2, textAlign: 'center' }}>
                {/* Announcement Icon Box */}
                <Box
                    sx={{
                        width: 76,
                        height: 76,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #e11d48 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2.5,
                        position: 'relative',
                        boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)',
                    }}
                >
                    <VpnLockIcon sx={{ color: 'white', fontSize: 38 }} />
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: -2,
                            right: -2,
                            bgcolor: '#0088cc',
                            borderRadius: '50%',
                            width: 28,
                            height: 28,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '3px solid #ffffff',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        }}
                    >
                        <TelegramIcon sx={{ color: 'white', fontSize: 16 }} />
                    </Box>
                </Box>

                {/* Title */}
                <Typography variant="h5" fontWeight={800} sx={{ color: '#1e293b', mb: 1.5, letterSpacing: '-0.5px' }}>
                    Telegram VPN Alert
                </Typography>

                {/* Subtitle */}
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#f59e0b', mb: 2 }}>
                    Temporary Access Warning
                </Typography>

                {/* Description */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5, px: 1, lineHeight: 1.6 }}>
                    Telegram services are currently experiencing a temporary pause in India until <strong>June 22</strong>.
                    To ensure uninterrupted usage of the Trade Edge app, please connect to a <strong>VPN</strong>.
                </Typography>

                {/* Highlights */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4, textAlign: 'left', px: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <SecurityIcon sx={{ color: '#f59e0b', fontSize: 20, mt: 0.2 }} />
                        <Box>
                            <Typography variant="body2" fontWeight={700} color="#334155">
                                Enable Your VPN
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Turn on a VPN (e.g., set location to US, UK, or Europe) before opening Trade Edge or performing actions.
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <WarningAmberIcon sx={{ color: '#e11d48', fontSize: 20, mt: 0.2 }} />
                        <Box>
                            <Typography variant="body2" fontWeight={700} color="#334155">
                                Temporary Pause in India
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                This restriction is active until June 22. Standard access will resume automatically after this date.
                            </Typography>
                        </Box>
                    </Box>
                </Box>

                {/* Action button */}
                <Button
                    fullWidth
                    variant="contained"
                    onClick={onClose}
                    sx={{
                        py: 1.8,
                        borderRadius: 3.5,
                        textTransform: 'none',
                        fontWeight: 800,
                        fontSize: '0.95rem',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                        boxShadow: '0 6px 16px rgba(245, 158, 11, 0.3)',
                        '&:hover': {
                            background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                        }
                    }}
                >
                    I Understand
                </Button>
            </DialogContent>
        </Dialog>
    );
}
