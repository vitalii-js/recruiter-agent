import { describe, expect, it } from 'vitest';
import type { Outcome } from '../../src/tools/result.js';
import { searchExperienceTool, type SearchHit } from '../../src/tools/search-experience.js';
import { committedProfile } from './committed-profile.js';

const profile = committedProfile();
const run = (input: unknown) => searchExperienceTool.run(profile, input) as Outcome<SearchHit>;
const hits = (query: string) => {
  const outcome = run({ query });
  return outcome.status === 'found' ? outcome.items : [];
};

describe('search_experience', () => {
  it('finds a project and lists the matching fields', () => {
    const hit = hits('idempotency').find((h) => h.id === 'idempotent-booking-service');
    expect(hit).toMatchObject({ section: 'project' });
    expect(hit?.matchedFields).toContain('summary');
    expect(hit?.entry).toMatchObject({ name: 'Idempotent Booking Service' });
  });

  it('returns hits from experience, projects and summary', () => {
    const sections = new Set(hits('Healthtech').map((h) => h.section));
    expect(sections).toEqual(new Set(['experience', 'project', 'summary']));
  });

  it('expands skill aliases into summary text', () => {
    const summary = hits('Tech lead').find((h) => h.section === 'summary');
    expect(summary?.matchedFields).toContain('leadership[0]');
  });

  it('labels experience hits with company and title', () => {
    const hit = hits('Saltmarsh Travel').find((h) => h.section === 'experience');
    expect(hit?.id).toBe('Saltmarsh Travel (Backend Engineer)');
    expect(hit?.matchedFields).toContain('company');
  });

  it('matches whole words and whole phrases only', () => {
    expect(run({ query: 'Java' }).status).toBe('not_found');
    expect(run({ query: 'React Native' }).status).toBe('not_found');
  });

  it('returns not_found with a message for absent topics', () => {
    for (const query of ['salary', 'visa', 'remote']) {
      expect(run({ query })).toEqual({
        status: 'not_found',
        query,
        message: `The profile has no information about "${query}".`,
      });
    }
  });

  it('requires a non-empty query', () => {
    expect(() => run({})).toThrow();
    expect(() => run({ query: '   ' })).toThrow();
  });

  it('gives the same answer twice', () => {
    expect(run({ query: 'Terraform' })).toEqual(run({ query: 'Terraform' }));
  });

  it('results validate against the output schema', () => {
    for (const query of ['Healthtech', 'Kafka']) {
      expect(searchExperienceTool.outputSchema.safeParse(run({ query })).success).toBe(true);
    }
  });
});
