
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
import { firebaseConfig } from '@/firebase/config';

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
    // Initialize Firebase Admin SDK if it hasn't been already.
    if (!admin.apps.length) {
      try {
        // In this managed environment, initializeApp() is often sufficient
        // as credentials can be inferred.
        admin.initializeApp();
      } catch (e) {
        console.error('Firebase Admin SDK initialization error', e);
        return {
          uid: '',
          success: false,
          error: 'Failed to initialize Firebase Admin SDK.',
        };
      }
    }
    
    const firestore = admin.firestore();

    try {
      // 1. Create the user in Firebase Authentication
      const userRecord = await admin.auth().createUser({
        email: input.email,
        password: input.password,
        displayName: input.name,
      });

      const { uid } = userRecord;

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
      // If the auth user was created but firestore failed, we should delete the auth user
      if (error.code?.startsWith('firestore/')) {
        try {
          // Extract UID if possible from the error context or input
          const uidToDelete = error.uid || (await admin.auth().getUserByEmail(input.email)).uid;
          if (uidToDelete) {
            await admin.auth().deleteUser(uidToDelete);
          }
        } catch (cleanupError) {
           console.error('Failed to clean up orphaned auth user:', cleanupError);
        }
      }
      return {
        uid: '',
        success: false,
        error: error.message || 'An unexpected error occurred during user creation.',
      };
    }
  }
);
