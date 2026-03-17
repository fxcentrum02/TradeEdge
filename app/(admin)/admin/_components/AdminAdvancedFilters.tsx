'use client';

import React, { useState, useEffect, useId } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
    Button, TextField, MenuItem, IconButton, Chip, Switch, FormControlLabel,
    alpha, useTheme, Select, FormControl, InputLabel, OutlinedInput,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterAlt';
import DeleteIcon from '@mui/icons-material/Delete';

export interface FilterFieldConfig {
    field: string;
    label: string;
    type: 'text' | 'select' | 'number' | 'boolean';
    options?: { value: string; label: string }[];
}

export interface FilterValues {
    [key: string]: string | number | boolean | undefined;
}

interface AdminAdvancedFiltersProps {
    open: boolean;
    onClose: () => void;
    fields: FilterFieldConfig[];
    values: FilterValues;
    onApply: (values: FilterValues) => void;
    onClear: () => void;
    title?: string;
}

export default function AdminAdvancedFilters({
    open, onClose, fields, values, onApply, onClear, title,
}: AdminAdvancedFiltersProps) {
    const id = useId();
    const theme = useTheme();
    const [localValues, setLocalValues] = useState<FilterValues>({});

    useEffect(() => {
        if (open) setLocalValues({ ...values });
    }, [open, values]);

    const handleChange = (field: string, value: string | number | boolean) => {
        setLocalValues(prev => ({ ...prev, [field]: value }));
    };

    const handleApply = () => {
        // Remove empty values
        const cleaned: FilterValues = {};
        for (const [k, v] of Object.entries(localValues)) {
            if (v !== '' && v !== undefined && v !== null) cleaned[k] = v;
        }
        onApply(cleaned);
        onClose();
    };

    const handleClear = () => {
        setLocalValues({});
        onClear();
    };

    const activeCount = Object.values(localValues).filter(v => v !== '' && v !== undefined && v !== null).length;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ sx: { borderRadius: 3, maxHeight: '85vh' } }}
        >
            <DialogTitle sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: `1px solid ${theme.palette.divider}`,
                bgcolor: alpha(theme.palette.primary.main, 0.04), px: 3, py: 2,
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <FilterListIcon color="primary" />
                    <Typography variant="h6" fontWeight={700} fontSize="1.1rem">
                        {title || 'Advanced Filters'}
                    </Typography>
                    {activeCount > 0 && (
                        <Chip label={`${activeCount} active`} size="small" color="primary" sx={{ fontWeight: 700 }} />
                    )}
                </Box>
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 3, pt: 3 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {fields.map(field => {
                        const val = localValues[field.field];
                        switch (field.type) {
                            case 'text':
                                return (
                                    <TextField
                                        key={field.field}
                                        id={`${id}-${field.field}`}
                                        label={field.label}
                                        size="small"
                                        fullWidth
                                        value={val || ''}
                                        onChange={e => handleChange(field.field, e.target.value)}
                                        placeholder={`Search ${field.label.toLowerCase()}...`}
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />
                                );
                            case 'select':
                                return (
                                    <FormControl key={field.field} size="small" fullWidth>
                                        <InputLabel id={`${id}-${field.field}-label`}>{field.label}</InputLabel>
                                        <Select
                                            labelId={`${id}-${field.field}-label`}
                                            id={`${id}-${field.field}`}
                                            value={val || ''}
                                            label={field.label}
                                            onChange={e => handleChange(field.field, e.target.value as string)}
                                            sx={{ borderRadius: 2 }}
                                        >
                                            <MenuItem value="">
                                                <em>All</em>
                                            </MenuItem>
                                            {field.options?.map(opt => (
                                                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                );
                            case 'number':
                                return (
                                    <TextField
                                        key={field.field}
                                        id={`${id}-${field.field}`}
                                        label={field.label}
                                        size="small"
                                        type="number"
                                        fullWidth
                                        value={val ?? ''}
                                        onChange={e => handleChange(field.field, e.target.value ? Number(e.target.value) : '')}
                                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                    />
                                );
                            case 'boolean':
                                return (
                                    <FormControlLabel
                                        key={field.field}
                                        control={
                                            <Switch
                                                checked={Boolean(val)}
                                                onChange={e => handleChange(field.field, e.target.checked)}
                                            />
                                        }
                                        label={field.label}
                                    />
                                );
                            default:
                                return null;
                        }
                    })}
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 3, pt: 1, gap: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
                <Button onClick={handleClear} disabled={activeCount === 0}
                    sx={{ textTransform: 'none', borderRadius: 2, color: '#ef4444' }}
                >
                    Clear All
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button onClick={onClose} sx={{ textTransform: 'none', borderRadius: 2 }}>Cancel</Button>
                <Button variant="contained" onClick={handleApply}
                    sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 700, px: 3, boxShadow: 'none' }}
                >
                    Apply Filters
                </Button>
            </DialogActions>
        </Dialog>
    );
}
