'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
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
  // 1. Basic check for server environment
  const isServer = typeof window === 'undefined';

  if (!getApps().length) {
    const firebaseApp = initializeApp(firebaseConfig);

    // 2. Configure Firestore with persistence ONLY on the client
    let firestore;
    if (!isServer) {
      try {
        firestore = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch (e) {
        console.warn("Firestore initialization failed, falling back to default.", e);
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

  // 3. If app is already initialized, return existing instances
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
