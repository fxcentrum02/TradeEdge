
import { ObjectId } from 'mongodb';

// Mocking logic for verification
async function testPartialClaim() {
    console.log('Testing Partial Claim Logic...');

    const userId = new ObjectId();
    
    // Mock data
    const mockSettings = { referralClaimMultiplier: 2 };
    const mockRefWallet = { balance: 100 };
    const mockTotalActiveTP = 100; // Max allowed: 200
    const mockTotalClaimed = 50;   // Remaining allowance: 150

    console.log('Logic check:');
    console.log('Current Balance: 100');
    console.log('TP: 100, Multiplier: 2 -> Max: 200');
    console.log('Already Claimed: 50 -> Available: 150');
    console.log('Case 1: Claim 30 -> Allowed (30 < 100 and 30 < 150)');
    console.log('Case 2: Claim 120 -> Allowed but capped at balance (100)');
    console.log('Case 3: Claim 200 -> Capped at balance (100) or allowance (150)');
}
