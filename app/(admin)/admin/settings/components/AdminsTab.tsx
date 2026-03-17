'use client';

import { useState, useEffect, useId } from 'react';
import {
    Box, Typography, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, Paper, Chip,
    IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, MenuItem, Alert, Snackbar, CircularProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import type { Admin } from '@/types';

export default function AdminsTab() {
    const id = useId();
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'admin'
    });

    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

    const fetchAdmins = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/admins');
            const data = await res.json();
            if (data.success) {
                setAdmins(data.data);
            }
        } catch (error) {
            console.error('Failed to load admins');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdmins();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleCreate = async () => {
        try {
            setSaving(true);
            const res = await fetch('/api/admin/admins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            if (data.success) {
                setToast({ open: true, message: 'Admin created successfully', severity: 'success' });
                setDialogOpen(false);
                setFormData({ name: '', email: '', password: '', role: 'admin' });
                fetchAdmins();
            } else {
                throw new Error(data.error || 'Failed to create');
            }
        } catch (error: any) {
            setToast({ open: true, message: error.message, severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this admin account?')) return;

        try {
            const res = await fetch(`/api/admin/admins/${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                setToast({ open: true, message: 'Admin deleted', severity: 'success' });
                fetchAdmins();
            } else {
                throw new Error(data.error || 'Failed to delete');
            }
        } catch (error: any) {
            setToast({ open: true, message: error.message, severity: 'error' });
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" fontWeight={700}>
                    Sub-User Accounts
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setDialogOpen(true)}
                    sx={{ bgcolor: 'var(--brand-main)', color: 'white', '&:hover': { bgcolor: 'var(--brand-dark)' } }}
                >
                    Add Admin
                </Button>
            </Box>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Table>
                        <TableHead sx={{ bgcolor: '#f8fafc' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {admins.map((admin) => (
                                <TableRow key={admin.id}>
                                    <TableCell>{admin.name}</TableCell>
                                    <TableCell>{admin.email}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={admin.role}
                                            size="small"
                                            sx={{
                                                bgcolor: admin.role === 'superadmin' ? '#ef4444' : '#3b82f6',
                                                color: 'white',
                                                fontWeight: 600,
                                                fontSize: '0.7rem'
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={admin.isActive ? 'Active' : 'Inactive'}
                                            size="small"
                                            sx={{
                                                bgcolor: admin.isActive ? 'rgba(132, 204, 22, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                                                color: admin.isActive ? 'var(--brand-dark)' : '#64748b',
                                                fontWeight: 600,
                                                fontSize: '0.7rem'
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => handleDelete(admin.id)}
                                            disabled={admin.role === 'superadmin'} // Basic safeguard
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>Add New Admin</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                        <TextField
                            id={`${id}-name`}
                            label="Name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            fullWidth
                        />
                        <TextField
                            id={`${id}-email`}
                            label="Email"
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            fullWidth
                        />
                        <TextField
                            id={`${id}-password`}
                            label="Password"
                            name="password"
                            type="password"
                            value={formData.password}
                            onChange={handleChange}
                            fullWidth
                        />
                        <TextField
                            id={`${id}-role`}
                            select
                            label="Role"
                            name="role"
                            value={formData.role}
                            onChange={handleChange}
                            fullWidth
                        >
                            <MenuItem value="admin">Admin</MenuItem>
                            <MenuItem value="superadmin">Superadmin</MenuItem>
                        </TextField>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setDialogOpen(false)} sx={{ color: '#64748b' }}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreate}
                        disabled={saving || !formData.name || !formData.email || !formData.password}
                        sx={{ bgcolor: 'var(--brand-main)', '&:hover': { bgcolor: 'var(--brand-dark)' } }}
                    >
                        {saving ? 'Creating...' : 'Create Account'}
                    </Button>
                </DialogActions>
            </Dialog>

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
