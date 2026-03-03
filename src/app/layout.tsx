
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import { FirebaseClientProvider } from '@/firebase';
import { SyncManager } from '@/components/sync-manager';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'USPS WO Tracker',
  description: 'A robust work order tracking app for managing and streamlining tasks for USPS.',
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
