'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  Firestore
} from 'firebase/firestore'
import { getStorage, FirebaseStorage } from 'firebase/storage';

export interface FirebaseServices {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
}

let services: FirebaseServices | null = null;

/**
 * Initializes Firebase services with a focus on PWA offline persistence.
 * This function is idempotent and safe for both SSR and Client environments.
 */
export function initializeFirebase(): FirebaseServices {
  if (services) return services;

  const isServer = typeof window === 'undefined';

  if (!getApps().length) {
    const firebaseApp = initializeApp(firebaseConfig);

    let firestore: Firestore;
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

    services = {
      firebaseApp,
      auth: getAuth(firebaseApp),
      firestore,
      storage: getStorage(firebaseApp),
    };
  } else {
    const app = getApp();
    services = {
      firebaseApp: app,
      auth: getAuth(app),
      firestore: getFirestore(app),
      storage: getStorage(app),
    };
  }

  return services;
}
