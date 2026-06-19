import { getDB } from '../db';
import { Collections } from '../db/collections';
import type { AppSettings } from '@/types';

const SETTINGS_DOC_ID = 'global_settings_singleton';

const defaultSettings: Omit<AppSettings, '_id' | 'updatedAt'> = {
    appName: 'Trade Edge',
    brandColor: '#84cc16',
    minWithdrawalAmount: 10,
    minReferralWithdrawalAmount: 10,
    withdrawalFeeType: 'PERCENTAGE',
    withdrawalFeeValue: 2,
    defaultPlanDurationDays: 30,
    tier1ReferralPercentage: 10,
    maintenanceMode: false,
    maintenanceEstimatedDuration: '',
    receivingAddress: '',
    qrCodeUrl: '',
    referralClaimMultiplier: 1,
};

let cachedSettings: AppSettings | null = null;
let lastSettingsFetch = 0;
const CACHE_TTL_MS = 10000; // 10 seconds cache

export async function getSettings(): Promise<AppSettings> {
    const now = Date.now();
    if (cachedSettings && (now - lastSettingsFetch < CACHE_TTL_MS)) {
        return cachedSettings;
    }

    const db = await getDB();
    const settings = await db.collection<AppSettings>(Collections.SETTINGS).findOne({ _id: SETTINGS_DOC_ID as any });

    let result: AppSettings;
    if (!settings) {
        // Return defaults if not set in DB
        result = {
            _id: SETTINGS_DOC_ID,
            ...defaultSettings,
            updatedAt: new Date(),
        };
    } else {
        // Migration/Normalization: If new fields are missing but old ones exist, populate them
        if (!settings.withdrawalFeeType) {
            settings.withdrawalFeeType = 'PERCENTAGE';
            settings.withdrawalFeeValue = settings.withdrawalFeePercentage ?? defaultSettings.withdrawalFeeValue;
        }

        if (settings.maintenanceMode === undefined) {
            settings.maintenanceMode = false;
        }

        if (settings.maintenanceEstimatedDuration === undefined) {
            settings.maintenanceEstimatedDuration = '';
        }

        if (!settings.receivingAddress) {
            settings.receivingAddress = process.env.PAYMENT_BEP20_ADDRESS || '';
        }

        if (settings.referralClaimMultiplier === undefined) {
            settings.referralClaimMultiplier = defaultSettings.referralClaimMultiplier;
        }

        if (settings.minReferralWithdrawalAmount === undefined) {
            settings.minReferralWithdrawalAmount = defaultSettings.minReferralWithdrawalAmount;
        }

        result = settings;
    }

    cachedSettings = result;
    lastSettingsFetch = now;
    return result;
}

export async function updateSettings(updates: Partial<Omit<AppSettings, '_id' | 'updatedAt'>>): Promise<AppSettings> {
    const db = await getDB();

    // Ensure the doc exists
    const existing = await getSettings();

    const newSettings = {
        ...existing,
        ...updates,
        updatedAt: new Date(),
    };

    await db.collection<AppSettings>(Collections.SETTINGS).updateOne(
        { _id: SETTINGS_DOC_ID as any },
        { $set: newSettings },
        { upsert: true }
    );

    // Invalidate cache immediately
    cachedSettings = null;
    lastSettingsFetch = 0;

    return newSettings;
}
