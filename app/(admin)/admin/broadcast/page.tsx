'use client';

import { useState } from 'react';
import {
    Box, Card, CardContent, Typography, TextField, Button,
    FormControl, InputLabel, Select, MenuItem, Stack,
    Alert, Snackbar, CircularProgress, Divider, Paper
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import InfoIcon from '@mui/icons-material/Info';
import { useAuth } from '@/context/AuthContext';
import LockedFeatureView from '../_components/LockedFeatureView';

export default function BroadcastPage() {
    const { authFetch } = useAuth();
    const [message, setMessage] = useState('');
    const [segment, setSegment] = useState('all');
    const [loading, setLoading] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    // Temporary: Feature is locked
    const isLocked = true;

    if (isLocked) {
        return (
            <LockedFeatureView
                title="Broadcast Tool Locked"
                description="The global broadcast engine requires higher infrastructure priority. Purchase the AWS Security Cloud Service to unlock mass-messaging capabilities and target specific user segments directly on Telegram."
                features={[
                    "Direct Telegram messaging",
                    "User segmentation targeting",
                    "Real-time delivery analytics",
                    "Scheduled broadcasts"
                ]}
                imageUrl="/previews/broadcast.png"
            />
        );
    }

    const handleSend = async () => {
        if (!message.trim()) {
            setSnackbar({ open: true, message: 'Message cannot be empty', severity: 'error' });
            return;
        }

        if (confirm(`Are you sure you want to send this broadcast to "${segment}"? This cannot be undone.`)) {
            setLoading(true);
            try {
                const res = await authFetch('/api/admin/broadcast', {
                    method: 'POST',
                    body: JSON.stringify({ message, segment }),
                });

                const data = await res.json();
                if (data.success) {
                    setSnackbar({ open: true, message: data.data.message, severity: 'success' });
                    setMessage('');
                } else {
                    setSnackbar({ open: true, message: data.error || 'Failed to send broadcast', severity: 'error' });
                }
            } catch (error) {
                console.error('Broadcast error:', error);
                setSnackbar({ open: true, message: 'An error occurred while sending the broadcast', severity: 'error' });
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <Box sx={{ p: 4 }}>
            <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
                📢 Telegram Broadcast Tool
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Send announcements, ROI reports, or news directly to your users' Telegram.
            </Typography>

            <Stack spacing={4}>
                <Card sx={{ borderRadius: 4, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                    <CardContent sx={{ p: 4 }}>
                        <Stack spacing={3}>
                            <FormControl fullWidth>
                                <InputLabel>Target Audience</InputLabel>
                                <Select
                                    value={segment}
                                    label="Target Audience"
                                    onChange={(e) => setSegment(e.target.value)}
                                >
                                    <MenuItem value="all">All Registered Users</MenuItem>
                                    <MenuItem value="active_traders">Active Miners (Mining Power &gt; 0)</MenuItem>
                                    <MenuItem value="inactive_users">Inactive Users (No Mining Power)</MenuItem>
                                </Select>
                            </FormControl>

                            <TextField
                                fullWidth
                                multiline
                                rows={8}
                                label="Broadcast Message"
                                placeholder="Enter your message here... You can use HTML tags like <b>bold</b>, <i>italic</i>, and <a href='...'>links</a>."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                helperText={`${message.length} characters (Max ~4096)`}
                            />

                            <Paper sx={{ p: 2, bgcolor: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 2 }}>
                                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                    <InfoIcon sx={{ color: '#0ea5e9', mt: 0.2 }} />
                                    <Typography variant="body2" color="#0369a1" sx={{ lineHeight: 1.6 }}>
                                        <b>Best Practices:</b> Keep it concise. High-frequency broadcasts may lead to users blocking the bot. Use Emojis to keep engagement high. Avoid spamming links.
                                    </Typography>
                                </Stack>
                            </Paper>

                            <Box sx={{ textAlign: 'right' }}>
                                <Button
                                    variant="contained"
                                    size="large"
                                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                                    disabled={loading || !message.trim()}
                                    onClick={handleSend}
                                    sx={{
                                        px: 6, py: 1.5,
                                        borderRadius: 3,
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        textTransform: 'none',
                                        fontSize: '1rem',
                                        fontWeight: 700,
                                        boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                                        '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }
                                    }}
                                >
                                    {loading ? 'Sending...' : 'Send Broadcast'}
                                </Button>
                            </Box>
                        </Stack>
                    </CardContent>
                </Card>

                {/* Preview Box */}
                {message && (
                    <Box sx={{ px: 2 }}>
                        <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase' }}>
                            Live Preview
                        </Typography>
                        <Paper sx={{ p: 3, borderRadius: 4, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                            <Typography
                                variant="body1"
                                sx={{ whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif' }}
                                dangerouslySetInnerHTML={{ __html: message.replace(/\n/g, '<br/>') }}
                            />
                        </Paper>
                    </Box>
                )}
            </Stack>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert severity={snackbar.severity} sx={{ width: '100%', borderRadius: 2 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
