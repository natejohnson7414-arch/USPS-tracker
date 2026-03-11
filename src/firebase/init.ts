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
 * Perform a full CRUD lifecycle test on IndexedDB.
 * Essential for detecting restricted environments like Safari Private 
 * or browsers with exceeded storage quotas.
 */
async function isIndexedDbAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.indexedDB) return false;
  
  return new Promise((resolve) => {
    const dbName = 'idb-persistence-check';
    const timeout = setTimeout(() => {
      console.warn("[Firebase] IndexedDB check timed out. Falling back to memory.");
      resolve(false);
    }, 2000);

    try {
      const request = indexedDB.open(dbName);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('test')) {
          db.createObjectStore('test');
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        db.close();
        indexedDB.deleteDatabase(dbName);
        clearTimeout(timeout);
        resolve(true);
      };
      
      request.onerror = () => {
        clearTimeout(timeout);
        console.warn("[Firebase] IndexedDB error detected. Storage may be restricted.");
        resolve(false);
      };
    } catch (e) {
      clearTimeout(timeout);
      console.warn("[Firebase] IndexedDB access thrown. Persistence disabled.");
      resolve(false);
    }
  });
}

/**
 * Initializes Firebase services with a guaranteed completion path.
 * Uses a Promise guard and defensive initialization to handle Next.js HMR.
 */
export async function initializeFirebase(): Promise<FirebaseServices> {
  // 1. If we already have the services, return them immediately
  if (services) return services;

  // 2. If an initialization is already in progress, return the existing promise
  if (servicesPromise) return servicesPromise;

  console.log("[Firebase] Starting service initialization sequence...");

  // 3. Create the initialization promise
  servicesPromise = (async () => {
    try {
      const isServer = typeof window === 'undefined';
      
      // Initialize App (Idempotent)
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

      let firestore: Firestore;

      if (isServer) {
        firestore = getFirestore(app);
      } else {
        // Defensive check: If Firestore is already implicitly initialized, 
        // we fallback to getFirestore to avoid "already initialized" errors.
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
              console.log("[Firebase] Firestore memory fallback (no IDB access)");
            }
            firestoreInitialized = true;
          } catch (e: any) {
            console.warn("[Firebase] initializeFirestore failed, falling back to getFirestore:", e.message);
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
      console.log("[Firebase] Core services successfully established.");
      return finalServices;
    } catch (error) {
      // CRITICAL: Clear the promise so retries can actually try again
      servicesPromise = null;
      console.error("[Firebase] Fatal error during initialization:", error);
      throw error;
    }
  })();

  return servicesPromise;
}
