
import * as admin from 'firebase-admin';
import { firebaseConfig } from './config';

// Initialize Firebase Admin SDK, guarding against re-initialization.
if (!admin.apps.length) {
  try {
    // Explicitly initialize with Application Default Credentials and the Project ID.
    // This is a more robust method for handling authentication in some cloud environments.
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
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
