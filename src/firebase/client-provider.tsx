'use client';

import React, { useState, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase, type FirebaseServices } from '@/firebase/init';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * The FirebaseClientProvider handles the async initialization of Firebase services.
 * It ensures the app doesn't hang if Firestore persistence is restricted.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [firebaseServices, setFirebaseServices] = useState<FirebaseServices | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
    
    const startServices = async () => {
      try {
        // This call is now guaranteed to resolve or use a fallback
        const services = await initializeFirebase();
        setFirebaseServices(services);
      } catch (err: any) {
        console.error("Critical Firebase Client Provider Error:", err);
        setError(err.message || "Failed to establish database connection.");
      }
    };

    startServices();
  }, []);

  // Hydration fallback
  if (!hasHydrated) {
    return null;
  }

  // Fatal error fallback
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

  // Loading state (should resolve quickly now with fallbacks)
  if (!firebaseServices) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium italic">Initializing USPS Tracker...</p>
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
