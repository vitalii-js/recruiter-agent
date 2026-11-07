import { describe, expect, it } from 'vitest';
import { SECTION_NAMES, validateSection } from '../../src/profile/schema.js';
import { validProfile } from './fixture.js';

function without(value: object, key: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...value };
  delete copy[key];
  return copy;
}

describe('profile schema', () => {
  it.each(SECTION_NAMES)('accepts a valid %s section', (section) => {
    expect(validateSection(section, validProfile()[section])).toMatchObject({ ok: true });
  });

  it('rejects an unknown field and names its path', () => {
    const summary = { ...validProfile().summary, salary: '100k' };
    expect(validateSection('summary', summary)).toEqual({
      ok: false,
      errors: ['summary.salary: unknown field'],
    });
  });

  it('rejects an unknown field in a nested entry', () => {
    const projects = validProfile().projects.map((p) => ({ ...p, location: 'Somewhere' }));
    const result = validateSection('projects', projects);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toEqual(['projects[0].location: unknown field']);
  });

  it('rejects a skill without years and names the path', () => {
    const skills: unknown[] = validProfile().skills.map((skill, i) =>
      i === 1 ? without(skill, 'years') : skill,
    );
    const result = validateSection('skills', skills);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.some((e) => e.startsWith('skills[1].years:'))).toBe(true);
  });

  it('rejects fictional: false', () => {
    const summary = { ...validProfile().summary, fictional: false };
    const result = validateSection('summary', summary);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.some((e) => e.startsWith('summary.fictional:'))).toBe(true);
  });

  it('rejects a missing fictional flag', () => {
    const summary = without(validProfile().summary, 'fictional');
    expect(validateSection('summary', summary).ok).toBe(false);
  });

  it('rejects a period that ends before it starts', () => {
    const projects = validProfile().projects.map((p) => ({
      ...p,
      period: { start: '2021-06', end: '2020-01' },
    }));
    const result = validateSection('projects', projects);
    expect(!result.ok && result.errors).toEqual([
      'projects[0].period.end: end must not be before start',
    ]);
  });

  it('rejects a malformed date', () => {
    const experience = validProfile().experience.map((e) => ({
      ...e,
      period: { start: '2019-13', end: null },
    }));
    const result = validateSection('experience', experience);
    expect(!result.ok && result.errors[0]).toMatch(/^experience\[0\]\.period\.start:/);
  });

  it('rejects an empty section', () => {
    expect(validateSection('skills', []).ok).toBe(false);
  });
});
