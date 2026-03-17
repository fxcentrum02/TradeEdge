'use client';

import { useEffect, useState, useCallback, useMemo, useId } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Chip, Button, Dialog, DialogTitle, DialogContent,
    DialogActions, TextField, Switch, FormControlLabel, Snackbar, Alert,
    IconButton, Skeleton, Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { formatCurrency } from '@/lib/utils';
import type { Plan } from '@/types';
import AdminAdvancedFilters, { FilterFieldConfig, FilterValues } from '../_components/AdminAdvancedFilters';

interface PlanFormData {
    name: string;
    description: string;
    minAmount: string;
    maxAmount: string;
    dailyRoi: string;
    duration: string;
    isActive: boolean;
    sortOrder: string;
}

const defaultForm: PlanFormData = {
    name: '',
    description: '',
    minAmount: '',
    maxAmount: '',
    dailyRoi: '5.5',
    duration: '30',
    isActive: true,
    sortOrder: '0',
};

export default function AdminPlansPage() {
    const id = useId();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; plan: Plan | null }>({ open: false, plan: null });
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
    const [form, setForm] = useState<PlanFormData>(defaultForm);
    const [saving, setSaving] = useState(false);
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterValues, setFilterValues] = useState<FilterValues>({});

    const PLAN_FILTER_FIELDS: FilterFieldConfig[] = [
        { field: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
    ];

    const filteredPlans = useMemo(() => {
        return plans.filter(p => {
            if (filterValues.status === 'active' && !p.isActive) return false;
            if (filterValues.status === 'inactive' && p.isActive) return false;
            return true;
        });
    }, [plans, filterValues]);

    const activeFilterCount = Object.values(filterValues).filter(v => v !== '' && v !== undefined).length;

    const fetchPlans = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/plans', { credentials: 'include' });
            const data = await res.json();
            if (data.success) setPlans(data.data);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchPlans(); }, [fetchPlans]);

    const openCreate = () => {
        setEditingPlan(null);
        setForm(defaultForm);
        setDialogOpen(true);
    };

    const openEdit = (plan: Plan) => {
        setEditingPlan(plan);
        setForm({
            name: plan.name,
            description: plan.description || '',
            minAmount: String(plan.minAmount),
            maxAmount: plan.maxAmount != null ? String(plan.maxAmount) : '',
            dailyRoi: String(plan.dailyRoi),
            duration: String(plan.duration),
            isActive: plan.isActive,
            sortOrder: String(plan.sortOrder),
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.name || !form.minAmount || !form.dailyRoi) return;
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                description: form.description || null,
                minAmount: parseFloat(form.minAmount),
                maxAmount: form.maxAmount ? parseFloat(form.maxAmount) : undefined,
                dailyRoi: parseFloat(form.dailyRoi),
                duration: parseInt(form.duration) || 30,
                isActive: form.isActive,
                sortOrder: parseInt(form.sortOrder) || 0,
            };

            let res;
            if (editingPlan) {
                res = await fetch(`/api/admin/plans/${editingPlan.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    credentials: 'include',
                });
            } else {
                res = await fetch('/api/plans', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    credentials: 'include',
                });
            }
            const data = await res.json();
            if (data.success) {
                setSnackbar({ open: true, message: editingPlan ? 'Tier updated!' : 'Tier created!', severity: 'success' });
                setDialogOpen(false);
                fetchPlans();
            } else {
                setSnackbar({ open: true, message: data.error || 'Failed', severity: 'error' });
            }
        } catch {
            setSnackbar({ open: true, message: 'Network error', severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteDialog.plan) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/plans/${deleteDialog.plan.id}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            const data = await res.json();
            if (data.success) {
                setSnackbar({ open: true, message: 'Tier deleted', severity: 'success' });
                setDeleteDialog({ open: false, plan: null });
                fetchPlans();
            } else {
                setSnackbar({ open: true, message: data.error || 'Failed', severity: 'error' });
            }
        } catch {
            setSnackbar({ open: true, message: 'Network error', severity: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // Preview calculation for form
    const previewAmount = form.minAmount ? parseFloat(form.minAmount) + 50 : 100;
    const previewDailyRoi = form.dailyRoi ? parseFloat(form.dailyRoi) : 5.5;
    const previewDaily = (previewAmount * previewDailyRoi) / 100;
    const previewTotal = previewDaily * (parseInt(form.duration) || 30);

    return (
        <Box>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                        <Typography variant="h4" fontWeight={800} sx={{ color: '#1e293b' }}>
                            Investment Tiers
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Define range-based investment tiers with daily ROI percentages
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5 }}>
                        <Button
                            size="small"
                            startIcon={<FilterAltIcon />}
                            onClick={() => setFilterOpen(true)}
                            sx={{
                                textTransform: 'none', borderRadius: 2, fontWeight: 600,
                                color: activeFilterCount > 0 ? 'primary.main' : 'text.secondary',
                            }}
                        >
                            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={openCreate}
                            sx={{
                                background: 'linear-gradient(135deg, var(--brand-main) 0%, var(--brand-dark) 100%)',
                                textTransform: 'none',
                                borderRadius: 2.5,
                                px: 3,
                                fontWeight: 700,
                                boxShadow: '0 4px 14px rgba(132,204,22,0.35)',
                            }}
                        >
                            Add Tier
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* Tiers Table */}
            <Paper sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Tier Name</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Range (USDT)</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Daily ROI</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Duration</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Example Earnings</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.8rem' }} align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <TableRow key={i}>
                                        {Array.from({ length: 7 }).map((_, j) => (
                                            <TableCell key={j}><Skeleton /></TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : plans.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                                        <Box sx={{ textAlign: 'center' }}>
                                            <TrendingUpIcon sx={{ fontSize: 40, color: '#cbd5e1', mb: 1 }} />
                                            <Typography color="text.secondary" gutterBottom>No tiers yet</Typography>
                                            <Button
                                                variant="contained"
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={openCreate}
                                                sx={{ background: 'linear-gradient(135deg, var(--brand-main) 0%, var(--brand-dark) 100%)', textTransform: 'none', borderRadius: 2 }}
                                            >
                                                Create First Tier
                                            </Button>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredPlans.map((plan) => {
                                    const exampleAmount = plan.minAmount + (plan.maxAmount ? (plan.maxAmount - plan.minAmount) / 2 : 50);
                                    const exampleDaily = (exampleAmount * plan.dailyRoi) / 100;
                                    return (
                                        <TableRow key={plan.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                                            <TableCell sx={{ py: 2 }}>
                                                <Typography fontWeight={700}>{plan.name}</Typography>
                                                {plan.description && (
                                                    <Typography variant="caption" color="text.secondary">{plan.description}</Typography>
                                                )}
                                            </TableCell>
                                            <TableCell sx={{ py: 2 }}>
                                                <Typography variant="body2" fontWeight={600}>
                                                    {formatCurrency(plan.minAmount)} – {plan.maxAmount ? formatCurrency(plan.maxAmount) : '∞'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ py: 2 }}>
                                                <Chip
                                                    label={`${plan.dailyRoi}% / day`}
                                                    size="small"
                                                    sx={{ bgcolor: '#dcfce7', color: '#16a34a', fontWeight: 700 }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ py: 2 }}>{plan.duration} days</TableCell>
                                            <TableCell sx={{ py: 2 }}>
                                                <Typography variant="caption" color="text.secondary">
                                                    on {formatCurrency(exampleAmount)}:
                                                </Typography>
                                                <Typography variant="body2" fontWeight={600} color="#10b981">
                                                    +{exampleDaily.toFixed(2)}/day
                                                </Typography>
                                            </TableCell>
                                            <TableCell sx={{ py: 2 }}>
                                                <Chip
                                                    label={plan.isActive ? 'Active' : 'Inactive'}
                                                    size="small"
                                                    color={plan.isActive ? 'success' : 'default'}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ py: 2 }} align="right">
                                                <Tooltip title="Edit">
                                                    <IconButton size="small" onClick={() => openEdit(plan)}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => setDeleteDialog({ open: true, plan })}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Create / Edit Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
                    {editingPlan ? `Edit "${editingPlan.name}"` : 'Create Investment Tier'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
                        {/* Preview Card */}
                        {form.minAmount && form.dailyRoi && (
                            <Box
                                sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    bgcolor: '#f0fdf4',
                                    border: '1px solid #86efac',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <Box>
                                    <Typography variant="caption" color="text.secondary">Example: invest {formatCurrency(previewAmount)}</Typography>
                                    <Typography variant="body1" fontWeight={700} color="#10b981">
                                        +{previewDaily.toFixed(2)} USDT/day
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                    <Typography variant="caption" color="text.secondary">30-day total</Typography>
                                    <Typography variant="body1" fontWeight={700} color="#10b981">
                                        ~{previewTotal.toFixed(2)} USDT
                                    </Typography>
                                </Box>
                            </Box>
                        )}

                        <TextField
                            id={`${id}-name`}
                            label="Tier Name *"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            fullWidth
                            placeholder="e.g. Starter, Silver, Gold, Platinum"
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />

                        <TextField
                            id={`${id}-description`}
                            label="Description (optional)"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                            fullWidth
                            multiline
                            rows={2}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />

                        {/* Range Inputs */}
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                id={`${id}-minAmount`}
                                label="Min Amount (USDT) *"
                                type="number"
                                value={form.minAmount}
                                onChange={(e) => setForm({ ...form, minAmount: e.target.value })}
                                fullWidth
                                helperText="Inclusive lower bound"
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                            <TextField
                                id={`${id}-maxAmount`}
                                label="Max Amount (USDT)"
                                type="number"
                                value={form.maxAmount}
                                onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
                                fullWidth
                                helperText="Leave blank for unlimited"
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <TextField
                                id={`${id}-dailyRoi`}
                                label="Daily ROI (%) *"
                                type="number"
                                value={form.dailyRoi}
                                onChange={(e) => setForm({ ...form, dailyRoi: e.target.value })}
                                fullWidth
                                inputProps={{ step: 0.1, min: 0 }}
                                helperText="e.g. 5.5 = 5.5%/day"
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                            <TextField
                                id={`${id}-duration`}
                                label="Duration (days)"
                                type="number"
                                value={form.duration}
                                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                                fullWidth
                                helperText="Default: 30 days"
                                sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                            />
                        </Box>

                        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                            <TextField
                                id={`${id}-sortOrder`}
                                label="Sort Order"
                                type="number"
                                value={form.sortOrder}
                                onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                                sx={{ width: 140, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                helperText="Lower = first"
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={form.isActive}
                                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                                        color="success"
                                    />
                                }
                                label="Active (visible to users)"
                            />
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ p: 3, pt: 1, gap: 1 }}>
                    <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none', borderRadius: 2 }}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={saving || !form.name || !form.minAmount || !form.dailyRoi}
                        sx={{
                            background: 'linear-gradient(135deg, var(--brand-main) 0%, var(--brand-dark) 100%)',
                            textTransform: 'none',
                            borderRadius: 2,
                            fontWeight: 700,
                            px: 4,
                        }}
                    >
                        {saving ? 'Saving...' : editingPlan ? 'Update Tier' : 'Create Tier'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, plan: null })}>
                <DialogTitle fontWeight={700}>Delete Tier?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete <strong>"{deleteDialog.plan?.name}"</strong>?
                        Existing subscriptions will not be affected.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ p: 2, gap: 1 }}>
                    <Button onClick={() => setDeleteDialog({ open: false, plan: null })} sx={{ textTransform: 'none' }}>Cancel</Button>
                    <Button variant="contained" color="error" onClick={handleDelete} disabled={saving} sx={{ textTransform: 'none' }}>
                        {saving ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ borderRadius: 2 }}>
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Advanced Filters Dialog */}
            <AdminAdvancedFilters
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                fields={PLAN_FILTER_FIELDS}
                values={filterValues}
                onApply={setFilterValues}
                onClear={() => setFilterValues({})}
            />
        </Box>
    );
}
