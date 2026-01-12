
'use server';
/**
 * @fileOverview A server-side flow to create a new user in Firebase Authentication and Firestore.
 *
 * - createUser - Creates a user in Auth and their profile in Firestore.
 * - CreateUserInput - The input type for the user creation function.
 * - CreateUserOutput - The return type for the user creation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as admin from 'firebase-admin';

// This pattern ensures the Admin SDK is initialized only once in a server environment.
if (!admin.apps.length) {
  try {
    admin.initializeApp();
  } catch (e) {
    console.error('Firebase Admin SDK initialization error on module load', e);
  }
}

const CreateUserInputSchema = z.object({
  name: z.string().describe('The full name of the user.'),
  email: z.string().email().describe('The email address for the new user.'),
  password: z.string().min(6).describe('The password for the new user (min 6 characters).'),
  roleId: z.string().describe('The ID of the role to assign to the user.'),
  avatarUrl: z.string().optional().describe('The URL for the user\'s avatar image.'),
});
export type CreateUserInput = z.infer<typeof CreateUserInputSchema>;

const CreateUserOutputSchema = z.object({
  uid: z.string().describe('The new user\'s unique ID.'),
  success: z.boolean(),
  error: z.string().optional(),
});
export type CreateUserOutput = z.infer<typeof CreateUserOutputSchema>;

export async function createUser(input: CreateUserInput): Promise<CreateUserOutput> {
  return createUserFlow(input);
}

const createUserFlow = ai.defineFlow(
  {
    name: 'createUserFlow',
    inputSchema: CreateUserInputSchema,
    outputSchema: CreateUserOutputSchema,
  },
  async (input) => {
    // Check if the admin app is available. If not, it means initialization failed earlier.
    if (!admin.apps.length || !admin.app()) {
      const errorMessage = 'Failed to initialize Firebase Admin SDK.';
      console.error(errorMessage);
      return {
        uid: '',
        success: false,
        error: errorMessage,
      };
    }
    
    const firestore = admin.firestore();
    let uid = '';

    try {
      // 1. Create the user in Firebase Authentication
      const userRecord = await admin.auth().createUser({
        email: input.email,
        password: input.password,
        displayName: input.name,
        emailVerified: true, // Let's assume verification for simplicity
      });

      uid = userRecord.uid;

      // 2. Create the user profile in Firestore using the UID as the document ID
      const [firstName, ...lastNameParts] = input.name.split(' ');
      const lastName = lastNameParts.join(' ');
      
      const technicianRef = firestore.collection('technicians').doc(uid);
      await technicianRef.set({
        id: uid,
        firstName,
        lastName,
        email: input.email,
        roleId: input.roleId,
        avatarUrl: input.avatarUrl || null,
        disabled: false,
      });

      return {
        uid,
        success: true,
      };
    } catch (error: any) {
      console.error('Error creating user:', error);
      
      // If we created an auth user but failed to create the firestore doc,
      // we must delete the auth user to prevent orphaned accounts.
      if (uid) {
        try {
          await admin.auth().deleteUser(uid);
          console.log(`Successfully deleted orphaned auth user with uid: ${uid}`);
        } catch (cleanupError) {
           console.error(`Failed to clean up orphaned auth user with uid ${uid}:`, cleanupError);
        }
      }
      
      // Provide a more specific error message if available
      let errorMessage = 'An unexpected error occurred during user creation.';
      if (error.code === 'auth/email-already-exists') {
        errorMessage = 'This email address is already in use by another account.';
      } else if (error.code) {
        errorMessage = `Error from Firebase: ${error.message}`;
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      return {
        uid: '',
        success: false,
        error: errorMessage,
      };
    }
  }
);
