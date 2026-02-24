
'use server';

import { z } from 'zod';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
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

const NotifyTechnicianInputSchema = z.object({
  workOrderId: z.string().describe('The ID of the work order.'),
  jobName: z.string().describe('The name of the job.'),
  technicianName: z.string().describe('The name of the technician.'),
  technicianEmail: z.string().email().describe('The email of the technician.'),
  message: z.string().describe('The instruction/message from the office.'),
});
export type NotifyTechnicianInput = z.infer<typeof NotifyTechnicianInputSchema>;

const NotifyTechnicianOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type NotifyTechnicianOutput = z.infer<typeof NotifyTechnicianOutputSchema>;


export async function notifyTechnicianOfAttention(input: NotifyTechnicianInput): Promise<NotifyTechnicianOutput> {
    return notifyTechnicianFlow(input);
}


const notifyTechnicianFlow = ai.defineFlow(
  {
    name: 'notifyTechnicianFlow',
    inputSchema: NotifyTechnicianInputSchema,
    outputSchema: NotifyTechnicianOutputSchema,
  },
  async (input) => {
    try {
        // Simulate sending notifications
        console.log(`WORK ORDER ATTENTION REQUESTED for ${input.workOrderId} (${input.jobName}).`);
        console.log(`Recipient: ${input.technicianName} (${input.technicianEmail})`);
        console.log(`Instruction: ${input.message}`);

        // In a real application, you would use an email service or push notification service here.
        console.log(`--> SIMULATING: Sending mobile push notification to ${input.technicianName}`);
        console.log(`--> SIMULATING: Sending email to ${input.technicianEmail}`);
        
        return { success: true, message: `Notification successfully simulated for ${input.technicianName}.` };

    } catch (error: any) {
        console.error("Error in notifyTechnicianFlow:", error);
        return { success: false, message: `An error occurred: ${error.message}` };
    }
  }
);
