import { describe, expect, it } from 'vitest';
import {
  containsAny,
  containsTerm,
  expandTerm,
  findSkill,
  normalizeTerm,
  sameTerm,
} from '../../src/match/terms.js';
import type { Skill } from '../../src/profile/schema.js';

const skills: Skill[] = [
  { name: 'TypeScript', category: 'language', years: 8, aliases: ['TS'] },
  { name: 'JavaScript', category: 'language', years: 8, aliases: ['JS'] },
  { name: 'React', category: 'framework', years: 2, aliases: ['React.js'] },
  { name: 'AWS Lambda', category: 'cloud', years: 5, aliases: ['Lambda'] },
];

describe('normalizeTerm', () => {
  it('trims and collapses inner whitespace', () => {
    expect(normalizeTerm('  React \t  Native \n')).toBe('React Native');
  });
});

describe('sameTerm', () => {
  it('ignores case only', () => {
    expect(sameTerm('typescript', 'TypeScript')).toBe(true);
    expect(sameTerm('TypeScript ', 'TypeScript')).toBe(false);
  });
});

describe('containsTerm', () => {
  it('matches whole words, ignoring case', () => {
    expect(containsTerm('Wrote typescript services', 'TypeScript')).toBe(true);
  });

  it('does not match a word inside a longer word (Java vs JavaScript)', () => {
    expect(containsTerm('Uses JavaScript and TypeScript', 'Java')).toBe(false);
  });

  it('matches the whole phrase, not any of its words (React Native vs React)', () => {
    expect(containsTerm('Built React admin screens', 'React Native')).toBe(false);
    expect(containsTerm('Built React Native apps', 'React Native')).toBe(true);
  });

  it('treats regex metacharacters in the term literally', () => {
    expect(containsTerm('Uses C++ daily', 'C++')).toBe(true);
    expect(containsTerm('Uses Cxx daily', 'C++')).toBe(false);
    expect(containsTerm('a.b', 'a.b')).toBe(true);
    expect(containsTerm('axb', 'a.b')).toBe(false);
    expect(containsTerm('anything', '.*')).toBe(false);
  });
});

describe('findSkill', () => {
  it('finds a skill by canonical name or alias, ignoring case and spacing', () => {
    expect(findSkill(skills, '  typescript ')?.name).toBe('TypeScript');
    expect(findSkill(skills, 'ts')?.name).toBe('TypeScript');
    expect(findSkill(skills, 'lambda')?.name).toBe('AWS Lambda');
  });

  it('does not match partial names', () => {
    expect(findSkill(skills, 'AWS')).toBeUndefined();
    expect(findSkill(skills, 'React Native')).toBeUndefined();
    expect(findSkill(skills, 'Java')).toBeUndefined();
  });
});

describe('expandTerm', () => {
  it('expands an alias to the canonical name and all aliases', () => {
    expect(expandTerm(skills, 'TS')).toEqual(['TypeScript', 'TS']);
  });

  it('expands a canonical name to itself and its aliases', () => {
    expect(expandTerm(skills, 'aws lambda')).toEqual(['AWS Lambda', 'Lambda']);
  });

  it('returns the normalized term when it is not a skill', () => {
    expect(expandTerm(skills, '  React   Native ')).toEqual(['React Native']);
  });
});

describe('containsAny', () => {
  it('is true when any expanded term occurs', () => {
    expect(containsAny('Moved to Lambda functions', expandTerm(skills, 'AWS Lambda'))).toBe(true);
    expect(containsAny('Built React screens', expandTerm(skills, 'React Native'))).toBe(false);
  });
});
