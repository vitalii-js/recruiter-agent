import { describe, expect, it } from 'vitest';
import { getSkillsTool } from '../../src/tools/get-skills.js';
import type { Outcome } from '../../src/tools/result.js';
import type { Skill } from '../../src/profile/schema.js';
import { committedProfile } from './committed-profile.js';

const profile = committedProfile();
const run = (input: unknown) => getSkillsTool.run(profile, input) as Outcome<Skill>;
const names = (outcome: Outcome<Skill>) =>
  outcome.status === 'found' ? outcome.items.map((s) => s.name) : [];

describe('get_skills', () => {
  it('returns every skill with no arguments', () => {
    const outcome = run({});
    expect(outcome.status).toBe('found');
    expect(names(outcome)).toHaveLength(profile.skills.length);
  });

  it('finds a skill by alias, with years and level', () => {
    const outcome = run({ query: 'Postgres' });
    expect(outcome).toMatchObject({ status: 'found', query: 'Postgres' });
    expect(names(outcome)).toEqual(['PostgreSQL']);
    if (outcome.status === 'found') {
      expect(outcome.items[0]).toMatchObject({ years: 8, level: 'advanced' });
    }
  });

  it('ignores case and surrounding spaces', () => {
    expect(names(run({ query: '  typescript ' }))).toEqual(['TypeScript']);
  });

  it('filters by category', () => {
    expect(names(run({ category: 'testing' }))).toEqual(['Jest', 'Vitest']);
  });

  it('returns not_found for an absent skill', () => {
    const outcome = run({ query: 'Kubernetes' });
    expect(outcome).toMatchObject({ status: 'not_found', query: 'Kubernetes' });
    if (outcome.status === 'not_found') {
      expect(outcome.message).toMatch(/search_experience/);
    }
  });

  it('returns not_found for a term that is only part of skill names', () => {
    expect(run({ query: 'Amazon' }).status).toBe('not_found');
    expect(run({ query: 'React Native' }).status).toBe('not_found');
  });

  it('returns not_found when query and category disagree', () => {
    expect(run({ query: 'Terraform', category: 'testing' })).toMatchObject({
      status: 'not_found',
      query: 'Terraform',
    });
  });

  it('rejects an invalid category, empty or long terms, and unknown arguments', () => {
    expect(() => run({ category: 'mobile' })).toThrow();
    expect(() => run({ query: '   ' })).toThrow();
    expect(() => run({ query: 'a'.repeat(101) })).toThrow();
    expect(() => run({ query: 'TS', salary: 'x' })).toThrow();
  });

  it('results validate against the output schema', () => {
    for (const input of [{}, { query: 'TS' }, { query: 'Kubernetes' }]) {
      expect(getSkillsTool.outputSchema.safeParse(run(input)).success).toBe(true);
    }
  });
});
