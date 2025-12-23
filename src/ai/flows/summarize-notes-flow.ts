
'use server';
/**
 * @fileOverview An AI flow to summarize a list of work order notes.
 *
 * - summarizeNotes - A function that handles the summarization process.
 * - SummarizeNotesInput - The input type for the summarization function.
 * - SummarizeNotesOutput - The return type for the summarization function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SummarizeNotesInputSchema = z.object({
  notes: z.array(z.string()).describe("An array of notes from a work order."),
});
export type SummarizeNotesInput = z.infer<typeof SummarizeNotesInputSchema>;

const SummarizeNotesOutputSchema = z.object({
  summary: z.string().describe("A consolidated, grammatically correct, and concise summary of the work performed, based on the provided notes."),
}).describe("The summarized work description.");
export type SummarizeNotesOutput = z.infer<typeof SummarizeNotesOutputSchema>;

export async function summarizeNotes(input: SummarizeNotesInput): Promise<SummarizeNotesOutput> {
  // If there's only one note, just return it to save an AI call.
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
  prompt: `You are an expert technical writer. Your task is to consolidate the following work order notes into a single, concise, and grammatically correct paragraph. The summary should accurately reflect all actions taken without being overly long or conversational.

  Combine these notes into a professional summary:
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
