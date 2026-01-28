
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK, guarding against re-initialization.
// Calling initializeApp() with no arguments allows it to use Application
// Default Credentials, which is the standard for server environments.
if (!admin.apps.length) {
  try {
    admin.initializeApp();
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
