'use client';

import { useState, useEffect } from 'react';
import {
    Box, Typography, Tabs, Tab, CircularProgress, Alert
} from '@mui/material';
import GlobalConfigTab from './components/GlobalConfigTab';
import AppearanceTab from './components/AppearanceTab';
import AdminsTab from './components/AdminsTab';
import type { AppSettings } from '@/types';

function TabPanel(props: { children?: React.ReactNode; index: number; value: number }) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`settings-tabpanel-${index}`}
            {...other}
            style={{ width: '100%', outline: 'none' }}
        >
            {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
        </div>
    );
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState(0);
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/settings');
            const data = await res.json();
            if (data.success) {
                setSettings(data.data);
            } else {
                setError(data.error || 'Failed to load settings');
            }
        } catch (err) {
            setError('An error occurred while loading settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !settings) {
        return <Alert severity="error">{error || 'Failed to load settings'}</Alert>;
    }

    return (
        <Box sx={{ maxWidth: 1000, mx: 'auto', width: '100%' }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={800} sx={{ color: '#1e293b', mb: 1 }}>
                    Platform Settings
                </Typography>
                <Typography variant="body1" sx={{ color: '#64748b' }}>
                    Configure global application settings, appearance, and manage admin users.
                </Typography>
            </Box>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'white', px: 2, pt: 2, borderRadius: '12px 12px 0 0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
                <Tabs
                    value={activeTab}
                    onChange={handleTabChange}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        '& .MuiTab-root': { fontWeight: 600, textTransform: 'none', fontSize: '0.95rem' },
                        '& .Mui-selected': { color: 'var(--brand-main) !important' },
                        '& .MuiTabs-indicator': { backgroundColor: 'var(--brand-main)' }
                    }}
                >
                    <Tab label="Global Config" />
                    <Tab label="Appearance" />
                    <Tab label="Admin Users" />
                </Tabs>
            </Box>

            <Box sx={{ bgcolor: 'white', p: 3, borderRadius: '0 0 12px 12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
                <TabPanel value={activeTab} index={0}>
                    <GlobalConfigTab settings={settings} onUpdate={fetchSettings} />
                </TabPanel>

                <TabPanel value={activeTab} index={1}>
                    <AppearanceTab settings={settings} onUpdate={fetchSettings} />
                </TabPanel>

                <TabPanel value={activeTab} index={2}>
                    <AdminsTab />
                </TabPanel>
            </Box>
        </Box>
    );
}
