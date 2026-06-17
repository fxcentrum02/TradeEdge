'use client';

import React, { useState } from 'react';
import {
    Box, Typography, Button, Paper, Stack, Grid, Card, CardContent,
    Avatar, TextField, Divider, List, ListItem, ListItemAvatar, ListItemText,
    Chip, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, IconButton
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import CloseIcon from '@mui/icons-material/Close';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ForumIcon from '@mui/icons-material/Forum';
import SendIcon from '@mui/icons-material/Send';
import InfoIcon from '@mui/icons-material/Info';

const MOCK_CHATS = [
    {
        username: '@miner_pro',
        name: 'Jack Dev',
        lastMessage: 'Sure, hash is 0x7b8f9e...2a3c. Please approve it.',
        time: '3m ago',
        status: 'warning',
        active: true
    },
    {
        username: '@cryptokid',
        name: 'Alex Patel',
        lastMessage: 'How does the level 3 referral commission calculate?',
        time: '12m ago',
        status: 'default',
        active: false
    },
    {
        username: '@trader_queen',
        name: 'Sophia L.',
        lastMessage: 'Thanks, withdrawal approved fast!',
        time: '1h ago',
        status: 'success',
        active: false
    }
];

export default function CRMLockedPage() {
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const price = '$399.00 USD';

    const handleUpgradeClick = () => setOpen(true);
    const handleClose = () => {
        setOpen(false);
        setSubmitting(false);
    };

    const handleSubmit = () => {
        setSubmitting(true);
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '85vh', px: 2, py: 4 }}>
            <Paper
                elevation={0}
                sx={{
                    p: { xs: 3, md: 5 },
                    borderRadius: 6,
                    bgcolor: 'white',
                    maxWidth: 1000,
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
                        bgcolor: '#e0e7ff', // indigo glow
                        zIndex: 0
                    }}
                />

                <Stack spacing={2} sx={{ position: 'relative', zIndex: 1, mb: 5, maxWidth: 650, mx: 'auto' }} alignItems="center">
                    <Box
                        sx={{
                            width: 80,
                            height: 80,
                            borderRadius: '50%',
                            bgcolor: '#e0e7ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 8px 16px rgba(79, 70, 229, 0.15)',
                            border: '2px solid #c7d2fe',
                            mb: 1
                        }}
                    >
                        <ForumIcon sx={{ fontSize: 42, color: '#4f46e5' }} />
                    </Box>
                    <Typography variant="h4" fontWeight={900} sx={{ color: '#1e293b', letterSpacing: '-0.02em', textAlign: 'center' }}>
                        Unified Live CRM Desk
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#64748b', lineHeight: 1.6, textAlign: 'center', fontSize: '1.05rem' }}>
                        Solve user support tickets in real-time. Link customer chats with live databases to inspect balances, downline registrations, and deposits without switching pages.
                    </Typography>
                </Stack>

                {/* CRM Layout preview */}
                <Grid container spacing={3} sx={{ position: 'relative', zIndex: 1, mb: 4, height: 420, overflow: 'hidden', borderRadius: 4, border: '1px solid #e2e8f0' }}>
                    {/* Left Chats List Panel */}
                    <Grid size={{ xs: 12, md: 3 }} sx={{ borderRight: '1px solid #e2e8f0', bgcolor: '#f8fafc', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0', bgcolor: 'white' }}>
                            <Typography variant="subtitle2" fontWeight={800} color="#1e293b">Inbox (3)</Typography>
                        </Box>
                        <List disablePadding sx={{ overflowY: 'auto', flex: 1 }}>
                            {MOCK_CHATS.map((chat, index) => (
                                <React.Fragment key={index}>
                                    <ListItem 
                                        sx={{ 
                                            bgcolor: chat.active ? 'white' : 'transparent', 
                                            borderLeft: chat.active ? '4px solid #4f46e5' : 'none',
                                            cursor: 'pointer',
                                            py: 1.5
                                        }}
                                    >
                                        <ListItemAvatar sx={{ minWidth: 44 }}>
                                            <Avatar sx={{ bgcolor: chat.active ? '#e0e7ff' : '#f1f5f9', color: '#4f46e5', width: 32, height: 32, fontSize: 13, fontWeight: 700 }}>
                                                {chat.name.charAt(0)}
                                            </Avatar>
                                        </ListItemAvatar>
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="caption" fontWeight={700} color="#334155">{chat.username}</Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>{chat.time}</Typography>
                                                </Box>
                                            }
                                            secondary={
                                                <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary', fontSize: '0.65rem' }}>
                                                    {chat.lastMessage}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                    <Divider />
                                </React.Fragment>
                            ))}
                        </List>
                    </Grid>

                    {/* Chat Area Panel */}
                    <Grid size={{ xs: 12, md: 6 }} sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'white' }}>
                        {/* Chat Header */}
                        <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                                <Typography variant="subtitle2" fontWeight={800} color="#1e293b">@miner_pro</Typography>
                                <Typography variant="caption" color="text.secondary">Telegram Support Chat</Typography>
                            </Box>
                            <Chip label="Awaiting Approval" size="small" sx={{ bgcolor: '#fff7ed', color: '#c2410c', fontWeight: 700, fontSize: '0.65rem' }} />
                        </Box>

                        {/* Chat Messages */}
                        <Box sx={{ flex: 1, p: 2.5, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5, bgcolor: '#f8fafc' }}>
                            {/* User bubble */}
                            <Box sx={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                                <Paper sx={{ p: 1.5, borderRadius: '16px 16px 16px 4px', bgcolor: 'white', border: '1px solid #e2e8f0' }}>
                                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontSize: '0.6rem', mb: 0.5 }}>User [15:40]</Typography>
                                    <Typography variant="body2" color="#334155">
                                        Hey! I sent 500 USDT to the deposit address about 30 mins ago. Still in pending.
                                    </Typography>
                                </Paper>
                            </Box>

                            {/* Agent bubble */}
                            <Box sx={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
                                <Paper sx={{ p: 1.5, borderRadius: '16px 16px 4px 16px', bgcolor: '#e0e7ff' }}>
                                    <Typography variant="caption" sx={{ display: 'block', color: '#4f46e5', fontSize: '0.6rem', mb: 0.5 }}>Agent [15:42]</Typography>
                                    <Typography variant="body2" color="#312e81">
                                        Hello! Let me inspect your transaction. Can you send the TxHash or payment receipt?
                                    </Typography>
                                </Paper>
                            </Box>

                            {/* User bubble */}
                            <Box sx={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                                <Paper sx={{ p: 1.5, borderRadius: '16px 16px 16px 4px', bgcolor: 'white', border: '1px solid #e2e8f0' }}>
                                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontSize: '0.6rem', mb: 0.5 }}>User [15:43]</Typography>
                                    <Typography variant="body2" color="#334155">
                                        Sure, hash is 0x7b8f9e...2a3c. Please approve it.
                                    </Typography>
                                </Paper>
                            </Box>
                        </Box>

                        {/* Chat Input */}
                        <Box sx={{ p: 1.5, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 1 }}>
                            <TextField
                                fullWidth
                                placeholder="Type your support message..."
                                size="small"
                                disabled
                            />
                            <IconButton color="primary" disabled sx={{ bgcolor: '#eff6ff' }}>
                                <SendIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Box>
                    </Grid>

                    {/* Right User Inspector Panel */}
                    <Grid size={{ xs: 12, md: 3 }} sx={{ borderLeft: '1px solid #e2e8f0', bgcolor: '#f8fafc', height: '100%', p: 2, overflowY: 'auto' }}>
                        <Typography variant="subtitle2" fontWeight={800} color="#1e293b" sx={{ mb: 2 }}>User Inspector</Typography>
                        
                        <Stack spacing={2}>
                            <Box sx={{ textAlign: 'center', py: 1 }}>
                                <Avatar sx={{ mx: 'auto', mb: 1, bgcolor: '#4f46e5', width: 48, height: 48 }}>J</Avatar>
                                <Typography variant="subtitle2" fontWeight={800}>Jack Dev</Typography>
                                <Typography variant="caption" color="text.secondary">Silver Rank Partner</Typography>
                            </Box>

                            <Divider />

                            <Stack spacing={1.5}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" color="text.secondary">Mining Power</Typography>
                                    <Typography variant="caption" fontWeight={700}>4,500 MP</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" color="text.secondary">Wallet Balance</Typography>
                                    <Typography variant="caption" fontWeight={700} color="#16a34a">120.00 USDT</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" color="text.secondary">Direct referrals</Typography>
                                    <Typography variant="caption" fontWeight={700}>34 Users</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <Typography variant="caption" color="text.secondary">Total Invested</Typography>
                                    <Typography variant="caption" fontWeight={700}>1,500.00 USDT</Typography>
                                </Box>
                            </Stack>

                            <Divider sx={{ my: 1 }} />
                            
                            <Button variant="outlined" size="small" disabled sx={{ textTransform: 'none', fontWeight: 700 }}>
                                View Full Profile
                            </Button>
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
                                py: 1.8,
                                borderRadius: 3.5,
                                background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                                fontWeight: 800,
                                textTransform: 'none',
                                fontSize: '1rem',
                                boxShadow: '0 8px 16px rgba(79, 70, 229, 0.2)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #3730a3 0%, #221d7a 100%)',
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
                                py: 1.8,
                                borderRadius: 3.5,
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
                        * This feature requires CRM Livechat Database integration.
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
                    Unlock CRM support Desk
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
                            bgcolor: '#eff6ff',
                            color: '#4f46e5',
                            mb: 2
                        }}>
                            <CloudDoneIcon sx={{ fontSize: 32 }} />
                        </Box>
                        <Typography variant="h5" fontWeight={900} color="primary" gutterBottom>
                            {price}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Get lifetime access to the Unified Live Chat support desk, including Telegram/WhatsApp user chat sync and details inspection tool.
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
                            borderRadius: 3.5,
                            py: 1.8,
                            fontWeight: 800,
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
