import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase';
import { SyncManager } from '@/components/sync-manager';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const viewport: Viewport = {
  themeColor: '#B63128',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'USPS WO Tracker',
  description: 'A robust work order tracking app for managing and streamlining tasks for USPS.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'USPS Tracker',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('min-h-screen bg-background font-sans antialiased', inter.variable)}>
        <FirebaseClientProvider>
            <SyncManager />
            {children}
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
