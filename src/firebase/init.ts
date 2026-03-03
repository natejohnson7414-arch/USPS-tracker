'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  Firestore
} from 'firebase/firestore'
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from '@/firebase/config';

export interface FirebaseServices {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
}

let services: FirebaseServices | null = null;

/**
 * Initializes Firebase services with robust offline persistence.
 * This function handles multi-tab environments and restricted storage scenarios.
 */
export function initializeFirebase(): FirebaseServices {
  if (services) return services;

  const isServer = typeof window === 'undefined';

  if (!getApps().length) {
    const firebaseApp = initializeApp(firebaseConfig);

    let firestore: Firestore;
    if (!isServer) {
      try {
        // Attempt to initialize with persistence. 
        // We use a simpler persistentLocalCache without the multiple tab manager initially 
        // to ensure maximum compatibility across browser security settings.
        firestore = initializeFirestore(firebaseApp, {
          localCache: persistentLocalCache({}),
        });
      } catch (e: any) {
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
