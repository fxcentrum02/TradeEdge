'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import type { User } from '@/types';
import { remoteLog } from '@/lib/logger';
import { useTelegram } from './TelegramContext';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    isTelegramMissing: boolean;
    login: (initData: string, referralCode?: string) => Promise<boolean>;
    logout: () => Promise<void>;
    authFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const { initData, startParam, isTelegramWebApp, isReady: tgContextReady, hasInitData } = useTelegram();
    const [user, setUser] = useState<User | null>(null);
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [initialDetectionTimeout, setInitialDetectionTimeout] = useState(true);
    const loginAttempted = useRef(false);

    // Final derived loading state:
    const isLoading = isLoggingIn || (isTelegramWebApp && !hasInitData && !user) || (initialDetectionTimeout && !user && isTelegramWebApp);

    const isTelegramMissing = !isLoading && !user && (!isTelegramWebApp || !hasInitData);

    // Timeout to give Telegram bridge a second to connect before we allow "unauthenticated" state
    useEffect(() => {
        const timer = setTimeout(() => {
            setInitialDetectionTimeout(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
        const headers = new Headers(options.headers);
        if (initData) {
            headers.set('X-Telegram-Init-Data', initData);
        }
        return fetch(url, { ...options, headers, credentials: 'include' });
    }, [initData]);

    const login = useCallback(async (initDataToken: string, referralCode?: string): Promise<boolean> => {
        try {
            setIsLoggingIn(true);
            remoteLog('Attempting login', { referralCode });
            const res = await fetch('/api/auth/telegram', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ initData: initDataToken, referralCode }),
                credentials: 'include',
            });

            const data = await res.json();
            if (data.success && data.data?.user) {
                setUser(data.data.user);
                return true;
            }
            return false;
        } catch (error) {
            remoteLog('Login error', { error: String(error) }, 'ERROR');
            return false;
        } finally {
            setIsLoggingIn(false);
        }
    }, []);

    // Auto-login watcher
    useEffect(() => {
        if (tgContextReady && isTelegramWebApp && hasInitData && !user && !loginAttempted.current) {
            loginAttempted.current = true;
            remoteLog('Auto-login triggered in AuthContext');
            login(initData, startParam || undefined);
        }
    }, [tgContextReady, isTelegramWebApp, hasInitData, initData, user, startParam, login]);

    const logout = async () => {
        setUser(null);
        loginAttempted.current = true;
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                isAuthenticated: !!user,
                isTelegramMissing,
                login,
                logout,
                authFetch,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
