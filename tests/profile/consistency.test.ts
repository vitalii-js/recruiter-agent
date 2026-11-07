import { describe, expect, it } from 'vitest';
import { checkConsistency } from '../../src/profile/consistency.js';
import { validProfile } from './fixture.js';

describe('checkConsistency', () => {
  it('returns no issues for a consistent profile', () => {
    expect(checkConsistency(validProfile())).toEqual([]);
  });

  it('matches tech to skill names and aliases ignoring case', () => {
    const profile = validProfile();
    profile.projects[0]!.tech = ['typescript', 'TS', 'postgres'];
    expect(checkConsistency(profile)).toEqual([]);
  });

  it('reports a project tech that is not a listed skill', () => {
    const profile = validProfile();
    profile.projects[0]!.tech.push('Kubernetes');
    expect(checkConsistency(profile)).toEqual([
      {
        path: 'projects[0].tech[2]',
        message: '"Booking API" uses "Kubernetes", which is not a listed skill or alias',
      },
    ]);
  });

  it('reports an experience tech that is not a listed skill', () => {
    const profile = validProfile();
    profile.experience[0]!.tech = ['MongoDB'];
    expect(checkConsistency(profile)).toEqual([
      expect.objectContaining({ path: 'experience[0].tech[0]' }),
    ]);
  });

  it('reports an alias used by two skills', () => {
    const profile = validProfile();
    profile.skills[1]!.aliases.push('ts');
    expect(checkConsistency(profile)).toEqual([
      {
        path: 'skills[1].aliases[1]',
        message: '"ts" is already used by skill "TypeScript"',
      },
    ]);
  });

  it('reports an alias that equals another skill name', () => {
    const profile = validProfile();
    profile.skills[1]!.aliases.push('TypeScript');
    expect(checkConsistency(profile)).toEqual([
      expect.objectContaining({ path: 'skills[1].aliases[1]' }),
    ]);
  });

  it('reports skill years above total experience', () => {
    const profile = validProfile();
    profile.skills[1]!.years = 7;
    expect(checkConsistency(profile)).toEqual([
      {
        path: 'skills[1].years',
        message: '"PostgreSQL" claims 7 years, more than the total of 6',
      },
    ]);
  });

  it('reports duplicate project ids', () => {
    const profile = validProfile();
    profile.projects.push({ ...profile.projects[0]!, name: 'Copy' });
    expect(checkConsistency(profile)).toEqual([
      { path: 'projects[1].id', message: 'duplicate project id "booking-api"' },
    ]);
  });
});
