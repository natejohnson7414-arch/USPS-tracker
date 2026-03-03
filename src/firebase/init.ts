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

// Module-level singletons to prevent race conditions
let servicesPromise: Promise<FirebaseServices> | null = null;
let services: FirebaseServices | null = null;

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
      console.warn("IndexedDB check timed out. Falling back to memory.");
      resolve(false);
    }, 1000);

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
        console.warn("IndexedDB error detected. Storage may be restricted.");
        resolve(false);
      };
    } catch (e) {
      clearTimeout(timeout);
      console.warn("IndexedDB access thrown. Persistence disabled.");
      resolve(false);
    }
  });
}

/**
 * Initializes Firebase services with a guaranteed completion path.
 * Uses a Promise guard to handle React Strict Mode double-invocations.
 */
export async function initializeFirebase(): Promise<FirebaseServices> {
  // 1. If we already have the services, return them immediately
  if (services) return services;

  // 2. If an initialization is already in progress, return the existing promise
  // This is CRITICAL for Next.js 15 / React Strict Mode compatibility
  if (servicesPromise) return servicesPromise;

  // 3. Create the initialization promise
  servicesPromise = (async () => {
    const isServer = typeof window === 'undefined';
    
    // Initialize App (Idempotent)
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

    let firestore: Firestore;

    if (isServer) {
      firestore = getFirestore(app);
    } else {
      try {
        const idbAvailable = await isIndexedDbAvailable();
        
        if (idbAvailable) {
          firestore = initializeFirestore(app, {
            localCache: persistentLocalCache({}),
          });
          console.log("Firestore initialized with persistentLocalCache.");
        } else {
          firestore = initializeFirestore(app, {
            localCache: memoryLocalCache(),
          });
          console.log("Firestore initialized with memoryLocalCache (fallback).");
        }
      } catch (e: any) {
        // Fallback to standard getFirestore if initializeFirestore fails (e.g. called twice)
        console.error("Firestore custom initialization failed, falling back to standard getFirestore:", e.message);
        firestore = getFirestore(app);
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
  })();

  return servicesPromise;
}
