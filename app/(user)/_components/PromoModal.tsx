'use client';

import { Dialog, DialogContent, Button, Typography, Box, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CampaignIcon from '@mui/icons-material/Campaign';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface PromoModalProps {
    open: boolean;
    onClose: () => void;
}

export default function PromoModal({ open, onClose }: PromoModalProps) {
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
                        width: 72,
                        height: 72,
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 2.5,
                        boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
                    }}
                >
                    <CampaignIcon sx={{ color: 'white', fontSize: 36 }} />
                </Box>

                {/* Title */}
                <Typography variant="h5" fontWeight={800} sx={{ color: '#1e293b', mb: 1.5, letterSpacing: '-0.5px' }}>
                    Exciting Update! 🎉
                </Typography>

                {/* Subtitle */}
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#10b981', mb: 2 }}>
                    Minimum is now only 10 USDT!
                </Typography>

                {/* Description */}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, px: 1, lineHeight: 1.6 }}>
                    We have lowered the entry threshold for all actions. You can now start earning with even smaller amounts!
                </Typography>

                {/* Highlights */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3.5, textAlign: 'left', px: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <CheckCircleIcon sx={{ color: '#10b981', fontSize: 20, mt: 0.2 }} />
                        <Box>
                            <Typography variant="body2" fontWeight={700} color="#334155">
                                Lower Purchase Limit
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Buy Mining Power starting from just 10 USDT.
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                        <CheckCircleIcon sx={{ color: '#10b981', fontSize: 20, mt: 0.2 }} />
                        <Box>
                            <Typography variant="body2" fontWeight={700} color="#334155">
                                Faster Reinvesting
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Compound your daily earnings sooner with a 10 USDT minimum.
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
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)',
                        '&:hover': {
                            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                        }
                    }}
                >
                    Let's Start!
                </Button>
            </DialogContent>
        </Dialog>
    );
}
