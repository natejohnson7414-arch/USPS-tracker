'use client';

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  memoryLocalCache,
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

// Module-level singletons to prevent race conditions and double-initialization
let servicesPromise: Promise<FirebaseServices> | null = null;
let services: FirebaseServices | null = null;
let firestoreInitialized = false;

/**
 * Fast check for IndexedDB availability.
 */
async function isIndexedDbAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.indexedDB) return false;
  
  return new Promise((resolve) => {
    const dbName = 'idb-persistence-check';
    const timeout = setTimeout(() => {
      resolve(false);
    }, 1000); // 500ms is plenty for a simple open

    try {
      const request = indexedDB.open(dbName);
      request.onsuccess = () => {
        request.result.close();
        indexedDB.deleteDatabase(dbName);
        clearTimeout(timeout);
        resolve(true);
      };
      request.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    } catch (e) {
      clearTimeout(timeout);
      resolve(false);
    }
  });
}

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
            const idbAvailable = await isIndexedDbAvailable();
            
            if (idbAvailable) {
              firestore = initializeFirestore(app, {
                localCache: persistentLocalCache({}),
              });
              console.log("[Firebase] Firestore persistence enabled");
            } else {
              firestore = initializeFirestore(app, {
                localCache: memoryLocalCache(),
              });
              console.log("[Firebase] Firestore memory fallback");
            }
            firestoreInitialized = true;
          } catch (e: any) {
            console.warn("[Firebase] Falling back to standard Firestore instance:", e.message);
            firestore = getFirestore(app);
            firestoreInitialized = true;
          }
        }
      }

      const finalServices: FirebaseServices = {
        firebaseApp: app,
        auth: getAuth(app),
        firestore,
        storage: getStorage(app),
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
