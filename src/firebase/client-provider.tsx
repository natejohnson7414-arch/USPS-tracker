'use client';

import React, { useState, useEffect, type ReactNode } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * The FirebaseClientProvider ensures that Firebase is initialized only once
 * and exclusively on the client side after hydration. This prevents SSR crashes
 * related to IndexedDB/Persistence and hydration mismatches.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [firebaseServices, setFirebaseServices] = useState<any>(null);

  useEffect(() => {
    // Only initialize after the component has mounted in the browser
    const services = initializeFirebase();
    setFirebaseServices(services);
  }, []);

  // While waiting for hydration/initialization, we render a null or empty shell
  // to avoid trying to use Firebase services before they are ready.
  if (!firebaseServices) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Initializing USPS Tracker...</div>
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
