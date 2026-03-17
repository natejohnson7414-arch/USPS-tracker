'use client';

import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Lightweight offline shell used as a fallback document by the service worker.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-muted p-6 rounded-full mb-6">
        <WifiOff className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold mb-2 text-foreground">You're Offline</h1>
      <p className="text-muted-foreground mb-8 max-w-xs text-sm">
        We couldn't connect to the server. Please check your internet connection and try again to sync your work orders.
      </p>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button 
          onClick={() => window.location.reload()} 
          className="w-full h-12 text-base"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry Connection
        </Button>
        <Button 
          variant="outline" 
          asChild
          className="w-full h-12 text-base"
        >
          <a href="/">Go to Dashboard</a>
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-8 uppercase tracking-widest opacity-50">
        USPS WO Tracker
      </p>
    </div>
  );
}
