
'use client';

import React, { useState, useEffect, type ReactNode, useRef } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase, type FirebaseServices } from '@/firebase/init';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * Handles async initialization of Firebase services.
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
      console.log("[ClientProvider] Initializing services...");
      
      // Increased timeout to 30s for slow connections
      const TIMEOUT_MS = 30000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Database connection timed out. Please check your network and try again.")), TIMEOUT_MS)
      );

      try {
        const services = await Promise.race([
          initializeFirebase(),
          timeoutPromise
        ]) as FirebaseServices;
        
        setFirebaseServices(services);
      } catch (err: any) {
        console.error("Critical Firebase Client Provider Error:", err);
        setError(err.message || "Failed to establish database connection.");
        // Reset the ref so a refresh or state change can try again
        initStarted.current = false;
      }
    };

    startServices();
  }, []);

  // Prevent server-side rendering of the Firebase context
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
        <h1 className="text-xl font-bold mb-2">Service Unavailable</h1>
        <p className="text-muted-foreground mb-6 max-w-xs text-sm">
          {error}
        </p>
        <Button onClick={() => window.location.reload()}>Retry Connection</Button>
      </div>
    );
  }

  // Loading state
  if (!firebaseServices) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium italic animate-pulse">Establishing local database connection...</p>
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
