import { z } from 'zod';
import { summarySchema, type Profile, type Summary } from '../profile/schema.js';
import { defineTool } from './define.js';
import { found, outputSchemaFor, type Outcome } from './result.js';

export const getSummaryInput = z.strictObject({});

export function getSummary(profile: Profile): Outcome<Summary> {
  return found([profile.summary]);
}

export const getSummaryTool = defineTool({
  name: 'get_summary',
  description:
    'Returns the profile summary of the fictional engineer: title, seniority, years of experience, ' +
    'domains, leadership, education and the fictional-persona disclaimer. Takes no arguments.',
  inputSchema: getSummaryInput,
  outputSchema: outputSchemaFor(summarySchema),
  handler: (profile) => getSummary(profile),
});
