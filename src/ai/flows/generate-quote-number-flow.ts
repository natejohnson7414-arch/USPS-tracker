
'use server';
/**
 * @fileOverview A server-side action to generate a unique, sequential quote number.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { z } from 'zod';

/**
 * Ensures Firebase Admin is initialized exactly once.
 */
function getAdminDb() {
  if (!getApps().length) {
    try {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, '');

      if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Missing Firebase Admin environment variables (Project ID, Client Email, or Private Key).');
      }

      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('Firebase Admin initialized successfully.');
    } catch (error: any) {
      console.error('Firebase Admin SDK initialization failed:', error.message);
      return null;
    }
  }
  return getFirestore();
}

const GenerateQuoteNumberOutputSchema = z.object({
  quoteNumber: z.string(),
  error: z.string().optional(),
});
export type GenerateQuoteNumberOutput = z.infer<typeof GenerateQuoteNumberOutputSchema>;

/**
 * Generates a unique, sequential quote number using a Firestore transaction.
 * Format: QT-YY-0001
 */
export async function generateQuoteNumber(): Promise<GenerateQuoteNumberOutput> {
    console.log('Generating new quote number...');
    const adminDb = getAdminDb();
    if (!adminDb) {
      return { quoteNumber: '', error: 'Server configuration error: Database connection failed.' };
    }

    const counterRef = adminDb.collection('counters').doc('quoteCounter');
    const currentYear = new Date().getFullYear();
    const yearShort = currentYear.toString().slice(-2);

    try {
      const newNumber = await adminDb.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        if (!counterDoc.exists) {
          transaction.set(counterRef, { lastNumber: 1, year: currentYear });
          return 1;
        }

        const data = counterDoc.data()!;
        let newLastNumber = data.lastNumber;

        if (data.year === currentYear) {
          newLastNumber += 1;
        } else {
          // Reset counter for a new year
          newLastNumber = 1;
        }
        
        transaction.update(counterRef, { lastNumber: newLastNumber, year: currentYear });
        return newLastNumber;
      });

      const formattedNumber = `QT-${yearShort}-${newNumber.toString().padStart(4, '0')}`;
      console.log('Successfully generated quote number:', formattedNumber);
      return { quoteNumber: formattedNumber };
    } catch (error: any) {
      console.error("Transaction to generate quote number failed:", error.message);
      return { quoteNumber: '', error: `Database error: ${error.message}` };
    }
}
