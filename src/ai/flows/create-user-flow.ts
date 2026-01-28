'use server';
/**
 * @fileOverview A server-side flow to create a new user in Firebase Authentication and Firestore.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import * as admin from 'firebase-admin';

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
  return createUserFlow(input);
}


const createUserFlow = ai.defineFlow(
  {
    name: 'createUserFlow',
    inputSchema: CreateUserInputSchema,
    outputSchema: CreateUserOutputSchema,
  },
  async (input) => {
    // Initialize Firebase Admin SDK if not already initialized
    if (!admin.apps.length) {
      try {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
        console.log('Firebase Admin SDK initialized successfully.');
      } catch (error: any) {
        console.error('Error initializing Firebase Admin SDK:', error);
        return { error: `Firebase Admin SDK initialization failed: ${error.message}` };
      }
    }

    const { email, password, name, roleId, avatarUrl } = input;
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ');
    
    let newUserRecord;
    try {
        newUserRecord = await admin.auth().createUser({
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
        const technicianRef = admin.firestore().collection('technicians').doc(newUserRecord.uid);
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
        console.error("Error creating user profile in Firestore:", dbError);
        
        // Critical cleanup step: If Firestore profile creation fails, delete the orphaned Auth user.
        try {
            await admin.auth().deleteUser(newUserRecord.uid);
            console.log(`Successfully cleaned up orphaned auth user: ${newUserRecord.uid}`);
        } catch (cleanupError: any) {
            console.error(`CRITICAL: Failed to clean up orphaned auth user ${newUserRecord.uid}. Manual cleanup required.`, cleanupError);
        }

        return { error: `User auth account was created, but failed to create database profile: ${dbError.message}` };
    }
  }
);
