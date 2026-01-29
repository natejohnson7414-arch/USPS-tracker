
'use server';
/**
 * @fileOverview A server-side flow to create a new user in Firebase Authentication and Firestore.
 */

import { z } from 'zod';
import admin from 'firebase-admin';

const CreateUserInputSchema = z.object({
  name: z.string().describe('The full name of the user.'),
  email: z.string().email().describe('The email address for the new user.'),
  password: z.string().min(6).describe('The password for the new user (must be at least 6 characters).'),
  roleId: z.string().describe("The ID of the user's role."),
  avatarUrl: z.string().nullable().describe('The URL for the user avatar image.'),
});

export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

const CreateUserOutputSchema = z.object({
  uid: z.string().optional(),
  error: z.string().optional(),
});

export type CreateUserOutput = z.infer<typeof CreateUserOutputSchema>;

export async function createUser(input: CreateUserInput): Promise<CreateUserOutput> {
   // Bulletproof initialization, guarded against re-runs, and executed only inside the server-side function.
    if (!admin.apps.length) {
        try {
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              // The private key must have its newlines escaped in the .env file.
              // This line of code replaces the escaped newlines with actual newlines.
              privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
            }),
          });
        } catch (error: any) {
          console.error('Firebase Admin SDK initialization failed:', error);
          // Return a structured error instead of throwing.
          return { error: `Admin SDK init failed: ${error.message}. Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set in your .env file.` };
        }
    }
    
    const adminAuth = admin.auth();
    const adminDb = admin.firestore();
    
    const { email, password, name, roleId, avatarUrl } = input;
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ');
    
    let newUserRecord;
    try {
        newUserRecord = await adminAuth.createUser({
            email,
            password,
            displayName: name,
        });

    } catch (error: any) {
        console.error("Error creating user in Firebase Auth:", error);
        if (error.code === 'auth/email-already-exists') {
            return { error: 'The email address is already in use by another account.'};
        }
        return { error: `Failed to create auth user: ${error.message}` };
    }

    try {
        const technicianRef = adminDb.collection('technicians').doc(newUserRecord.uid);
        await technicianRef.set({
            id: newUserRecord.uid,
            firstName,
            lastName,
            email: email,
            roleId: roleId,
            avatarUrl: avatarUrl || null,
            disabled: false,
        });

        return { uid: newUserRecord.uid };

    } catch (dbError: any) {
        console.error("User auth account was created, but failed to create database profile:", dbError);
        
        // Critical cleanup step: If Firestore profile creation fails, delete the orphaned Auth user.
        try {
            await adminAuth.deleteUser(newUserRecord.uid);
            console.log(`Successfully cleaned up orphaned auth user: ${newUserRecord.uid}`);
        } catch (cleanupError: any) {
            console.error(`CRITICAL: Failed to clean up orphaned auth user ${newUserRecord.uid}. Manual cleanup required.`, cleanupError);
        }

        return { error: `User auth account was created, but failed to create database profile: ${dbError.message}` };
    }
}
