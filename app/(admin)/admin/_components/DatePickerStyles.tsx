'use client';

import React from 'react';
import { Box, GlobalStyles, useTheme } from '@mui/material';

export const getDatePickerGlobalStyles = (theme: any) => ({
    '.react-datepicker-popper': {
        zIndex: '1500 !important',
    },
    '.react-datepicker': {
        fontFamily: theme.typography.fontFamily,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: '12px !important',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        overflow: 'hidden',
    },
    '.react-datepicker__header': {
        backgroundColor: '#f8fafc',
        borderBottom: `1px solid ${theme.palette.divider}`,
        padding: '12px 0 8px',
    },
    '.react-datepicker__current-month': {
        fontWeight: 700,
        fontSize: '0.95rem',
        color: theme.palette.text.primary,
    },
    '.react-datepicker__day-name': {
        color: theme.palette.text.secondary,
        fontWeight: 600,
        fontSize: '0.75rem',
    },
    '.react-datepicker__day': {
        borderRadius: '8px',
        '&:hover': {
            borderRadius: '8px',
            backgroundColor: `${theme.palette.primary.main}18`,
        },
    },
    '.react-datepicker__day--selected, .react-datepicker__day--in-range': {
        backgroundColor: `${theme.palette.primary.main} !important`,
        color: '#fff !important',
        borderRadius: '8px',
        fontWeight: 600,
    },
    '.react-datepicker__day--in-selecting-range': {
        backgroundColor: `${theme.palette.primary.main}40 !important`,
        borderRadius: '8px',
    },
    '.react-datepicker__day--keyboard-selected': {
        backgroundColor: `${theme.palette.primary.main}30`,
        borderRadius: '8px',
    },
    '.react-datepicker__navigation': {
        top: '10px',
    },
});

interface DatePickerWrapperProps {
    children: React.ReactNode;
}

export function DatePickerWrapper({ children, ...props }: DatePickerWrapperProps & Record<string, any>) {
    const theme = useTheme();
    return (
        <Box {...props}>
            <GlobalStyles styles={getDatePickerGlobalStyles(theme)} />
            {children}
        </Box>
    );
}

export default DatePickerWrapper;
