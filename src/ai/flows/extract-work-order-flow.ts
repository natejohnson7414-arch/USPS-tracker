
'use server';
/**
 * @fileOverview An AI flow to extract structured data from a work order PDF.
 *
 * - extractWorkOrderInfo - A function that handles the PDF extraction process.
 * - WorkOrderExtractionInput - The input type for the extraction function.
 * - WorkOrderExtractionOutput - The return type for the extraction function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const WorkOrderExtractionInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "A PDF file of a 'Small Job Form', as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type WorkOrderExtractionInput = z.infer<typeof WorkOrderExtractionInputSchema>;

// This schema should match the fields available in the WorkOrder type and the form.
const WorkOrderExtractionOutputSchema = z.object({
    id: z.string().optional().describe("The Job #."),
    createdDate: z.string().optional().describe("The date the form was filled out. (format: YYYY-MM-DD)"),
    billTo: z.string().optional().describe("The name of the client to bill."),
    poNumber: z.string().optional().describe("The PO #."),
    contactInfo: z.string().optional().describe("The contact information."),
    jobName: z.string().optional().describe("The Job Name."),
    jobSiteAddress: z.string().optional().describe("The street address of the job site."),
    jobSiteCity: z.string().optional().describe("The city of the job site."),
    jobSiteState: z.string().optional().describe("The 2-letter state abbreviation for the job site (e.g., IN, IL)."),
    description: z.string().optional().describe("The Job Description."),
    serviceScheduleDate: z.string().optional().describe("The Service Schedule Date. (format: YYYY-MM-DD)"),
    quotedAmount: z.number().optional().describe("The Quoted Amount."),
    timeAndMaterial: z.boolean().optional().describe("Whether the Time & Material box is checked."),
    permit: z.boolean().optional().describe("Whether the Permit box is checked."),
    permitCost: z.number().optional().describe("The Permit Cost."),
    permitFiled: z.string().optional().describe("The date the permit was filed. (format: YYYY-MM-DD)"),
    coi: z.boolean().optional().describe("Whether the COI box is checked."),
    coiRequested: z.string().optional().describe("The date the COI was requested. (format: YYYY-MM-DD)"),
    certifiedPayroll: z.boolean().optional().describe("Whether the Certified Payroll box is checked."),
    certifiedPayrollRequested: z.string().optional().describe("The date Certified Payroll was requested. (format: YYYY-MM-DD)"),
    intercoPO: z.string().optional().describe("The Interco PO#."),
    customerPO: z.string().optional().describe("The Customer PO#."),
    estimator: z.string().optional().describe("The Estimator/Requested By field."),
    checkInOutURL: z.string().optional().describe("The Check-in/Out Link/Phone."),
}).describe("The extracted data from the Small Job Form PDF.");

export type WorkOrderExtractionOutput = z.infer<typeof WorkOrderExtractionOutputSchema>;

export async function extractWorkOrderInfo(input: WorkOrderExtractionInput): Promise<WorkOrderExtractionOutput> {
  return extractWorkOrderInfoFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractWorkOrderPrompt',
  input: { schema: WorkOrderExtractionInputSchema },
  output: { schema: WorkOrderExtractionOutputSchema },
  prompt: `You are an expert data entry assistant. Your task is to extract information from the provided PDF, which is a 'Small Job Form', and return it as a structured JSON object.

  Pay close attention to the 'Job Site / Name' field.
  - The 'jobName' should be ONLY the first line of the 'Job Site / Name' field. Ignore the second line of the address for this field.
  - Extract the street address into 'jobSiteAddress', the city into 'jobSiteCity', and the state into 'jobSiteState'.

  Carefully analyze the document and extract the following fields. If a field is not present, omit it from the output. For dates, provide them in YYYY-MM-DD format. For checkboxes, return true if checked and false if not.

  PDF Document:
  {{media url=pdfDataUri}}
  `,
});

const extractWorkOrderInfoFlow = ai.defineFlow(
  {
    name: 'extractWorkOrderInfoFlow',
    inputSchema: WorkOrderExtractionInputSchema,
    outputSchema: WorkOrderExtractionOutputSchema,
  },
  async (input) => {
    const llmResponse = await prompt(input);
    const output = llmResponse.output;

    if (!output) {
      throw new Error('The model failed to extract any data from the PDF.');
    }

    return output;
  }
);
