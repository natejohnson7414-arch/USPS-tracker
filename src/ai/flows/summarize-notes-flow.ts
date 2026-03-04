'use server';
/**
 * @fileOverview An AI flow to summarize work order data into a technical work performed description.
 *
 * - summarizeNotes - A function that handles the summarization process.
 * - SummarizeNotesInput - The input type for the summarization function.
 * - SummarizeNotesOutput - The return type for the summarization function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SummarizeNotesInputSchema = z.object({
  notes: z.array(z.string()).describe("An array of notes, descriptions, and activities from a work order."),
});
export type SummarizeNotesInput = z.infer<typeof SummarizeNotesInputSchema>;

const SummarizeNotesOutputSchema = z.object({
  summary: z.string().describe("A consolidated, professional, and technical 'Description of Work Performed' summary."),
}).describe("The summarized work description.");
export type SummarizeNotesOutput = z.infer<typeof SummarizeNotesOutputSchema>;

export async function summarizeNotes(input: SummarizeNotesInput): Promise<SummarizeNotesOutput> {
  // If there's only one item, just return it to save an AI call.
  if (input.notes.length === 1) {
    return { summary: input.notes[0] };
  }
  // If there are no notes, return an empty summary.
  if (input.notes.length === 0) {
    return { summary: '' };
  }
  return summarizeNotesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeNotesPrompt',
  input: { schema: SummarizeNotesInputSchema },
  output: { schema: SummarizeNotesOutputSchema },
  prompt: `You are an expert facilities management reporter and technical writer. 
  
  Your task is to create a professional "Description of Work Performed" summary for a facility work order report. 
  
  I will provide you with a list of items including:
  1. The original "Job Specification" (the problem/request).
  2. "Technician Notes" (field updates and observations).
  3. "Activities Performed" (specific tasks logged by the tech).
  
  Instructions:
  - Combine these into a single, cohesive, and concise paragraph. 
  - Focus primarily on the ACTIONS TAKEN and the RESOLUTION provided by the technician.
  - Use past tense (e.g., "Inspected unit", "Replaced filters", "Verified operation").
  - Maintain a professional and technical tone suitable for a high-level facility report.
  - Omit administrative notes, conversational filler, or internal instructions.
  - The final output should read as a clean technical summary of the work done on site.
  
  Input Data:
  {{#each notes}}
  - {{{this}}}
  {{/each}}
  `,
});

const summarizeNotesFlow = ai.defineFlow(
  {
    name: 'summarizeNotesFlow',
    inputSchema: SummarizeNotesInputSchema,
    outputSchema: SummarizeNotesOutputSchema,
  },
  async (input) => {
    const llmResponse = await prompt(input);
    const output = llmResponse.output;

    if (!output) {
      throw new Error('The model failed to generate a summary.');
    }

    return output;
  }
);
