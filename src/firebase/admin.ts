
import * as admin from 'firebase-admin';
import { firebaseConfig } from './config';

// Initialize Firebase Admin SDK, guarding against re-initialization.
if (!admin.apps.length) {
  try {
    admin.initializeApp({
        projectId: firebaseConfig.projectId,
    });
  } catch (error) {
    console.error('Firebase Admin SDK initialization failed:', error);
  }
}

/**
 * A singleton instance of the Firebase Admin Auth service.
 */
export const adminAuth = admin.auth();

/**
 * A singleton instance of the Firebase Admin Firestore service.
 */
export const adminDb = admin.firestore();
