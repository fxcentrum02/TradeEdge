'use client';

import { useState, useId } from 'react';
import { useRouter } from 'next/navigation';
import {
    Box, Typography, TextField, Button, Grid, Alert, Snackbar
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import type { AppSettings } from '@/types';

export default function AppearanceTab({
    settings,
    onUpdate
}: {
    settings: AppSettings,
    onUpdate: () => void
}) {
    const id = useId();
    const router = useRouter();
    const [formData, setFormData] = useState({
        appName: settings.appName,
        brandColor: settings.brandColor,
    });

    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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
                setToast({ open: true, message: 'Appearance settings saved successfully', severity: 'success' });
                onUpdate();
                setTimeout(() => {
                    window.location.reload();
                }, 600);
            } else {
                throw new Error(data.error || 'Failed to save');
            }
        } catch (error: any) {
            setToast({ open: true, message: error.message, severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setFormData({ ...formData, brandColor: '#84cc16' });
    };

    return (
        <Box>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 3 }}>
                Brand Profile
            </Typography>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                        id={`${id}-appName`}
                        fullWidth
                        label="Application Name"
                        name="appName"
                        value={formData.appName}
                        onChange={handleChange}
                        variant="outlined"
                        helperText="The name displayed in the sidebar and headers"
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                        <TextField
                            id={`${id}-brandColor`}
                            fullWidth
                            label="Primary Brand Color (Hex)"
                            name="brandColor"
                            value={formData.brandColor}
                            onChange={handleChange}
                            variant="outlined"
                            helperText="Used for buttons, highlights, and sidebars"
                        />
                        <Box sx={{
                            width: 56,
                            height: 56,
                            borderRadius: 1,
                            border: '1px solid #e2e8f0',
                            flexShrink: 0,
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            <input
                                type="color"
                                name="brandColor"
                                value={formData.brandColor || '#cccccc'}
                                onChange={handleChange}
                                style={{
                                    width: '150%',
                                    height: '150%',
                                    position: 'absolute',
                                    top: '-25%',
                                    left: '-25%',
                                    cursor: 'pointer',
                                    border: 'none',
                                    padding: 0
                                }}
                            />
                        </Box>
                    </Box>
                </Grid>
            </Grid>

            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', mr: 'auto' }}>
                    Note: Refresh the page to see changes take full effect across the platform.
                </Typography>
                <Button
                    variant="outlined"
                    onClick={handleReset}
                    sx={{
                        color: '#64748b',
                        borderColor: '#e2e8f0',
                        fontWeight: 600,
                        py: 1,
                        px: 3,
                        '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' }
                    }}
                >
                    Reset Color
                </Button>
                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSave}
                    disabled={saving}
                    sx={{
                        bgcolor: formData.brandColor || 'var(--brand-main)',
                        color: 'white',
                        fontWeight: 600,
                        py: 1,
                        px: 3,
                        '&:hover': { filter: 'brightness(0.9)' }
                    }}
                >
                    {saving ? 'Saving...' : 'Apply Theme'}
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
