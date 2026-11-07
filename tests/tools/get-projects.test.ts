import { describe, expect, it } from 'vitest';
import { getProjectsTool } from '../../src/tools/get-projects.js';
import type { Outcome } from '../../src/tools/result.js';
import type { Project } from '../../src/profile/schema.js';
import { committedProfile } from './committed-profile.js';

const profile = committedProfile();
const run = (input: unknown) => getProjectsTool.run(profile, input) as Outcome<Project>;
const ids = (outcome: Outcome<Project>) =>
  outcome.status === 'found' ? outcome.items.map((p) => p.id) : [];
const usingTech = (tech: string) =>
  profile.projects.filter((p) => p.tech.includes(tech)).map((p) => p.id);

describe('get_projects', () => {
  it('returns every project with tech, period and outcomes when called without arguments', () => {
    const outcome = run({});
    expect(ids(outcome)).toEqual(profile.projects.map((p) => p.id));
    if (outcome.status === 'found') {
      expect(outcome.items[0]).toHaveProperty('tech');
      expect(outcome.items[0]).toHaveProperty('period');
      expect(outcome.items[0]).toHaveProperty('outcomes');
    }
  });

  it('expands an alias to the canonical technology', () => {
    expect(ids(run({ technology: 'Lambda' }))).toEqual(usingTech('AWS Lambda'));
    expect(ids(run({ technology: 'TS' }))).toEqual(usingTech('TypeScript'));
    expect(usingTech('TypeScript').length).toBeGreaterThan(0);
  });

  it('returns not_found for a skill no project uses', () => {
    const outcome = run({ technology: 'React' });
    expect(outcome).toMatchObject({ status: 'not_found', query: 'React' });
    if (outcome.status === 'not_found') expect(outcome.message).toMatch(/search_experience/);
  });

  it('returns not_found for an absent technology', () => {
    expect(run({ technology: 'GraphQL' }).status).toBe('not_found');
  });

  it('rejects unknown arguments and empty terms', () => {
    expect(() => run({ technology: 'Terraform', salary: 'x' })).toThrow();
    expect(() => run({ technology: '' })).toThrow();
  });

  it('results validate against the output schema', () => {
    for (const input of [{}, { technology: 'TS' }, { technology: 'GraphQL' }]) {
      expect(getProjectsTool.outputSchema.safeParse(run(input)).success).toBe(true);
    }
  });
});
