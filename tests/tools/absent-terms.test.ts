import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseAbsentLists } from '../../src/profile/persona-spec.js';
import type { Profile } from '../../src/profile/schema.js';
import { getProjectsTool } from '../../src/tools/get-projects.js';
import { getSkillsTool } from '../../src/tools/get-skills.js';
import { searchExperienceTool } from '../../src/tools/search-experience.js';
import { committedProfile } from './committed-profile.js';

// Every "Not in profile" term from specs/persona.md must come back as not_found from every tool
// that takes a term. New trap terms added to the spec are covered automatically.

const PERSONA_MD = readFileSync(
  fileURLToPath(new URL('../../specs/persona.md', import.meta.url)),
  'utf8',
);
const absent = parseAbsentLists(PERSONA_MD);
const skillTerms = absent.skills.flatMap((entry) => entry.terms);
const topicTerms = absent.topics.flatMap((entry) => entry.terms);
const profile = committedProfile();

const statuses = (p: Profile, term: string) => ({
  get_skills: getSkillsTool.run(p, { query: term }).status,
  get_projects: getProjectsTool.run(p, { technology: term }).status,
  search_experience: searchExperienceTool.run(p, { query: term }).status,
});

describe('absent terms', () => {
  it('has terms to check', () => {
    expect(skillTerms.length).toBeGreaterThan(10);
    expect(topicTerms.length).toBeGreaterThan(5);
  });

  it.each(skillTerms)('skill term "%s" is not_found in every term tool', (term) => {
    expect(statuses(profile, term)).toEqual({
      get_skills: 'not_found',
      get_projects: 'not_found',
      search_experience: 'not_found',
    });
  });

  it.each(topicTerms)('topic term "%s" is not_found in search_experience', (term) => {
    expect(searchExperienceTool.run(profile, { query: term }).status).toBe('not_found');
  });

  it('the sweep fails when a trap term is planted in a copy of the profile', () => {
    const planted = structuredClone(profile);
    planted.skills.push({ name: 'Kafka', category: 'infrastructure', years: 1, aliases: [] });
    planted.projects[0]?.tech.push('Kafka');
    planted.summary.leadership.push('Negotiated salary bands.');

    expect(statuses(planted, 'Kafka')).toEqual({
      get_skills: 'found',
      get_projects: 'found',
      search_experience: 'found',
    });
    expect(searchExperienceTool.run(planted, { query: 'salary' }).status).toBe('found');
  });
});
