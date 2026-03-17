import { getDB } from '../db';
import { Collections } from '../db/collections';
import type { AppSettings } from '@/types';

const SETTINGS_DOC_ID = 'global_settings_singleton';

const defaultSettings: Omit<AppSettings, '_id' | 'updatedAt'> = {
    appName: 'Trade Edge',
    brandColor: '#84cc16',
    minWithdrawalAmount: 10,
    withdrawalFeeType: 'PERCENTAGE',
    withdrawalFeeValue: 2,
    defaultPlanDurationDays: 30,
    tier1ReferralPercentage: 10,
    maintenanceMode: false,
    receivingAddress: '',
    qrCodeUrl: '',
    referralClaimMultiplier: 1,
};

export async function getSettings(): Promise<AppSettings> {
    const db = await getDB();
    const settings = await db.collection<AppSettings>(Collections.SETTINGS).findOne({ _id: SETTINGS_DOC_ID as any });

    if (!settings) {
        // Return defaults if not set in DB
        return {
            _id: SETTINGS_DOC_ID,
            ...defaultSettings,
            updatedAt: new Date(),
        };
    }

    // Migration/Normalization: If new fields are missing but old ones exist, populate them
    if (!settings.withdrawalFeeType) {
        settings.withdrawalFeeType = 'PERCENTAGE';
        settings.withdrawalFeeValue = settings.withdrawalFeePercentage ?? defaultSettings.withdrawalFeeValue;
    }

    if (settings.maintenanceMode === undefined) {
        settings.maintenanceMode = false;
    }

    if (!settings.receivingAddress) {
        settings.receivingAddress = process.env.PAYMENT_BEP20_ADDRESS || '';
    }

    if (settings.referralClaimMultiplier === undefined) {
        settings.referralClaimMultiplier = defaultSettings.referralClaimMultiplier;
    }

    return settings;
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

    return newSettings;
}
