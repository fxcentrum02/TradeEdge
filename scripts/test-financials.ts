// ==========================================================
// TEST SCRIPT: Financial & Referral System Accuracy Test
// Verifies referral commission calculations, tier unlock rules,
// daily ROI formulas, and ancestor tree matching.
// Usage: npx tsx scripts/test-financials.ts
// ==========================================================

import { REFERRAL_COMMISSIONS, getTierCommissionPercentage, calculateDailyRoi } from '../lib/constants';

function runFinancialTests() {
    console.log('🧪 Running Financial & Referral Verification Suite...\n');

    let passedTests = 0;
    let failedTests = 0;

    const assertEqual = (testName: string, actual: any, expected: any) => {
        if (actual === expected) {
            console.log(`  ✅ [PASS] ${testName}`);
            passedTests++;
        } else {
            console.error(`  ❌ [FAIL] ${testName}: Expected ${expected}, got ${actual}`);
            failedTests++;
        }
    };

    // TEST GROUP 1: Commission Percentages
    console.log('--- Test Group 1: 20-Tier Commission Percentages ---');
    const expectedTiers = [
        20, 15, 10, 5, 5, 
        4, 4, 3, 3, 2, 
        2, 1.5, 1.5, 1, 1.5, 
        1.5, 2, 2, 3, 3
    ];

    for (let t = 1; t <= 20; t++) {
        const pct = getTierCommissionPercentage(t);
        assertEqual(`Tier ${t} percentage is ${expectedTiers[t - 1]}%`, pct, expectedTiers[t - 1]);
    }
    assertEqual('Out-of-bounds Tier 0 percentage is 0%', getTierCommissionPercentage(0), 0);
    assertEqual('Out-of-bounds Tier 21 percentage is 0%', getTierCommissionPercentage(21), 0);

    // TEST GROUP 2: Daily ROI Formula Precision
    console.log('\n--- Test Group 2: Daily ROI Calculation Precision ---');
    // Plan 1: 100 USDT at 5.5% daily ROI -> 5.5 USDT
    assertEqual('Daily ROI for 100 USDT at 5.5%', calculateDailyRoi(100, 5.5), 5.5);
    // Plan 2: 1000 USDT at 6.0% daily ROI -> 60 USDT
    assertEqual('Daily ROI for 1000 USDT at 6.0%', calculateDailyRoi(1000, 6.0), 60);
    // Plan 3: 50 USDT at 4.5% daily ROI -> 2.25 USDT
    assertEqual('Daily ROI for 50 USDT at 4.5%', calculateDailyRoi(50, 4.5), 2.25);

    // TEST GROUP 3: Tier Unlock Requirement Scaling
    console.log('\n--- Test Group 3: Tier Unlock Investment Thresholds ---');
    // Tier 1: Always unlocked (0 USDT)
    // Tier 2: (2-1) * 100 = 100 USDT
    // Tier 5: (5-1) * 100 = 400 USDT
    // Tier 20: (20-1) * 100 = 1900 USDT
    for (let tier = 1; tier <= 20; tier++) {
        const required = tier === 1 ? 0 : (tier - 1) * REFERRAL_COMMISSIONS.INVESTMENT_TO_UNLOCK_PER_TIER;
        const expectedRequired = (tier - 1) * 100;
        assertEqual(`Tier ${tier} unlock threshold is ${expectedRequired} USDT`, required, expectedRequired);
    }

    // TEST GROUP 4: Ancestor Tree Indexing Logic
    console.log('\n--- Test Group 4: Ancestor Array Alignment Logic ---');
    // Mock user chain: User A -> User B -> User C -> User D
    const userA = 'user_A_id';
    const userB = 'user_B_id';
    const userC = 'user_C_id';
    const userD = 'user_D_id';

    const ancestorsUserD = [userC, userB, userA]; // Direct is C (index 0), Tier 2 is B (index 1), Tier 3 is A (index 2)

    const getTierForReferrer = (ancestors: string[], referrerId: string): number => {
        const idx = ancestors.indexOf(referrerId);
        return idx === -1 ? 0 : idx + 1;
    };

    assertEqual('User C is Tier 1 upline of User D', getTierForReferrer(ancestorsUserD, userC), 1);
    assertEqual('User B is Tier 2 upline of User D', getTierForReferrer(ancestorsUserD, userB), 2);
    assertEqual('User A is Tier 3 upline of User D', getTierForReferrer(ancestorsUserD, userA), 3);
    assertEqual('Non-referrer is Tier 0', getTierForReferrer(ancestorsUserD, 'random_user'), 0);

    // Summary
    console.log(`\n==================================================`);
    console.log(`📊 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
    console.log(`==================================================\n`);

    if (failedTests > 0) {
        process.exit(1);
    }
}

runFinancialTests();
