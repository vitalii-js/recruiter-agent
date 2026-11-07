import { z } from 'zod';

// The shared found / not_found / failure contract (design D3, spec "Shared result contract").
// Tool handlers return an Outcome; toToolResult turns it into an MCP tool result.

export interface Found<T> {
  status: 'found';
  query?: string;
  items: T[];
}

export interface NotFound {
  status: 'not_found';
  query: string;
  message: string;
}

export type Outcome<T> = Found<T> | NotFound;

/** Text shape compatible with the MCP SDK's CallToolResult. */
export interface ToolResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export const NOT_FOUND_GUIDANCE =
  'Do not infer or guess; tell the user this information is not in the profile.';

export const UNAVAILABLE_TEXT = 'The profile is temporarily unavailable.';

export function found<T>(items: T[], query?: string): Found<T> {
  return query === undefined ? { status: 'found', items } : { status: 'found', query, items };
}

export function notFound(query: string, message: string): NotFound {
  return { status: 'not_found', query, message };
}

export function toToolResult<T>(outcome: Outcome<T>): ToolResult {
  const structuredContent = { ...outcome } as Record<string, unknown>;
  const text =
    outcome.status === 'found'
      ? JSON.stringify(structuredContent)
      : `${outcome.message} ${NOT_FOUND_GUIDANCE}`;
  return { structuredContent, content: [{ type: 'text', text }], isError: false };
}

/** Generic failure. Never carries details: those go to the logs. */
export function unavailable(): ToolResult {
  return { content: [{ type: 'text', text: UNAVAILABLE_TEXT }], isError: true };
}

/** Output schema for a tool whose found items have the shape `item`. */
export function outputSchemaFor<T extends z.ZodType>(item: T) {
  return z.object({
    status: z.enum(['found', 'not_found']),
    query: z.string().optional(),
    message: z.string().optional(),
    items: z.array(item).optional(),
  });
}

/** A tool term: trimmed, non-empty, at most 100 characters. */
export const termSchema = z.string().trim().min(1).max(100);
