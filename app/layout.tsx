import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { AuthProvider, TelegramProvider, ThemeProvider } from '@/context';
import { getSettings } from '@/lib/repositories/settings.repository';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Trade-Edge',
  description: 'Earn USDT through our multi-level referral system',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSettings();
  const brandColor = settings?.brandColor || '#84cc16';

  return (
    <html lang="en" suppressHydrationWarning style={{
      '--brand-main': brandColor,
      '--brand-dark': `color-mix(in srgb, ${brandColor} 80%, black)`
    } as React.CSSProperties}>
      <head>
        <script src="https://telegram.org/js/telegram-web-app.js" async />
      </head>
      <body className={inter.variable}>
        <AppRouterCacheProvider>
          <TelegramProvider>
            <ThemeProvider>
              <AuthProvider>
                {children}
              </AuthProvider>
            </ThemeProvider>
          </TelegramProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
