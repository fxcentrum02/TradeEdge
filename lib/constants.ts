// ===========================================
// APPLICATION CONSTANTS
// ===========================================

// Referral Commission Structure (ROI-Based)
export const REFERRAL_COMMISSIONS = {
    MAX_TIER: 20,
    // ROI-based percentages for each tier (1 to 20)
    // 20, 15, 10, 5, 5, 4, 4, 3, 3, 2, 2, 1.5, 1.5, 1, 1.5, 1.5, 2, 2, 3, 3
    TIER_PERCENTAGES: [
        20, 15, 10, 5, 5, 
        4, 4, 3, 3, 2, 
        2, 1.5, 1.5, 1, 1.5, 
        1.5, 2, 2, 3, 3
    ],
    // Investment required per tier to unlock (Total of Personal + Direct Downlines)
    INVESTMENT_TO_UNLOCK_PER_TIER: 100, 
    MIN_CLAIM_AMOUNT: 10,
} as const;

/**
 * Get the referral commission percentage for a specific tier.
 */
export function getTierCommissionPercentage(tier: number): number {
    if (tier < 1 || tier > REFERRAL_COMMISSIONS.MAX_TIER) return 0;
    return REFERRAL_COMMISSIONS.TIER_PERCENTAGES[tier - 1] || 0;
}

// Calculate daily ROI
export function calculateDailyRoi(planAmount: number, dailyRoiPercentage: number): number {
    return (planAmount * dailyRoiPercentage) / 100;
}

// Plan Configuration
export const PLAN_CONFIG = {
    DEFAULT_DURATION_DAYS: 30,
    MIN_INVESTMENT: 50, // Minimum 50 USDT for any MP purchase, reinvest, or withdrawal
} as const;

// Withdrawal Configuration
export const WITHDRAWAL_CONFIG = {
    MIN_AMOUNT: 50,
    MAX_AMOUNT: 10000,
    FEE_PERCENTAGE: 2,
    MIN_FEE: 1,
    DEFAULT_NETWORK: 'BEP20',
} as const;

// Session Configuration
export const SESSION_CONFIG = {
    COOKIE_NAME: 'tg_session',
    MAX_AGE_DAYS: 7,
} as const;

// API Pagination
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
} as const;

// Payment Ticket
export const PAYMENT_CONFIG = {
    BEP20_ADDRESS: process.env.PAYMENT_BEP20_ADDRESS || '',
} as const;

// Generate Telegram start link
export function getTelegramStartLink(referralCode: string): string {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'your_bot';
    return `https://t.me/${botUsername}?start=${referralCode}`;
}
