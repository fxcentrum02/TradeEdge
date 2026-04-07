// ===========================================
// MONGODB COLLECTION NAMES
// ===========================================

export const Collections = {
    USERS: 'users',
    WALLETS: 'wallets',
    REFERRAL_WALLETS: 'referral_wallets',
    PLANS: 'plans',
    USER_PLANS: 'user_plans',
    REFERRAL_EARNINGS: 'referral_earnings',
    TRANSACTIONS: 'transactions',
    WITHDRAWALS: 'withdrawals',
    PAYMENT_TICKETS: 'payment_tickets',
    ADMINS: 'admins',
    SETTINGS: 'settings',
    PENDING_REFERRALS: 'pending_referrals',
    MILESTONE_AWARDS: 'milestone_awards',
} as const;

export type CollectionName = typeof Collections[keyof typeof Collections];
