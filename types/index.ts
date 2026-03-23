// ===========================================
// USER TYPES
// ===========================================

export interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
    is_premium?: boolean;
}

export interface User {
    id: string;
    telegramId: string;
    telegramUsername: string | null;
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
    referralCode: string;
    referredById: string | null;
    directReferralCount: number;
    totalReferralCount: number; // 20 tiers sum
    totalDownlineCount: number; // Unlimited tiers sum
    totalEarnings: number;
    tradePower: number;
    isAdmin: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserDashboard extends User {
    walletBalance: number;
    activePlans: number;
    pendingWithdrawals: number;
}

// ===========================================
// REFERRAL TYPES
// ===========================================

export interface ReferralTier {
    tier: number;           // 1-20
    userCount: number;      // Users at this tier
    activeUserCount: number; // Users with at least one active plan
    totalInvested: number;  // Total active investment from this tier
    totalEarnings: number;  // Total earned from this tier
    isUnlocked: boolean;    // Whether this tier is unlocked for the user
}

export interface TierInsight {
    tier: number;
    totalEarnings: number;
    userCount: number;
}

export interface DirectReferral {
    id: string;
    telegramUsername: string | null;
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
    joinedAt: Date;
    isActive: boolean;
    planCount: number;
    tradePower: number;     // Active investment from this user
    totalInvested: number;  // Lifetime investment from this user
    earnings: number;       // Earnings from this user
}

export interface ReferralStats {
    referralCode: string;
    referralLink: string;
    telegramLink: string;
    tiers: ReferralTier[];
    directReferrals: DirectReferral[];
    totalReferrals: number;     // Direct referrals count
    totalDownlineCount: number; // All levels count
    totalDownlineTradePower: number; // Total active investment of entire downline
    tier20TotalCount: number;   // Sum of user counts in 20 tiers
    totalEarnings: number;
    referralWalletBalance: number;
    totalClaimed: number;
    referralClaimMultiplier: number;
    tradePower: number;
    minReferralWithdrawalAmount: number;
}

// ===========================================
// PLAN TYPES
// ===========================================

export interface Plan {
    id: string;
    name: string;
    description: string | null;
    minAmount: number;     // Range minimum (inclusive)
    maxAmount: number | null; // Range maximum (exclusive). Null = unlimited.
    dailyRoi: number;     // Daily ROI % (e.g. 5.5 = 5.5%/day)
    duration: number;     // days (default: 30)
    isActive: boolean;
    sortOrder: number;
}

export interface UserPlan {
    id: string;
    userId: string;
    planId: string;
    amount: number;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
    paymentTxHash: string | null;
    plan?: Plan;
}

export interface PlanSubscriptionRequest {
    amount: number;        // USDT amount user wants to invest
    transactionId: string; // User-provided TX hash as proof
}

export type PaymentTicketStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface PaymentTicket {
    id: string;
    userId: string;
    planId: string;
    amount: number;
    paymentAddress: string;
    transactionId: string;
    status: PaymentTicketStatus;
    adminNote: string | null;
    userPlanId: string | null;
    createdAt: Date;
    updatedAt: Date;
    plan?: Plan;
}

// ===========================================
// WALLET TYPES
// ===========================================

export interface Wallet {
    id: string;
    userId: string;
    balance: number;
}

export type TransactionType =
    | 'DEPOSIT'
    | 'PLAN_PURCHASE'
    | 'REFERRAL_EARNING'
    | 'REFERRAL_TRANSFER'
    | 'ROI_EARNING'
    | 'REINVEST'
    | 'WITHDRAWAL'
    | 'WITHDRAWAL_FEE'
    | 'ADMIN_CREDIT'
    | 'ADMIN_DEBIT';

export interface Transaction {
    id: string;
    userId: string;
    type: TransactionType;
    amount: number;
    balanceAfter: number;
    description: string | null;
    reference: string | null;
    createdAt: Date;
}

export interface WalletSummary {
    balance: number;
    referralWalletBalance: number;
    totalEarnings: number;
    totalReferralEarnings: number;
    totalRoiEarnings: number;
    totalWithdrawals: number;
    pendingWithdrawals: number;
    withdrawalSettings?: {
        minWithdrawalAmount: number;
        withdrawalFeeType: 'PERCENTAGE' | 'FIXED';
        withdrawalFeeValue: number;
        lastWithdrawalAddress?: string;
        lastWithdrawalAt?: Date | string | null;
    };
}

export interface ReferralWallet {
    id: string;
    userId: string;
    balance: number;
}

// ===========================================
// WITHDRAWAL TYPES
// ===========================================

export type WithdrawalStatus =
    | 'PENDING'
    | 'PROCESSING'
    | 'COMPLETED'
    | 'REJECTED'
    | 'FAILED';

export interface Withdrawal {
    id: string;
    userId: string;
    amount: number;
    fee: number;
    netAmount: number;
    walletAddress: string;
    network: string;
    status: WithdrawalStatus;
    adminNote: string | null;
    txHash: string | null;
    processedAt: Date | null;
    createdAt: Date;
}

export interface WithdrawalRequest {
    amount: number;
    walletAddress: string;
    network?: string;
}

// ===========================================
// API TYPES
// ===========================================

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
}

export interface AdminSessionPayload {
    adminId: string;
    email: string;
    role: string;
    exp?: number;
}

// ===========================================
// ADMIN TYPES
// ===========================================

export interface Admin {
    id: string;
    email: string;
    passwordHash: string;
    name: string;
    role: 'admin' | 'superadmin';
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface AdminDashboard {
    totalUsers: number;
    activeUsers: number;
    totalPlans: number;
    totalInvested: number;
    totalEarnings: number;
    totalWithdrawals: number;
    pendingWithdrawals: number;
    todayNewUsers: number;
    todaySubscriptions: number;
}

export interface AdminUserView extends User {
    walletBalance: number;
    activePlanCount: number;
    totalInvestment: number;
    referralTree?: DirectReferral[];
}

// ===========================================
// SETTINGS TYPES
// ===========================================

export interface AppSettings {
    _id?: any;
    // Appearance
    appName: string;
    brandColor: string;

    // Global Config
    minWithdrawalAmount: number;
    minReferralWithdrawalAmount: number;
    withdrawalFeeType: 'PERCENTAGE' | 'FIXED';
    withdrawalFeeValue: number;
    withdrawalFeePercentage?: number; // Deprecated but kept for safety during migration
    defaultPlanDurationDays: number;
    tier1ReferralPercentage: number;
    maintenanceMode: boolean;

    // Payment Settings
    receivingAddress?: string;
    qrCodeUrl?: string;

    // Referral Settings
    referralClaimMultiplier: number;

    updatedAt: Date;
}

// ===========================================
// REPORTS & ANALYTICS
// ===========================================

export interface HierarchyLevelStat {
    tier: number;
    count: number;
    totalTradePower: number;
}

export interface HierarchyTreeNode {
    id: string;
    telegramId: string;
    telegramUsername: string | null;
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
    tradePower: number;
    directReferralCount: number;
    totalReferralCount: number;
    joinedAt: string;
    children?: HierarchyTreeNode[];
}

