
import * as admin from 'firebase-admin';

// Guard against re-initialization
if (!admin.apps.length) {
  // This is the bulletproof setup recommended by the user.
  // It requires environment variables to be set.
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // The private key must have its newlines escaped in the .env file.
        // This line of code replaces the escaped newlines with actual newlines.
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization failed:', error);
    // Throw a more informative error to help with debugging.
    throw new Error(`Admin SDK init failed: ${error.message}. Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set in your .env file.`);
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
