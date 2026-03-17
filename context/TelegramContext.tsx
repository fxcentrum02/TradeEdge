'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import type { TelegramUser } from '@/types';
import { remoteLog } from '@/lib/logger';


declare global {
    interface Window {
        Telegram?: {
            WebApp: {
                initData: string;
                initDataUnsafe: {
                    user?: TelegramUser;
                    start_param?: string;
                    auth_date: number;
                    hash: string;
                };
                ready: () => void;
                expand: () => void;
                close: () => void;
                MainButton: {
                    text: string;
                    show: () => void;
                    hide: () => void;
                    onClick: (fn: () => void) => void;
                };
                BackButton: {
                    show: () => void;
                    hide: () => void;
                    onClick: (fn: () => void) => void;
                };
                themeParams: {
                    bg_color?: string;
                    text_color?: string;
                    hint_color?: string;
                    link_color?: string;
                    button_color?: string;
                    button_text_color?: string;
                };
                colorScheme: 'light' | 'dark';
                isExpanded: boolean;
                viewportHeight: number;
                viewportStableHeight: number;
                platform: string;
                version: string;
            };
        };
    }
}

type WebAppType = NonNullable<Window['Telegram']>['WebApp'];

interface TelegramContextType {
    webApp: WebAppType | null;
    user: TelegramUser | null;
    initData: string;
    startParam: string | null;
    colorScheme: 'light';
    isReady: boolean;
    isTelegramWebApp: boolean; // True if window.Telegram exists
    hasInitData: boolean;      // True if initData is populated
}

const TelegramContext = createContext<TelegramContextType | undefined>(undefined);

export function TelegramProvider({ children }: { children: ReactNode }) {
    const [isReady, setIsReady] = useState(false);
    const [webApp, setWebApp] = useState<WebAppType | null>(null);
    const [initData, setInitData] = useState('');

    const checkWebApp = useCallback(() => {
        const tg = window.Telegram?.WebApp;
        if (tg) {
            if (!webApp) {
                console.log('[TelegramContext] WebApp detected');
                tg.ready();
                tg.expand();
                setWebApp(tg);

                remoteLog('WebApp detected in client', {
                    hasInitData: !!tg.initData,
                    user: tg.initDataUnsafe?.user,
                    startParam: tg.initDataUnsafe?.start_param
                });
            }

            if (tg.initData && tg.initData !== initData) {
                console.log('[TelegramContext] initData populated');
                setInitData(tg.initData);
                remoteLog('initData populated', {
                    username: tg.initDataUnsafe?.user?.username
                });
                return true; // Stop polling if we have data
            }
        }
        return false;
    }, [webApp, initData]);

    useEffect(() => {
        // First check
        const found = checkWebApp();
        setIsReady(true);

        if (found) return;

        // Poll for a period if data is missing (some older clients or slower bridges)
        let attempts = 0;
        const maxAttempts = 40; // 10 seconds (250ms * 40)
        const interval = setInterval(() => {
            attempts++;
            const success = checkWebApp();

            if (success) {
                console.log('[TelegramContext] Resolved via polling');
                clearInterval(interval);
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                if (window.Telegram?.WebApp) {
                    // Only log warn if we actually have the WebApp but no data
                    remoteLog('initData still missing after 10s polling', {
                        platform: window.Telegram.WebApp.platform,
                        version: window.Telegram.WebApp.version
                    }, 'WARN');
                }
            }
        }, 250);

        return () => clearInterval(interval);
    }, [checkWebApp]);

    const value: TelegramContextType = {
        webApp,
        user: webApp?.initDataUnsafe?.user || null,
        initData: initData || webApp?.initData || '',
        startParam: webApp?.initDataUnsafe?.start_param || null,
        colorScheme: 'light',
        isReady,
        isTelegramWebApp: !!webApp,
        hasInitData: !!(initData || webApp?.initData),
    };

    return (
        <TelegramContext.Provider value={value}>
            {children}
        </TelegramContext.Provider>
    );
}

export function useTelegram() {
    const context = useContext(TelegramContext);
    if (!context) {
        throw new Error('useTelegram must be used within TelegramProvider');
    }
    return context;
}
