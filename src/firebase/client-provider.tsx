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
 * Uses a ref guard to ensure the initialization promise is only triggered once
 * per component mount cycle, supporting React Strict Mode.
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
      try {
        const services = await initializeFirebase();
        setFirebaseServices(services);
      } catch (err: any) {
        console.error("Critical Firebase Client Provider Error:", err);
        setError(err.message || "Failed to establish database connection.");
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
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-xl font-bold mb-2">Service Unavailable</h1>
        <p className="text-muted-foreground mb-6 max-w-xs">{error}</p>
        <Button onClick={() => window.location.reload()}>Retry Connection</Button>
      </div>
    );
  }

  // Loading state (resolved via singleton promise in init.ts)
  if (!firebaseServices) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium italic">Establishing local database connection...</p>
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
