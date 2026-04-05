'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  memoryLocalCache,
  Firestore,
  persistentMultipleTabManager
} from 'firebase/firestore'
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from '@/firebase/config';

export interface FirebaseServices {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
}

// Module-level singletons to prevent race conditions and double-initialization
let servicesPromise: Promise<FirebaseServices> | null = null;
let services: FirebaseServices | null = null;
let firestoreInitialized = false;

/**
 * Initializes Firebase services with a guaranteed completion path.
 */
export async function initializeFirebase(): Promise<FirebaseServices> {
  if (services) return services;
  if (servicesPromise) return servicesPromise;

  console.log("[Firebase] Starting service initialization sequence...");

  servicesPromise = (async () => {
    try {
      const isServer = typeof window === 'undefined';
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

      let firestore: Firestore;

      if (isServer) {
        firestore = getFirestore(app);
      } else {
        if (firestoreInitialized) {
          firestore = getFirestore(app);
        } else {
          try {
            // Use Multiple Tab Manager to allow shared offline access across browser tabs
            firestore = initializeFirestore(app, {
              localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager(),
              }),
            });
            console.log("[Firebase] Firestore persistence with multi-tab sync enabled");
          } catch (e: any) {
            // Fallback to memory cache if persistent initialization fails (e.g., Safari private mode)
            console.warn("[Firebase] Persistent cache failed, falling back to memory cache:", e.message);
            firestore = initializeFirestore(app, {
              localCache: memoryLocalCache(),
            });
          }
          firestoreInitialized = true;
        }
      }

      // Explicitly pass storage bucket to resolve initialization issues in restricted environments
      const storage = getStorage(app, firebaseConfig.storageBucket);

      const finalServices: FirebaseServices = {
        firebaseApp: app,
        auth: getAuth(app),
        firestore,
        storage,
      };

      services = finalServices;
      return finalServices;
    } catch (error) {
      servicesPromise = null;
      console.error("[Firebase] Fatal error during initialization:", error);
      throw error;
    }
  })();

  return servicesPromise;
}
