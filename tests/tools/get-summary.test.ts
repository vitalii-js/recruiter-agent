import { describe, expect, it } from 'vitest';
import { getSummary, getSummaryTool } from '../../src/tools/get-summary.js';
import { committedProfile } from './committed-profile.js';

const profile = committedProfile();

describe('get_summary', () => {
  it('returns the summary with the fictional flag and disclaimer', () => {
    const outcome = getSummary(profile);
    expect(outcome.status).toBe('found');
    if (outcome.status !== 'found') return;
    expect(outcome.items).toHaveLength(1);
    expect(outcome.items[0]?.fictional).toBe(true);
    expect(outcome.items[0]?.disclaimer).toMatch(/fictional/i);
  });

  it('accepts no arguments and rejects unknown ones', () => {
    expect(getSummaryTool.run(profile, {}).status).toBe('found');
    expect(() => getSummaryTool.run(profile, { name: 'x' })).toThrow();
  });

  it('result validates against the output schema', () => {
    expect(getSummaryTool.outputSchema.safeParse(getSummary(profile)).success).toBe(true);
  });
});
