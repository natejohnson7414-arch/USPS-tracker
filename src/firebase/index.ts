'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage';

/**
 * Initializes Firebase services with a focus on PWA offline persistence.
 * This function is designed to be safe for both SSR and Client environments.
 */
export function initializeFirebase() {
  const isServer = typeof window === 'undefined';

  if (!getApps().length) {
    const firebaseApp = initializeApp(firebaseConfig);

    let firestore;
    if (!isServer) {
      try {
        // Attempt to initialize with multi-tab persistence
        firestore = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch (e: any) {
        // Fallback if already initialized or persistence not supported
        console.warn("Firestore initialization fallback:", e.message);
        firestore = getFirestore(firebaseApp);
      }
    } else {
      firestore = getFirestore(firebaseApp);
    }

    return {
      firebaseApp,
      auth: getAuth(firebaseApp),
      firestore,
      storage: getStorage(firebaseApp),
    };
  }

  const app = getApp();
  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    storage: getStorage(app),
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './non-blocking-reads';
export * from './errors';
export * from './error-emitter';
