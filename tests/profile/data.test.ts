import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkConsistency } from '../../src/profile/consistency.js';
import { findTerms, parseAbsentLists, parseHeadingNames } from '../../src/profile/persona-spec.js';
import { SECTION_NAMES, validateSection, type Profile } from '../../src/profile/schema.js';

// Checks the committed profile data against its schema and against specs/persona.md.

const DATA_DIR = fileURLToPath(new URL('../../data/profile/', import.meta.url));
const PERSONA_MD = readFileSync(
  fileURLToPath(new URL('../../specs/persona.md', import.meta.url)),
  'utf8',
);

const raw = Object.fromEntries(
  SECTION_NAMES.map((name) => [
    name,
    JSON.parse(readFileSync(`${DATA_DIR}${name}.json`, 'utf8')) as unknown,
  ]),
);

function loadProfile(): Profile {
  const sections = SECTION_NAMES.map((name) => {
    const result = validateSection(name, raw[name]);
    if (!result.ok) throw new Error(result.errors.join('\n'));
    return [name, result.value] as const;
  });
  return Object.fromEntries(sections) as unknown as Profile;
}

const absent = parseAbsentLists(PERSONA_MD);

describe('committed profile data', () => {
  it('has exactly the four section files', () => {
    const files = readdirSync(DATA_DIR).sort();
    expect(files).toEqual(SECTION_NAMES.map((name) => `${name}.json`).sort());
  });

  it.each(SECTION_NAMES)('%s passes the schema', (name) => {
    const result = validateSection(name, raw[name]);
    expect(result.ok ? [] : result.errors).toEqual([]);
  });

  it('is consistent across sections', () => {
    expect(checkConsistency(loadProfile())).toEqual([]);
  });

  it('is marked as fictional in flag and text', () => {
    const { summary } = loadProfile();
    expect(summary.fictional).toBe(true);
    expect(summary.disclaimer).toMatch(/fictional/i);
  });

  it('contains no skill or technology from the "does not have" list', () => {
    expect(findTerms(raw, absent.skills, 'profile')).toEqual([]);
  });

  it('contains no logistics or compensation topics', () => {
    expect(findTerms(raw, absent.topics, 'profile')).toEqual([]);
  });

  it('has the same projects as the persona spec', () => {
    expect(loadProfile().projects.map((p) => p.name)).toEqual(
      parseHeadingNames(PERSONA_MD, 'Project'),
    );
  });

  it('has the same experience entries as the persona spec', () => {
    expect(loadProfile().experience.map((e) => e.company)).toEqual(
      parseHeadingNames(PERSONA_MD, 'Experience'),
    );
  });

  it('has 4 to 6 projects', () => {
    const count = loadProfile().projects.length;
    expect(count).toBeGreaterThanOrEqual(4);
    expect(count).toBeLessThanOrEqual(6);
  });
});

describe('absent-terms guard', () => {
  it('fails when a trap term is added to a copy of the data', () => {
    const copy = structuredClone(raw) as { projects: { tech: string[] }[] };
    copy.projects[0]?.tech.push('Kubernetes');
    expect(findTerms(copy, absent.skills, 'profile')).toEqual([
      { path: 'profile.projects[0].tech[4]', entry: 'Kubernetes', term: 'Kubernetes' },
    ]);
  });

  it('fails when a topic is added to a copy of the data', () => {
    const copy = structuredClone(raw) as { summary: { headline: string } };
    copy.summary.headline += ' Open to remote work.';
    expect(findTerms(copy, absent.topics, 'profile')).toEqual([
      { path: 'profile.summary.headline', entry: 'Work format', term: 'remote' },
    ]);
  });
});
