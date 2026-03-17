# Trade-Edge - Crypto Trading & Earning Platform

Trade-Edge is a Telegram Mini App platform that allows users to earn USDT through automated trading (ROI) and a 20-tier ROI-based referral system.

## Features
- **Daily ROI**: Automated ROI distribution based on active Mining Power (MP).
- **20-Tier ROI Referral Program**: Earn percentages from your network's daily earnings up to 20 levels deep.
- **Referral Wallet**: Separate wallet for referral earnings with a transfer threshold.
- **Reinvestment**: Reinvest earned USDT directly into Mining Power (Compounding).
- **Admin Panel**: Comprehensive oversight for tickets, plans, and user management.

## Tech Stack
- **Frontend/Backend**: Next.js 16 (App Router)
- **Database**: MongoDB (Native driver)
- **Authentication**: Telegram WebApp HMAC validation

## Getting Started

1. **Environment Variables**: Clone `.env.example` to `.env` and fill in your credentials.
2. **Install Dependencies**:
   ```bash
   yarn install
   ```
3. **Seed Database**:
   ```bash
   npx tsx scripts/seed.ts
   npx tsx scripts/seed-admin.ts
   ```
4. **Run Development Server**:
   ```bash
   yarn dev
   ```

## Development
- **ROI Settlement**: Processed daily via `/api/cron/roi-settlement` (Vercel Cron).
- **Verification**: Run `npx tsx scripts/test-roi-referral-20-tiers.ts` to test the 20-tier ROI commission logic.
