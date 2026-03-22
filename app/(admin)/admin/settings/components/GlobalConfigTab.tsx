'use client';

import { useState, useId } from 'react';
import {
    Box, Typography, TextField, Button, Grid, Alert, Snackbar,
    ToggleButtonGroup, ToggleButton, FormControl, InputLabel,
    Switch, FormControlLabel, Paper, Divider
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import LockIcon from '@mui/icons-material/Lock';
import { useRouter } from 'next/navigation';
import type { AppSettings } from '@/types';

export default function GlobalConfigTab({
    settings,
    onUpdate
}: {
    settings: AppSettings,
    onUpdate: () => void
}) {
    const id = useId();
    const router = useRouter();
    const [formData, setFormData] = useState({
        minWithdrawalAmount: settings.minWithdrawalAmount,
        minReferralWithdrawalAmount: settings.minReferralWithdrawalAmount || 10,
        withdrawalFeeType: settings.withdrawalFeeType || 'PERCENTAGE',
        withdrawalFeeValue: settings.withdrawalFeeValue ?? settings.withdrawalFeePercentage ?? 0,
        defaultPlanDurationDays: settings.defaultPlanDurationDays,
        tier1ReferralPercentage: settings.tier1ReferralPercentage,
        referralClaimMultiplier: settings.referralClaimMultiplier || 1,
        maintenanceMode: settings.maintenanceMode || false,
        receivingAddress: settings.receivingAddress || '',
        qrCodeUrl: settings.qrCodeUrl || '',
    });

    const [qrValue, setQrValue] = useState('');
    const [uploading, setUploading] = useState(false);

    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        const numValue = value === '' ? '' : Number(value);
        setFormData({ ...formData, [name]: numValue });
    };

    const handleToggleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.checked });
    };

    const handleTypeChange = (_: any, newType: 'PERCENTAGE' | 'FIXED') => {
        if (newType !== null) {
            setFormData({ ...formData, withdrawalFeeType: newType });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const uploadFormData = new FormData();
            uploadFormData.append('file', file);

            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                body: uploadFormData,
            });
            const data = await res.json();
            if (data.success) {
                setFormData({ ...formData, qrCodeUrl: data.data.url });
                setToast({ open: true, message: 'QR Code uploaded', severity: 'success' });
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        } catch (error: any) {
            setToast({ open: true, message: error.message, severity: 'error' });
        } finally {
            setUploading(false);
        }
    };

    const generateQrLink = () => {
        if (!qrValue.trim()) return;
        // Using a public QR code API for simplicity
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrValue.trim())}`;
        setFormData({ ...formData, qrCodeUrl: url });
        setToast({ open: true, message: 'QR Code generated from link', severity: 'success' });
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setToast({ open: true, message: 'Settings saved successfully', severity: 'success' });
                onUpdate();
            } else {
                throw new Error(data.error || 'Failed to save');
            }
        } catch (error: any) {
            setToast({ open: true, message: error.message, severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Box>
            <Paper 
                sx={{ 
                    p: 3, 
                    mb: 4, 
                    borderRadius: 3, 
                    bgcolor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    boxShadow: 'none',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Box sx={{ p: 1, bgcolor: '#fff7ed', borderRadius: 2, color: '#f59e0b', display: 'flex' }}>
                            <LockIcon sx={{ fontSize: 20 }} />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight={700} color="#1e293b" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                🔧 Maintenance Mode
                                <Box sx={{ 
                                    fontSize: '0.65rem', 
                                    bgcolor: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
                                    color: 'white', 
                                    px: 1, 
                                    py: 0.2, 
                                    borderRadius: 1,
                                    fontWeight: 800,
                                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                                }}>
                                    PREMIUM
                                </Box>
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748b' }}>
                                This high-level infrastructure feature is currently locked.
                            </Typography>
                        </Box>
                    </Box>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => router.push('/admin/maintenance')}
                        sx={{ 
                            fontWeight: 700, 
                            textTransform: 'none',
                            color: '#f59e0b',
                            borderColor: '#ffedd5',
                            bgcolor: '#fff7ed',
                            '&:hover': { 
                                bgcolor: '#ffedd5',
                                borderColor: '#fed7aa'
                            }
                        }}
                    >
                        Learn More
                    </Button>
                </Box>
            </Paper>

            <Divider sx={{ mb: 4 }} />

            <Typography variant="h6" fontWeight={700} sx={{ mb: 3 }}>
                Configuration Parameters
            </Typography>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            id={`${id}-minWithdrawalAmount`}
                            fullWidth
                            label="Minimum Withdrawal Amount (USDT)"
                        name="minWithdrawalAmount"
                        type="number"
                        value={formData.minWithdrawalAmount}
                        onChange={handleChange}
                        variant="outlined"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                        <TextField
                            id={`${id}-minReferralWithdrawalAmount`}
                            fullWidth
                            label="Min Referral Claim Amount (USDT)"
                        name="minReferralWithdrawalAmount"
                        type="number"
                        value={formData.minReferralWithdrawalAmount}
                        onChange={handleChange}
                        variant="outlined"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                        <FormControl sx={{ minWidth: 120 }}>
                            <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 600, color: 'text.secondary' }}>Fee Type</Typography>
                            <ToggleButtonGroup
                                value={formData.withdrawalFeeType}
                                exclusive
                                onChange={handleTypeChange}
                                size="small"
                                sx={{
                                    height: 48,
                                    '& .MuiToggleButton-root': { px: 2, fontWeight: 600 }
                                }}
                            >
                                <ToggleButton value="PERCENTAGE">%</ToggleButton>
                                <ToggleButton value="FIXED">$</ToggleButton>
                            </ToggleButtonGroup>
                        </FormControl>
                        <TextField
                            id={`${id}-withdrawalFeeValue`}
                            fullWidth
                            label={`Withdrawal Fee (${formData.withdrawalFeeType === 'PERCENTAGE' ? '%' : 'USDT'})`}
                            name="withdrawalFeeValue"
                            type="number"
                            value={formData.withdrawalFeeValue}
                            onChange={handleChange}
                            variant="outlined"
                            sx={{ mt: 2.2 }}
                        />
                    </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                        id={`${id}-referralClaimMultiplier`}
                        fullWidth
                        label="Referral Claim Multiplier (x)"
                        name="referralClaimMultiplier"
                        type="number"
                        value={formData.referralClaimMultiplier}
                        onChange={handleChange}
                        variant="outlined"
                        helperText="User can claim up to (TP * Multiplier) in referral income"
                    />
                </Grid>
            </Grid>

            <Divider sx={{ my: 4 }} />

            <Typography variant="h6" fontWeight={700} sx={{ mb: 3 }}>
                Payment Settings
            </Typography>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                    <TextField
                        id={`${id}-receivingAddress`}
                        fullWidth
                        label="Admin Receiving Address (BEP20)"
                        name="receivingAddress"
                        value={formData.receivingAddress}
                        onChange={(e) => setFormData({ ...formData, receivingAddress: e.target.value })}
                        variant="outlined"
                        helperText="The address where users will send USDT payments."
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>QR Code</Typography>
                        {formData.qrCodeUrl ? (
                            <Box sx={{ mb: 2, position: 'relative', width: 200, height: 200 }}>
                                <img 
                                    src={formData.qrCodeUrl} 
                                    alt="QR Code Preview" 
                                    style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8, border: '1px solid #e2e8f0' }} 
                                />
                                <Button 
                                    size="small" 
                                    color="error" 
                                    variant="contained"
                                    onClick={() => setFormData({ ...formData, qrCodeUrl: '' })}
                                    sx={{ position: 'absolute', top: -10, right: -10, minWidth: 30, width: 30, height: 30, borderRadius: '50%', p: 0 }}
                                >
                                    ×
                                </Button>
                            </Box>
                        ) : (
                            <Box 
                                sx={{ 
                                    width: 200, 
                                    height: 200, 
                                    bgcolor: '#f8fafc', 
                                    border: '2px dashed #e2e8f0', 
                                    borderRadius: 3, 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    mb: 2,
                                    color: '#94a3b8'
                                }}
                            >
                                <Typography variant="caption">No QR Code</Typography>
                            </Box>
                        )}
                        
                        <Button
                            component="label"
                            variant="outlined"
                            disabled={uploading}
                            sx={{ textTransform: 'none', borderRadius: 2 }}
                        >
                            {uploading ? 'Uploading...' : 'Upload Image'}
                            <input
                                type="file"
                                hidden
                                accept="image/*"
                                onChange={handleFileUpload}
                            />
                        </Button>
                    </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>Generate from Link</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                            id={`${id}-qrValue`}
                            fullWidth
                            size="small"
                            placeholder="Paste address or URL"
                            value={qrValue}
                            onChange={(e) => setQrValue(e.target.value)}
                        />
                        <Button 
                            variant="contained" 
                            onClick={generateQrLink}
                            sx={{ textTransform: 'none', borderRadius: 2, whiteSpace: 'nowrap' }}
                        >
                            Generate
                        </Button>
                    </Box>
                    <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'text.secondary' }}>
                        Type the address here and click generate to create a QR code automatically.
                    </Typography>
                </Grid>
            </Grid>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={saving}
                    sx={{
                        bgcolor: 'var(--brand-main)',
                        color: 'white',
                        fontWeight: 600,
                        py: 1,
                        px: 3,
                        '&:hover': { bgcolor: 'var(--brand-dark)' }
                    }}
                >
                    {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
            </Box>

            <Snackbar
                open={toast.open}
                autoHideDuration={4000}
                onClose={() => setToast({ ...toast, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert severity={toast.severity} variant="filled">
                    {toast.message}
                </Alert>
            </Snackbar>
        </Box>
    );
}
