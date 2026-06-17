'use client';

import { useState, useEffect } from 'react';
import {
    Box, Card, CardContent, Typography, TextField, Button,
    Table, TableBody, TableCell, TableContainer, TableHead,
    TableRow, Paper, Chip, Stack, IconButton, InputAdornment,
    Alert, CircularProgress, Container
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HistoryIcon from '@mui/icons-material/History';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

interface FeatureRequest {
    _id: string;
    featureTitle: string;
    fullName: string;
    email: string;
    price: string;
    status: string;
    createdAt: string;
    requestedBy?: string;
}

export default function DeveloperRequestsPage() {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [requests, setRequests] = useState<FeatureRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // Try to auto-login if password was saved in session storage
    useEffect(() => {
        const savedPass = sessionStorage.getItem('dev_auth_pass');
        if (savedPass) {
            verifyPassword(savedPass);
        }
    }, []);

    const verifyPassword = async (passToVerify: string) => {
        setLoading(true);
        setErrorMsg('');
        try {
            const res = await fetch('/api/developer/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: passToVerify })
            });
            const data = await res.json();
            if (data.success) {
                setIsAuthenticated(true);
                setRequests(data.data || []);
                sessionStorage.setItem('dev_auth_pass', passToVerify);
                setPassword(passToVerify);
            } else {
                setErrorMsg(data.error || 'Invalid password.');
                sessionStorage.removeItem('dev_auth_pass');
            }
        } catch {
            setErrorMsg('Failed to connect to verification server.');
        } finally {
            setLoading(false);
        }
    };

    const handleLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!password.trim()) {
            setErrorMsg('Password cannot be empty.');
            return;
        }
        verifyPassword(password);
    };

    const handleLogout = () => {
        sessionStorage.removeItem('dev_auth_pass');
        setIsAuthenticated(false);
        setRequests([]);
        setPassword('');
        setErrorMsg('');
        setSuccessMsg('');
    };

    const handleStatusUpdate = async (requestId: string, newStatus: string) => {
        setActionLoading(requestId);
        setErrorMsg('');
        setSuccessMsg('');
        try {
            const res = await fetch('/api/developer/requests', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, requestId, newStatus })
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMsg(`Request successfully marked as ${newStatus}.`);
                // Refresh list
                verifyPassword(password);
            } else {
                setErrorMsg(data.error || 'Failed to update status.');
            }
        } catch {
            setErrorMsg('Network error. Failed to update status.');
        } finally {
            setActionLoading(null);
        }
    };

    const handleRefresh = () => {
        if (password) {
            verifyPassword(password);
        }
    };

    // Portal / Login Screen
    if (!isAuthenticated) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    background: 'linear-gradient(135deg, #020617 0%, #0f172a 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    px: 2
                }}
            >
                <Card
                    elevation={24}
                    sx={{
                        maxWidth: 420,
                        width: '100%',
                        borderRadius: 6,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(15, 23, 42, 0.65)',
                        backdropFilter: 'blur(16px)',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
                        position: 'relative',
                        overflow: 'hidden'
                    }}
                >
                    {/* Glow effect */}
                    <Box
                        sx={{
                            position: 'absolute',
                            top: -60,
                            right: -60,
                            width: 140,
                            height: 140,
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, transparent 70%)',
                            zIndex: 0
                        }}
                    />

                    <CardContent sx={{ p: 4, position: 'relative', zIndex: 1 }}>
                        <Stack spacing={3} alignItems="center" sx={{ textAlign: 'center', mb: 3 }}>
                            <Box
                                sx={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: '50%',
                                    bgcolor: 'rgba(245, 158, 11, 0.1)',
                                    border: '1px solid rgba(245, 158, 11, 0.25)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 8px 20px rgba(245, 158, 11, 0.1)'
                                }}
                            >
                                <LockIcon sx={{ fontSize: 30, color: '#fbbf24' }} />
                            </Box>
                            <Box>
                                <Typography variant="h5" fontWeight={900} sx={{ color: 'white', letterSpacing: '-0.02em' }}>
                                    Developer Console
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#94a3b8', mt: 0.5, display: 'block' }}>
                                    Trade Edge Enterprise Activations
                                </Typography>
                            </Box>
                        </Stack>

                        <form onSubmit={handleLoginSubmit}>
                            <Stack spacing={2.5}>
                                {errorMsg && (
                                    <Alert severity="error" variant="filled" sx={{ borderRadius: 2, fontSize: '0.8rem' }}>
                                        {errorMsg}
                                    </Alert>
                                )}

                                <TextField
                                    label="Developer Password"
                                    type={showPassword ? 'text' : 'password'}
                                    fullWidth
                                    variant="outlined"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={loading}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            color: 'white',
                                            bgcolor: 'rgba(255, 255, 255, 0.03)',
                                            borderRadius: 3,
                                            '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.12)' },
                                            '&:hover fieldset': { borderColor: 'rgba(255, 255, 255, 0.25)' },
                                            '&.Mui-focused fieldset': { borderColor: '#fbbf24' },
                                        },
                                        '& .MuiInputLabel-root': {
                                            color: '#64748b',
                                            '&.Mui-focused': { color: '#fbbf24' }
                                        }
                                    }}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    edge="end"
                                                    sx={{ color: '#64748b' }}
                                                >
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                <Button
                                    type="submit"
                                    variant="contained"
                                    fullWidth
                                    disabled={loading}
                                    sx={{
                                        py: 1.5,
                                        borderRadius: 3,
                                        fontWeight: 800,
                                        textTransform: 'none',
                                        bgcolor: '#fbbf24',
                                        color: '#0f172a',
                                        boxShadow: '0 8px 24px rgba(245, 158, 11, 0.25)',
                                        '&:hover': {
                                            bgcolor: '#f59e0b',
                                            transform: 'translateY(-1px)'
                                        },
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {loading ? <CircularProgress size={24} color="inherit" /> : 'Decrypt Console'}
                                </Button>
                            </Stack>
                        </form>
                    </CardContent>
                </Card>
            </Box>
        );
    }

    // Main Dashboard View (Authenticated)
    return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#020617', color: 'white', py: 6 }}>
            <Container maxWidth="lg">
                {/* Header */}
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2} sx={{ mb: 5 }}>
                    <Box>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                            <IconButton onClick={handleLogout} sx={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', p: 1 }}>
                                <ArrowBackIcon fontSize="small" />
                            </IconButton>
                            <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.03em' }}>
                                Enterprise Activation Console
                            </Typography>
                        </Stack>
                        <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Authorize and monitor container licenses requested by system administrators.
                        </Typography>
                    </Box>

                    <Stack direction="row" spacing={1.5}>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={handleRefresh}
                            disabled={loading}
                            sx={{
                                borderRadius: 3,
                                textTransform: 'none',
                                fontWeight: 700,
                                borderColor: 'rgba(255,255,255,0.12)',
                                color: '#cbd5e1',
                                '&:hover': {
                                    borderColor: 'rgba(255,255,255,0.25)',
                                    bgcolor: 'rgba(255,255,255,0.03)'
                                }
                            }}
                        >
                            Refresh
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleLogout}
                            sx={{
                                borderRadius: 3,
                                textTransform: 'none',
                                fontWeight: 700,
                                bgcolor: '#ef4444',
                                color: 'white',
                                '&:hover': { bgcolor: '#dc2626' }
                            }}
                        >
                            Lock Console
                        </Button>
                    </Stack>
                </Stack>

                {/* Notifications */}
                {errorMsg && (
                    <Alert severity="error" variant="filled" sx={{ borderRadius: 3, mb: 3 }}>
                        {errorMsg}
                    </Alert>
                )}
                {successMsg && (
                    <Alert severity="success" variant="filled" sx={{ borderRadius: 3, mb: 3 }}>
                        {successMsg}
                    </Alert>
                )}

                {/* Requests List */}
                <Card
                    elevation={0}
                    sx={{
                        borderRadius: 5,
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        background: 'rgba(15, 23, 42, 0.4)',
                        backdropFilter: 'blur(12px)',
                        overflow: 'hidden'
                    }}
                >
                    <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
                        <Table sx={{ minWidth: 650 }}>
                            <TableHead>
                                <TableRow sx={{ borderBottom: '2px solid rgba(255,255,255,0.08)' }}>
                                    <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Requested Date</TableCell>
                                    <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Feature Details</TableCell>
                                    <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Admin Details</TableCell>
                                    <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Licensing Fee</TableCell>
                                    <TableCell sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</TableCell>
                                    <TableCell align="right" sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {requests.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center" sx={{ py: 8, color: '#64748b' }}>
                                            <HistoryIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                                            <Typography variant="body1" fontWeight={600}>
                                                No activation tickets found
                                            </Typography>
                                            <Typography variant="caption">
                                                New requests will appear here automatically when administrators click Activate.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    requests.map((req) => (
                                        <TableRow key={req._id} sx={{ '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' }, borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background-color 0.2s' }}>
                                            <TableCell sx={{ color: '#94a3b8' }}>
                                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                    {new Date(req.createdAt).toLocaleDateString()}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#475569', display: 'block' }}>
                                                    {new Date(req.createdAt).toLocaleTimeString()}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={850} sx={{ color: '#fbbf24' }}>
                                                    {req.featureTitle}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight={700} sx={{ color: 'white' }}>
                                                    {req.fullName}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                                    {req.email}
                                                </Typography>
                                                {req.requestedBy && (
                                                    <Typography variant="caption" sx={{ color: '#475569', display: 'block', mt: 0.5 }}>
                                                        User ID: {req.requestedBy}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell sx={{ color: 'white', fontWeight: 750 }}>
                                                {req.price}
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={req.status}
                                                    size="small"
                                                    sx={{
                                                        fontWeight: 700,
                                                        fontSize: '0.65rem',
                                                        textTransform: 'uppercase',
                                                        bgcolor: req.status === 'activation requested' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(22, 163, 74, 0.12)',
                                                        color: req.status === 'activation requested' ? '#fbbf24' : '#22c55e',
                                                        border: req.status === 'activation requested' ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(22, 163, 74, 0.25)'
                                                    }}
                                                />
                                            </TableCell>
                                            <TableCell align="right">
                                                {req.status === 'activation requested' ? (
                                                    <Button
                                                        variant="contained"
                                                        size="small"
                                                        startIcon={actionLoading === req._id ? <CircularProgress size={14} color="inherit" /> : <CheckCircleOutlineIcon />}
                                                        disabled={actionLoading !== null}
                                                        onClick={() => handleStatusUpdate(req._id, 'activated')}
                                                        sx={{
                                                            borderRadius: 2,
                                                            textTransform: 'none',
                                                            fontWeight: 700,
                                                            bgcolor: '#22c55e',
                                                            color: '#020617',
                                                            '&:hover': { bgcolor: '#16a34a' }
                                                        }}
                                                    >
                                                        Approve & Active
                                                    </Button>
                                                ) : (
                                                    <Typography variant="caption" sx={{ color: '#475569', fontStyle: 'italic' }}>
                                                        No Actions Available
                                                    </Typography>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Card>
            </Container>
        </Box>
    );
}
