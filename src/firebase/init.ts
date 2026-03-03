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

let services: FirebaseServices | null = null;

/**
 * Safely checks if IndexedDB is available and working.
 * This prevents hangs in restricted environments like Safari Private or VMs.
 */
async function isIndexedDbAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.indexedDB) return false;
  
  return new Promise((resolve) => {
    // 1s timeout to prevent hanging in broken environments
    const timeout = setTimeout(() => {
      console.warn("IndexedDB check timed out. Falling back to memory cache.");
      resolve(false);
    }, 1000);

    try {
      const name = 'idb-persistence-check';
      const request = indexedDB.open(name);
      
      request.onsuccess = () => {
        clearTimeout(timeout);
        indexedDB.deleteDatabase(name);
        resolve(true);
      };
      
      request.onerror = () => {
        clearTimeout(timeout);
        console.warn("IndexedDB error detected. Persistence disabled.");
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
 * Never leaves services undefined.
 */
export async function initializeFirebase(): Promise<FirebaseServices> {
  // Return existing services if already initialized
  if (services) return services;

  const isServer = typeof window === 'undefined';
  
  // 1. Initialize Firebase App (Idempotent)
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

  let firestore: Firestore;

  if (isServer) {
    // Basic init for SSR
    firestore = getFirestore(app);
  } else {
    try {
      // 2. Browser Environment: Detect Persistence Support
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
        console.log("Firestore initialized with memoryLocalCache.");
      }
    } catch (e: any) {
      // 3. Absolute Fallback: Use standard getFirestore if custom init throws
      // (Usually occurs if firestore was already initialized elsewhere)
      console.error("Firestore custom initialization failed, using default getFirestore:", e.message);
      firestore = getFirestore(app);
    }
  }

  // 4. Set final services object
  services = {
    firebaseApp: app,
    auth: getAuth(app),
    firestore,
    storage: getStorage(app),
  };

  return services;
}
