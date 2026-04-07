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
    MIN_AMOUNT: 10,
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

// ===========================================
// REFERRAL MILESTONE BONUS STRUCTURE
// ===========================================
// Each milestone is checked independently using the 40/30/30 rule:
//   Leg A (top direct referral)   >= 40% of threshold
//   Leg B (2nd direct referral)   >= 30% of threshold
//   Leg C (all remaining combined)>= 30% of threshold
// "Leg volume" = direct referral's own tradePower + all their downline tradePower

export const MILESTONE_BONUSES = [
    { threshold: 5_000,      reward: 150     },
    { threshold: 10_000,     reward: 250     },
    { threshold: 20_000,     reward: 500     },
    { threshold: 50_000,     reward: 1_250   },
    { threshold: 100_000,    reward: 2_500   },
    { threshold: 200_000,    reward: 5_000   },
    { threshold: 300_000,    reward: 12_500  },
    { threshold: 1_000_000,  reward: 25_000  },
    { threshold: 2_000_000,  reward: 50_000  },
    { threshold: 5_000_000,  reward: 125_000 },
    { threshold: 10_000_000, reward: 250_000 },
] as const;

export const MILESTONE_SPLIT = {
    LEG_A_PCT: 0.40,
    LEG_B_PCT: 0.30,
    LEG_C_PCT: 0.30,
} as const;

// Generate Telegram start link
export function getTelegramStartLink(referralCode: string): string {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'your_bot';
    return `https://t.me/${botUsername}?start=${referralCode}`;
}
