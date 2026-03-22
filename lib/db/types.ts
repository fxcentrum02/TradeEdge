// ===========================================
// MONGODB DOCUMENT TYPE DEFINITIONS
// ===========================================

import { ObjectId } from 'mongodb';

// ===========================================
// USER DOCUMENT
// ===========================================
export interface UserDocument {
    _id: ObjectId;
    telegramId: string;
    telegramUsername?: string;
    firstName?: string;
    lastName?: string;
    photoUrl?: string;
    referralCode: string;
    referredById?: ObjectId | null;
    directReferralCount: number;
    totalReferralCount: number; // 20 tiers sum
    totalDownlineCount: number; // Unlimited tiers sum
    totalEarnings: number;
    tradePower: number;
    lastIp?: string;
    lastWithdrawalAddress?: string;
    lastWithdrawalAt?: Date;
    isAdmin: boolean;
    isActive: boolean;
    isDeleted?: boolean;
    deletedAt?: Date;
    currentSessionId?: string;
    createdAt: Date;
    updatedAt: Date;
}

// ===========================================
// WALLET DOCUMENT
// ===========================================
export interface WalletDocument {
    _id: ObjectId;
    userId: ObjectId;
    balance: number;
    createdAt: Date;
    updatedAt: Date;
}

// ===========================================
// PLAN DOCUMENT
// ===========================================
export interface PlanDocument {
    _id: ObjectId;
    name: string;
    description?: string;
    minAmount: number; // Range: minimum investment (inclusive)
    maxAmount?: number; // Range: maximum investment (exclusive). Null = unlimited.
    dailyRoi: number; // Daily ROI percentage (e.g. 5.5 = 5.5%)
    duration: number; // Days (default: 30)
    isActive: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

// ===========================================
// USER PLAN DOCUMENT
// ===========================================
export interface UserPlanDocument {
    _id: ObjectId;
    userId: ObjectId;
    planId: ObjectId;
    amount: number;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    isReinvest: boolean; // true = funded from wallet, no referral commissions
    paymentTxHash?: string;
    paymentAddress?: string;
    totalRoiPaid: number;
    lastRoiDate?: Date;
    isDeleted?: boolean;
    deletedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// ===========================================
// PAYMENT TICKET DOCUMENT
// ===========================================
export type PaymentTicketStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PaymentTicketDocument {
    _id: ObjectId;
    userId: ObjectId;
    planId: ObjectId; // The matched plan tier ID
    amount: number; // The amount user wants to invest (USDT)
    paymentAddress: string; // Our BEP20 address
    transactionId: string; // User-provided transaction hash/ID
    status: PaymentTicketStatus;
    reviewedBy?: ObjectId;
    reviewedAt?: Date;
    adminNote?: string;
    userPlanId?: ObjectId; // Linked after admin approval
    createdAt: Date;
    updatedAt: Date;
}

// ===========================================
// REFERRAL EARNING DOCUMENT
// ===========================================
export interface ReferralEarningDocument {
    _id: ObjectId;
    userId: ObjectId; // User who earned
    fromUserId: ObjectId; // User whose action triggered earning
    tier: number; // 1-20
    amount: number;
    isFirstPurchaseBonus: boolean; // true = one-time 10 USDT bonus for first >50 purchase
    sourceType: string; // 'plan_activation'
    sourceId: ObjectId; // Reference to UserPlan
    createdAt: Date;
}

// ===========================================
// TRANSACTION DOCUMENT
// ===========================================
export type TransactionType =
    | 'DEPOSIT'
    | 'PLAN_PURCHASE'
    | 'REFERRAL_EARNING'
    | 'REFERRAL_TRANSFER' // referral wallet → main wallet
    | 'ROI_EARNING'
    | 'REINVEST' // wallet → MP (no referral commissions)
    | 'WITHDRAWAL'
    | 'WITHDRAWAL_FEE'
    | 'ADMIN_CREDIT'
    | 'ADMIN_DEBIT';

export interface TransactionDocument {
    _id: ObjectId;
    userId: ObjectId;
    type: TransactionType;
    amount: number; // Positive for credit, negative for debit
    balanceAfter: number;
    description?: string;
    reference?: string; // Related entity ID
    metadata?: any;
    createdAt: Date;
}

// ===========================================
// WITHDRAWAL DOCUMENT
// ===========================================
export type WithdrawalStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED';

export interface WithdrawalDocument {
    _id: ObjectId;
    userId: ObjectId;
    amount: number;
    fee: number;
    netAmount: number;
    walletAddress: string; // User's BEP20 address
    network: string; // 'BEP20'
    status: WithdrawalStatus;
    adminNote?: string;
    txHash?: string; // Admin-provided transaction hash
    processedBy?: ObjectId;
    processedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// ===========================================
// REFERRAL WALLET DOCUMENT
// ===========================================
export interface ReferralWalletDocument {
    _id: ObjectId;
    userId: ObjectId;
    balance: number;
    createdAt: Date;
    updatedAt: Date;
}
