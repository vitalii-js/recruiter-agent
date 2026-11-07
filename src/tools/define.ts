import type { z } from 'zod';
import type { Profile } from '../profile/schema.js';
import type { Outcome } from './result.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  /** Validates `input` with the tool's input schema, then runs the pure handler. */
  run(profile: Profile, input: unknown): Outcome<unknown>;
}

export function defineTool<I extends z.ZodType, T>(spec: {
  name: string;
  description: string;
  inputSchema: I;
  outputSchema: z.ZodType;
  handler: (profile: Profile, input: z.output<I>) => Outcome<T>;
}): ToolDefinition {
  return {
    name: spec.name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    outputSchema: spec.outputSchema,
    run: (profile, input) => spec.handler(profile, spec.inputSchema.parse(input)),
  };
}

export const TERM_HINT = 'Pass a short term (for example "TypeScript"), not a full question.';
