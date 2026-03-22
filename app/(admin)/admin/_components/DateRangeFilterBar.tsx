'use client';

import React, { useState, useEffect, useId } from 'react';
import {
    Box, Stack, Paper, Chip, TextField, InputAdornment, IconButton, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ClearIcon from '@mui/icons-material/Clear';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { DatePickerWrapper } from './DatePickerStyles';

interface DateRangeFilterBarProps {
    startDate: string;
    endDate: string;
    onChange: (start: string, end: string) => void;
}

const timeSlots = [
    {
        label: 'Today',
        getValue: () => {
            const d = new Date().toISOString().split('T')[0];
            return [d, d];
        },
    },
    {
        label: 'Yesterday',
        getValue: () => {
            const d = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            return [d, d];
        },
    },
    {
        label: 'Last 7 Days',
        getValue: () => {
            const end = new Date().toISOString().split('T')[0];
            const start = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
            return [start, end];
        },
    },
    {
        label: 'This Month',
        getValue: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            const end = now.toISOString().split('T')[0];
            return [start, end];
        },
    },
    {
        label: 'Last 30 Days',
        getValue: () => {
            const end = new Date().toISOString().split('T')[0];
            const start = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
            return [start, end];
        },
    },
];

export default function DateRangeFilterBar({ startDate, endDate, onChange }: DateRangeFilterBarProps) {
    const id = useId();
    const [range, setRange] = useState<[Date | null, Date | null]>([
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
    ]);

    useEffect(() => {
        setRange([
            startDate ? new Date(startDate) : null,
            endDate ? new Date(endDate) : null,
        ]);
    }, [startDate, endDate]);

    const handleSlotClick = (getValue: () => string[]) => {
        const [s, e] = getValue();
        if (s === startDate && e === endDate) {
            onChange('', '');
        } else {
            onChange(s, e);
        }
    };

    const handleDateRangeChange = (dates: [Date | null, Date | null]) => {
        const [start, end] = dates;
        setRange([start, end]);
        if (start && end) {
            onChange(
                start.toISOString().split('T')[0],
                end.toISOString().split('T')[0]
            );
        }
    };

    return (
        <Paper
            elevation={0}
            sx={{
                p: 2,
                mb: 3,
                borderRadius: 3,
                bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
                backdropFilter: 'blur(12px)',
                border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.08)}`,
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}
        >
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
            >
                {/* Preset Chips */}
                <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: { xs: 1, md: 0 }, flexWrap: 'wrap', gap: 1 }}>
                    {timeSlots.map((slot) => {
                        const [slotStart, slotEnd] = slot.getValue();
                        const isActive = slotStart === startDate && slotEnd === endDate;
                        return (
                            <Chip
                                key={slot.label}
                                label={slot.label}
                                onClick={() => handleSlotClick(slot.getValue)}
                                color={isActive ? 'primary' : 'default'}
                                variant={isActive ? 'filled' : 'outlined'}
                                sx={{
                                    fontWeight: isActive ? 600 : 400,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    '&:hover': {
                                        bgcolor: isActive ? 'primary.main' : alpha('#2196F3', 0.1),
                                    },
                                }}
                            />
                        );
                    })}
                </Stack>

                {/* Custom Date Range */}
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, display: { xs: 'none', sm: 'block' } }}>
                        Select Date:
                    </Typography>
                    <DatePickerWrapper>
                        <DatePicker
                            selectsRange
                            startDate={range[0] ?? undefined}
                            endDate={range[1] ?? undefined}
                            onChange={handleDateRangeChange}
                            dateFormat="dd/MM/yyyy"
                            maxDate={new Date()}
                            customInput={
                                <TextField
                                    id={id}
                                    size="small"
                                    placeholder="Click to select range"
                                    sx={{
                                        minWidth: { xs: '100%', sm: 180, md: 200 },
                                        '& .MuiOutlinedInput-root': { borderRadius: 2 },
                                        '& .MuiInputBase-input': { pr: '0 !important' },
                                    }}
                                    slotProps={{
                                        input: {
                                            readOnly: true,
                                            endAdornment: (
                                                <InputAdornment position="end" sx={{ ml: 0.5 }}>
                                                    {(startDate || endDate) && (
                                                        <IconButton
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onChange('', '');
                                                            }}
                                                            sx={{ mr: 0.5, color: 'error.light' }}
                                                        >
                                                            <ClearIcon sx={{ fontSize: 16 }} />
                                                        </IconButton>
                                                    )}
                                                    <IconButton size="small" edge="end">
                                                        <CalendarMonthIcon sx={{ color: 'text.secondary', fontSize: 18 }} />
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        },
                                        inputLabel: { shrink: true },
                                    }}
                                    autoComplete="off"
                                />
                            }
                        />
                    </DatePickerWrapper>
                </Stack>
            </Stack>
        </Paper>
    );
}
