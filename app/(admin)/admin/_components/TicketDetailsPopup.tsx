'use client';

import React, { useState, useId } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
    Button, Chip, Divider, IconButton, Stack, Avatar, Card, CardContent,
    TextField, Alert, Grid, Paper, Tooltip, Zoom,
    RadioGroup, Radio, FormControlLabel, FormControl, FormLabel
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PersonIcon from '@mui/icons-material/Person';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import LinkIcon from '@mui/icons-material/Link';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import InfoIcon from '@mui/icons-material/Info';
import { formatCurrency, formatDateTime } from '@/lib/utils';

// Styles for statuses
const STATUS_STYLES: Record<string, { bgcolor: string; color: string; label: string; icon: React.ReactNode }> = {
    PENDING: {
        bgcolor: '#fef3c7', color: '#d97706', label: 'Pending Review',
        icon: <InfoIcon sx={{ fontSize: 16 }} />
    },
    PROCESSING: {
        bgcolor: '#dbeafe', color: '#2563eb', label: 'Processing',
        icon: <InfoIcon sx={{ fontSize: 16 }} />
    },
    APPROVED: {
        bgcolor: '#dcfce7', color: '#16a34a', label: 'Approved',
        icon: <CheckCircleIcon sx={{ fontSize: 16 }} />
    },
    COMPLETED: {
        bgcolor: '#dcfce7', color: '#16a34a', label: 'Completed',
        icon: <CheckCircleIcon sx={{ fontSize: 16 }} />
    },
    REJECTED: {
        bgcolor: '#fee2e2', color: '#dc2626', label: 'Rejected',
        icon: <ErrorIcon sx={{ fontSize: 16 }} />
    },
    FAILED: {
        bgcolor: '#fce7f3', color: '#db2777', label: 'Failed',
        icon: <ErrorIcon sx={{ fontSize: 16 }} />
    },
};

interface TicketDetailsPopupProps {
    open: boolean;
    onClose: () => void;
    ticket: any; // Can be Deposit Ticket or Withdrawal Request
    type: 'deposit' | 'withdrawal';
    onApprove: (id: string, adminNote: string, txHash?: string, backdateRoi?: boolean) => Promise<void>;
    onReject: (id: string, adminNote: string) => Promise<void>;
}

export default function TicketDetailsPopup({
    open, onClose, ticket, type, onApprove, onReject
}: TicketDetailsPopupProps) {
    const id = useId();
    const [adminNote, setAdminNote] = useState(ticket?.adminNote || '');
    const [txHash, setTxHash] = useState(ticket?.txHash || '');
    const [backdateRoi, setBackdateRoi] = useState<'today' | 'backdate'>('today');
    const [submitting, setSubmitting] = useState(false);
    const [copySuccess, setCopySuccess] = useState<string | null>(null);

    if (!ticket) return null;

    const statusStyle = STATUS_STYLES[ticket.status] || STATUS_STYLES.PENDING;
    const isPending = ticket.status === 'PENDING';

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        setCopySuccess(label);
        setTimeout(() => setCopySuccess(null), 2000);
    };

    const handleAction = async (action: 'approve' | 'reject') => {
        if (type === 'withdrawal' && action === 'approve' && !txHash.trim()) {
            return; // Requires txHash for withdrawals
        }

        setSubmitting(true);
        try {
            if (action === 'approve') {
                await onApprove(
                    ticket.id,
                    adminNote,
                    type === 'withdrawal' ? txHash : undefined,
                    type === 'deposit' ? backdateRoi === 'backdate' : undefined
                );
            } else {
                await onReject(ticket.id, adminNote);
            }
            onClose();
        } catch (error) {
            console.error('Action failed:', error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 4,
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
                }
            }}
        >
            <DialogTitle sx={{
                p: 2.5,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                bgcolor: '#f8fafc',
                borderBottom: '1px solid #f1f5f9'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{
                        width: 40, height: 40, bgcolor: type === 'deposit' ? '#10b981' : '#3b82f6',
                        borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                    }}>
                        {type === 'deposit' ? <AccountBalanceWalletIcon /> : <LinkIcon />}
                    </Box>
                    <Box>
                        <Typography variant="subtitle2" fontWeight={800} sx={{ color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {type} Ticket
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8', fontFamily: 'monospace' }}>
                            ID: {ticket.id}
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                        icon={statusStyle.icon as any}
                        label={statusStyle.label}
                        size="small"
                        sx={{
                            bgcolor: statusStyle.bgcolor,
                            color: statusStyle.color,
                            fontWeight: 750,
                            borderRadius: 1.5,
                            border: `1px solid ${statusStyle.color}40`
                        }}
                    />
                    <IconButton onClick={onClose} size="small" sx={{ color: '#94a3b8' }}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ p: 3 }}>
                <Stack spacing={3}>
                    {/* Amount Card */}
                    <Paper elevation={0} sx={{
                        p: 3,
                        borderRadius: 3,
                        bgcolor: type === 'deposit' ? '#ecfdf5' : '#eff6ff',
                        border: `1px solid ${type === 'deposit' ? '#d1fae5' : '#dbeafe'}`,
                        textAlign: 'center'
                    }}>
                        <Typography variant="caption" sx={{ color: type === 'deposit' ? '#059669' : '#2563eb', fontWeight: 700, textTransform: 'uppercase' }}>
                            {type === 'deposit' ? 'Investment Amount' : 'Net Withdrawal Amount'}
                        </Typography>
                        <Typography variant="h3" fontWeight={900} sx={{ color: type === 'deposit' ? '#065f46' : '#1e40af', my: 1 }}>
                            {formatCurrency(type === 'deposit' ? ticket.amount : (ticket.netAmount || ticket.amount))}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            USDT (BEP20 Network)
                        </Typography>
                        {type === 'withdrawal' && ticket.fee > 0 && (
                            <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#64748b' }}>
                                (Gross: {formatCurrency(ticket.amount)} | Fee: {formatCurrency(ticket.fee)})
                            </Typography>
                        )}
                    </Paper>

                    {/* User & Request Info */}
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#8b5cf6', fontSize: 14 }}>
                                        {ticket.userName?.[0] || <PersonIcon fontSize="small" />}
                                    </Avatar>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>User</Typography>
                                        <Typography variant="body2" fontWeight={700}>{ticket.userName || 'Unknown'}</Typography>
                                    </Box>
                                </Stack>
                            </Box>
                        </Grid>
                        <Grid size={{ xs: 6 }}>
                            <Box sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #f1f5f9' }}>
                                <Stack direction="row" spacing={1.5} alignItems="center">
                                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#f43f5e', fontSize: 14 }}>
                                        <CalendarMonthIcon fontSize="inherit" />
                                    </Avatar>
                                    <Box>
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>Date</Typography>
                                        <Typography variant="body2" fontWeight={700}>{formatDateTime(ticket.createdAt)}</Typography>
                                    </Box>
                                </Stack>
                            </Box>
                        </Grid>
                    </Grid>

                    {/* Transaction Identity */}
                    <Box>
                        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5, color: '#475569', display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinkIcon sx={{ fontSize: 18 }} /> Transaction Details
                        </Typography>

                        <Stack spacing={2}>
                            {/* TX ID / Proof */}
                            <Box>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                                    {type === 'deposit' ? 'Transaction Hash (Proof)' : 'User Wallet Address'}
                                </Typography>
                                <Box sx={{
                                    p: 1.5, borderRadius: 2, bgcolor: '#f1f5f9', border: '1px dashed #cbd5e1',
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                                }}>
                                    <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', color: '#1e293b' }}>
                                        {type === 'deposit' ? ticket.transactionId : ticket.walletAddress}
                                    </Typography>
                                    <Tooltip title={copySuccess === 'tx' ? 'Copied!' : 'Copy'} TransitionComponent={Zoom} arrow>
                                        <IconButton size="small" onClick={() => handleCopy(type === 'deposit' ? ticket.transactionId : ticket.walletAddress, 'tx')}>
                                            <ContentCopyIcon sx={{ fontSize: 16 }} />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Box>

                            {type === 'deposit' && ticket.planName && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Purchasing Plan</Typography>
                                    <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
                                        {ticket.planName} {ticket.planDailyRoi ? `(${ticket.planDailyRoi}% ROI)` : ''}
                                    </Typography>
                                </Box>
                            )}

                            {type === 'withdrawal' && (
                                <Box>
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Network</Typography>
                                    <Chip label={ticket.network || 'BEP20'} size="small" sx={{ fontWeight: 700 }} />
                                </Box>
                            )}
                        </Stack>
                    </Box>

                    {/* Plan Start Option – only for pending deposit tickets */}
                    {isPending && type === 'deposit' && (() => {
                        const submittedDate = new Date(ticket.createdAt);
                        const now = new Date();
                        const daysSince = Math.floor((now.getTime() - submittedDate.getTime()) / (1000 * 60 * 60 * 24));
                        return daysSince > 0 ? (
                            <Box sx={{ pt: 1 }}>
                                <FormControl component="fieldset" fullWidth>
                                    <FormLabel component="legend" sx={{ fontWeight: 800, fontSize: '0.82rem', color: '#475569', mb: 1 }}>
                                        Plan Start Option
                                    </FormLabel>
                                    <Alert severity="info" sx={{ borderRadius: 2, mb: 1.5, py: 0.5 }}>
                                        Submitted <strong>{daysSince} day{daysSince > 1 ? 's' : ''} ago</strong>. Choose how to activate this plan:
                                    </Alert>
                                    <RadioGroup
                                        value={backdateRoi}
                                        onChange={(e) => setBackdateRoi(e.target.value as 'today' | 'backdate')}
                                    >
                                        <FormControlLabel
                                            value="today"
                                            control={<Radio size="small" />}
                                            label={
                                                <Box>
                                                    <Typography variant="body2" fontWeight={700}>Start from today</Typography>
                                                    <Typography variant="caption" color="text.secondary">Plan runs for full duration from now. No missed ROI credited.</Typography>
                                                </Box>
                                            }
                                        />
                                        <FormControlLabel
                                            value="backdate"
                                            control={<Radio size="small" />}
                                            label={
                                                <Box>
                                                    <Typography variant="body2" fontWeight={700}>Credit missed ROI ({daysSince} day{daysSince > 1 ? 's' : ''})</Typography>
                                                    <Typography variant="caption" color="text.secondary">Immediately credits {daysSince} day{daysSince > 1 ? 's' : ''} of earned ROI. Plan runs from submission date.</Typography>
                                                </Box>
                                            }
                                        />
                                    </RadioGroup>
                                </FormControl>
                            </Box>
                        ) : null;
                    })()}

                    {/* Admin Actions / Notes */}
                    <Box sx={{ pt: 1 }}>
                        <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5, color: '#475569' }}>
                            Review & Notes
                        </Typography>

                        {isPending && type === 'withdrawal' && (
                            <Box sx={{ mb: 3 }}>
                                <Alert severity="warning" sx={{ borderRadius: 2, mb: 2 }}>
                                    Please verify payment on-chain and paste the TX Hash below before approving.
                                </Alert>
                                <TextField
                                    id={`${id}-txHash`}
                                    fullWidth
                                    size="small"
                                    label="Payout TX Hash (Required)"
                                    value={txHash}
                                    onChange={(e) => setTxHash(e.target.value)}
                                    placeholder="0x..."
                                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                                />
                            </Box>
                        )}

                        <TextField
                            id={`${id}-adminNote`}
                            fullWidth
                            multiline
                            rows={2}
                            label={isPending ? "Internal Note (Optional)" : "Admin Note"}
                            value={adminNote}
                            onChange={(e) => setAdminNote(e.target.value)}
                            disabled={!isPending}
                            placeholder={isPending ? "Enter rejection reason or internal comments..." : "No notes found"}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                        />
                    </Box>
                </Stack>
            </DialogContent>

            <Divider />

            <DialogActions sx={{ p: 2.5, bgcolor: '#f8fafc', gap: 1.5 }}>
                <Button
                    onClick={onClose}
                    sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, color: '#64748b' }}
                >
                    Close
                </Button>

                {isPending && (
                    <>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={() => handleAction('reject')}
                            disabled={submitting}
                            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 700, px: 3 }}
                        >
                            Reject Request
                        </Button>
                        <Button
                            variant="contained"
                            onClick={() => handleAction('approve')}
                            disabled={submitting || (type === 'withdrawal' && !txHash.trim())}
                            sx={{
                                textTransform: 'none', borderRadius: 2, fontWeight: 700, px: 4,
                                bgcolor: type === 'deposit' ? '#10b981' : '#3b82f6',
                                '&:hover': { bgcolor: type === 'deposit' ? '#059669' : '#1d4ed8' },
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)'
                            }}
                        >
                            {submitting ? 'Processing...' : type === 'deposit' ? 'Confirm & Activate' : 'Confirm Payout'}
                        </Button>
                    </>
                )}
            </DialogActions>
        </Dialog>
    );
}
