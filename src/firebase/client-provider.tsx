'use client';

import React, { useState, useEffect, type ReactNode, useRef } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase, type FirebaseServices } from '@/firebase/init';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * Handles async initialization of Firebase services with robust error recovery.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [firebaseServices, setFirebaseServices] = useState<FirebaseServices | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);
  const initStarted = useRef(false);

  useEffect(() => {
    setHasHydrated(true);
    
    if (initStarted.current) return;
    initStarted.current = true;

    const startServices = async () => {
      console.log("[ClientProvider] Attempting to connect to database...");
      
      // Increased timeout to 45s for extremely slow/restricted environments
      const TIMEOUT_MS = 45000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("The database connection is taking longer than expected. This can happen on restricted networks or during server restarts.")), TIMEOUT_MS)
      );

      try {
        const services = await Promise.race([
          initializeFirebase(),
          timeoutPromise
        ]) as FirebaseServices;
        
        setFirebaseServices(services);
        setError(null);
      } catch (err: any) {
        console.error("Critical Firebase Client Provider Error:", err);
        setError(err.message || "Failed to establish database connection.");
        // Allow retry
        initStarted.current = false;
      }
    };

    startServices();
  }, []);

  // Prevent server-side rendering mismatch
  if (!hasHydrated) {
    return null;
  }

  // Fatal initialization error fallback
  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-destructive/10 p-6 rounded-full mb-6">
          <AlertCircle className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-xl font-bold mb-2">Connection Issue</h1>
        <p className="text-muted-foreground mb-6 max-w-sm text-sm">
          {error}
        </p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
            <Button onClick={() => window.location.reload()} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Connection
            </Button>
            <Button variant="ghost" onClick={() => setError(null)} className="w-full text-xs">
                Dismiss and Wait
            </Button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!firebaseServices) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium italic animate-pulse">Establishing local database connection...</p>
        <p className="text-[10px] text-muted-foreground mt-8 opacity-50 uppercase tracking-widest">Checking persistent storage...</p>
      </div>
    );
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
