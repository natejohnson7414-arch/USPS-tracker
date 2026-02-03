
'use server';

import { z } from 'zod';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ai } from '@/ai/genkit';

// Bulletproof initialization: Initialize Firebase Admin only once.
if (!getApps().length) {
  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization failed:', error);
  }
}

const NotifyAdminsInputSchema = z.object({
  quoteId: z.string().describe('The ID of the newly created quote.'),
  workOrderId: z.string().describe('The ID of the work order the quote is for.'),
  jobName: z.string().describe('The name of the job.'),
  technicianName: z.string().describe('The name of the technician who submitted the quote.'),
});
export type NotifyAdminsInput = z.infer<typeof NotifyAdminsInputSchema>;

const NotifyAdminsOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type NotifyAdminsOutput = z.infer<typeof NotifyAdminsOutputSchema>;


export async function notifyAdminsOfNewQuote(input: NotifyAdminsInput): Promise<NotifyAdminsOutput> {
    return notifyAdminsFlow(input);
}


const notifyAdminsFlow = ai.defineFlow(
  {
    name: 'notifyAdminsFlow',
    inputSchema: NotifyAdminsInputSchema,
    outputSchema: NotifyAdminsOutputSchema,
  },
  async (input) => {
    if (!getApps().length) {
        return { success: false, message: 'Firebase Admin SDK is not initialized.' };
    }

    const adminDb = getFirestore();

    try {
        // 1. Find the 'Administrator' role ID
        const rolesQuery = await adminDb.collection('roles').where('name', '==', 'Administrator').limit(1).get();
        if (rolesQuery.empty) {
            console.warn("Could not find 'Administrator' role. Cannot notify admins.");
            return { success: false, message: "Administrator role not found." };
        }
        const adminRoleId = rolesQuery.docs[0].id;

        // 2. Find all technicians with that role ID
        const adminsQuery = await adminDb.collection('technicians').where('roleId', '==', adminRoleId).get();
        if (adminsQuery.empty) {
            console.log("No administrators found to notify.");
            return { success: true, message: "No administrators found to notify." };
        }

        const adminEmails = adminsQuery.docs.map(doc => doc.data().email).filter(Boolean);
        
        // 3. Simulate sending emails
        console.log(`New Quote Submitted by ${input.technicianName} for Work Order ${input.workOrderId} (${input.jobName}).`);
        console.log(`Preparing to send notifications to ${adminEmails.length} administrators...`);

        adminEmails.forEach(email => {
            // In a real application, you would use an email service like SendGrid, Nodemailer, etc.
            // For this simulation, we'll just log to the console.
            console.log(`--> SIMULATING: Sending email to ${email}`);
            console.log(`    Subject: New Quote Submitted for WO #${input.workOrderId}`);
            console.log(`    Body: A new quote (${input.quoteId}) has been submitted by ${input.technicianName} for "${input.jobName}". Please review it in the admin dashboard.`);
        });
        
        return { success: true, message: `Successfully notified ${adminEmails.length} administrators.` };

    } catch (error: any) {
        console.error("Error in notifyAdminsFlow:", error);
        return { success: false, message: `An error occurred: ${error.message}` };
    }
  }
);
