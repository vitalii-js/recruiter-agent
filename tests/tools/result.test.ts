import { describe, expect, it } from 'vitest';
import {
  found,
  NOT_FOUND_GUIDANCE,
  notFound,
  outputSchemaFor,
  termSchema,
  toToolResult,
  unavailable,
  UNAVAILABLE_TEXT,
} from '../../src/tools/result.js';
import { z } from 'zod';

describe('toToolResult', () => {
  it('found: structured content with status, query and items, mirrored as JSON text', () => {
    const result = toToolResult(found([{ name: 'TypeScript' }], 'TS'));
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({
      status: 'found',
      query: 'TS',
      items: [{ name: 'TypeScript' }],
    });
    expect(JSON.parse(result.content[0]?.text ?? '')).toEqual(result.structuredContent);
  });

  it('found without a query has no query field', () => {
    const result = toToolResult(found([1, 2]));
    expect(result.structuredContent).toEqual({ status: 'found', items: [1, 2] });
  });

  it('not_found: a normal result whose text tells the model not to guess', () => {
    const message = 'The profile has no information about "Kubernetes".';
    const result = toToolResult(notFound('Kubernetes', message));
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({ status: 'not_found', query: 'Kubernetes', message });
    expect(result.content[0]?.text).toBe(`${message} ${NOT_FOUND_GUIDANCE}`);
    expect(result.content[0]?.text).toMatch(/do not infer or guess/i);
  });
});

describe('unavailable', () => {
  it('is an error result with only the generic text', () => {
    expect(unavailable()).toEqual({
      content: [{ type: 'text', text: UNAVAILABLE_TEXT }],
      isError: true,
    });
  });
});

describe('outputSchemaFor', () => {
  const schema = outputSchemaFor(z.object({ name: z.string() }));

  it('accepts both outcomes', () => {
    expect(schema.safeParse(found([{ name: 'x' }], 'q')).success).toBe(true);
    expect(schema.safeParse(notFound('q', 'm')).success).toBe(true);
  });

  it('rejects an unknown status', () => {
    expect(schema.safeParse({ status: 'maybe' }).success).toBe(false);
  });
});

describe('termSchema', () => {
  it('trims the term', () => {
    expect(termSchema.parse('  TS ')).toBe('TS');
  });

  it('rejects empty, whitespace-only and over-long terms', () => {
    expect(termSchema.safeParse('').success).toBe(false);
    expect(termSchema.safeParse('   ').success).toBe(false);
    expect(termSchema.safeParse('a'.repeat(101)).success).toBe(false);
    expect(termSchema.safeParse('a'.repeat(100)).success).toBe(true);
  });
});
