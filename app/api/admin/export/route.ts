import { NextRequest, NextResponse } from 'next/server';
import { getAdminSessionFromRequest } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { Collections } from '@/lib/db/collections';

export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getAdminSessionFromRequest(request);
        if (!session) {
            return new NextResponse('Unauthorized', { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const resource = searchParams.get('resource'); // users, transactions, withdrawals

        if (!resource) {
            return new NextResponse('Resource type required', { status: 400 });
        }

        const db = await getDB();
        let csvContent = '';
        let fileName = `export_${resource}_${new Date().toISOString().split('T')[0]}.csv`;

        if (resource === 'users') {
            const users = await db.collection(Collections.USERS).find({}).toArray();
            csvContent = 'ID,TelegramID,Username,Name,TradePower,TotalEarnings,Referrals,CreatedAt\n';
            csvContent += users.map(u => [
                u._id,
                u.telegramId,
                u.telegramUsername || '',
                ((u.firstName || '') + ' ' + (u.lastName || '')).trim(),
                u.tradePower || 0,
                u.totalEarnings || 0,
                u.directReferralCount || 0,
                u.createdAt.toISOString()
            ].join(',')).join('\n');

        } else if (resource === 'transactions') {
            const txs = await db.collection(Collections.TRANSACTIONS).find({}).sort({ createdAt: -1 }).toArray();
            csvContent = 'ID,UserID,Type,Amount,BalanceAfter,Description,CreatedAt\n';
            csvContent += txs.map(t => [
                t._id,
                t.userId,
                t.type,
                t.amount,
                t.balanceAfter,
                `"${(t.description || '').replace(/"/g, '""')}"`,
                t.createdAt.toISOString()
            ].join(',')).join('\n');

        } else if (resource === 'withdrawals') {
            const withdrawals = await db.collection(Collections.WITHDRAWALS).find({}).sort({ createdAt: -1 }).toArray();
            csvContent = 'ID,UserID,Amount,Fee,NetAmount,Status,Address,TxHash,CreatedAt\n';
            csvContent += withdrawals.map(w => [
                w._id,
                w.userId,
                w.amount,
                w.fee,
                w.netAmount,
                w.status,
                w.walletAddress,
                w.txHash || '',
                w.createdAt.toISOString()
            ].join(',')).join('\n');
        } else {
            return new NextResponse('Invalid resource', { status: 400 });
        }

        return new NextResponse(csvContent, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });

    } catch (error) {
        console.error('[export] error:', error);
        return new NextResponse('Export failed', { status: 500 });
    }
}
