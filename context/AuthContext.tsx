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
    swrFetch: (url: string, onSuccess: (data: any) => void, setLoadingState?: (loading: boolean) => void) => Promise<void>;
    clearCache: (url?: string) => void;
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
        }, 300);
        return () => clearTimeout(timer);
    }, []);

    const authFetch = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
        const headers = new Headers(options.headers);
        if (initData) {
            headers.set('X-Telegram-Init-Data', initData);
        }
        return fetch(url, { ...options, headers, credentials: 'include' });
    }, [initData]);

    // In-memory cache for SWR (Stale-While-Revalidate)
    const apiCache = useRef<Map<string, any>>(new Map());

    const swrFetch = useCallback(async (
        url: string, 
        onSuccess: (data: any) => void,
        setLoadingState?: (loading: boolean) => void
    ) => {
        // 1. Check cache first
        const cached = apiCache.current.get(url);
        if (cached) {
            onSuccess(cached);
            if (setLoadingState) setLoadingState(false);
        } else {
            if (setLoadingState) setLoadingState(true);
        }

        // 2. Fetch fresh data in background
        try {
            const res = await authFetch(url);
            if (res.ok) {
                const json = await res.json();
                if (json.success && json.data) {
                    apiCache.current.set(url, json.data);
                    onSuccess(json.data);
                }
            }
        } catch (err) {
            console.error(`SWR fetch failed for ${url}:`, err);
        } finally {
            if (setLoadingState) setLoadingState(false);
        }
    }, [authFetch]);

    const clearCache = useCallback((url?: string) => {
        if (url) {
            apiCache.current.delete(url);
        } else {
            apiCache.current.clear();
        }
    }, []);

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

    // State diagnostics log
    useEffect(() => {
        remoteLog('Auth state changed', {
            tgContextReady,
            isTelegramWebApp,
            hasInitData,
            hasUser: !!user,
            isLoading,
            isTelegramMissing,
            initialDetectionTimeout,
            isLoggingIn,
            loginAttempted: loginAttempted.current
        });
    }, [tgContextReady, isTelegramWebApp, hasInitData, user, isLoading, isTelegramMissing, initialDetectionTimeout, isLoggingIn]);

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
                swrFetch,
                clearCache,
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
