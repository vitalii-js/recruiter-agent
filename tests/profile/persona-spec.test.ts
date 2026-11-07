import { describe, expect, it } from 'vitest';
import {
  containsTerm,
  findTerms,
  parseAbsentLists,
  parseHeadingNames,
} from '../../src/profile/persona-spec.js';

const SAMPLE = `# Persona

## Work experience

### Experience: Acme Travel

- **Title:** Engineer

### Experience: Acme Travel

## Projects

### Project: Fare Cache

### Project: Booking API

## Not in profile: skills and technologies

Intro text is ignored.

- Kubernetes -- terms: Kubernetes, k8s
- Go -- terms: Golang

## Not in profile: topics

- Salary -- terms: salary, hourly rate
`;

describe('parseAbsentLists', () => {
  it('parses both lists', () => {
    expect(parseAbsentLists(SAMPLE)).toEqual({
      skills: [
        { name: 'Kubernetes', terms: ['Kubernetes', 'k8s'] },
        { name: 'Go', terms: ['Golang'] },
      ],
      topics: [{ name: 'Salary', terms: ['salary', 'hourly rate'] }],
    });
  });

  it('fails when a section is missing', () => {
    const markdown = SAMPLE.replace('## Not in profile: topics', '## Other');
    expect(() => parseAbsentLists(markdown)).toThrow('Missing section "## Not in profile: topics"');
  });

  it('fails on a malformed entry', () => {
    const markdown = SAMPLE.replace('- Go -- terms: Golang', '- Go (Golang)');
    expect(() => parseAbsentLists(markdown)).toThrow('Malformed entry');
  });

  it('fails when a section has no entries', () => {
    const markdown = SAMPLE.replace('- Salary -- terms: salary, hourly rate', '');
    expect(() => parseAbsentLists(markdown)).toThrow('has no entries');
  });
});

describe('parseHeadingNames', () => {
  it('returns project names in order', () => {
    expect(parseHeadingNames(SAMPLE, 'Project')).toEqual(['Fare Cache', 'Booking API']);
  });

  it('keeps repeated experience headings', () => {
    expect(parseHeadingNames(SAMPLE, 'Experience')).toEqual(['Acme Travel', 'Acme Travel']);
  });
});

describe('containsTerm', () => {
  it.each([
    ['Runs on Kubernetes.', 'kubernetes'],
    ['Paid an hourly rate', 'hourly rate'],
    ['Uses k8s-based tooling', 'k8s'],
  ])('finds the term in %j', (text, term) => {
    expect(containsTerm(text, term)).toBe(true);
  });

  it.each([
    ['JavaScript', 'Java'],
    ['Built a trusted service', 'Rust'],
    ['React admin screens', 'React Native'],
    ['Lets us go faster', 'Golang'],
  ])('does not find a partial word in %j', (text, term) => {
    expect(containsTerm(text, term)).toBe(false);
  });

  it('treats special characters in terms literally', () => {
    expect(containsTerm('Uses C++ daily', 'C++')).toBe(true);
    expect(containsTerm('Uses Cxx daily', 'C++')).toBe(false);
  });
});

describe('findTerms', () => {
  it('reports every hit with its path, including object keys', () => {
    const data = { items: [{ text: 'Moved to Kubernetes' }], salary: 'x' };
    const lists = parseAbsentLists(SAMPLE);
    expect(findTerms(data, [...lists.skills, ...lists.topics], 'profile')).toEqual([
      { path: 'profile.items[0].text', entry: 'Kubernetes', term: 'Kubernetes' },
      { path: 'profile.salary', entry: 'Salary', term: 'salary' },
    ]);
  });

  it('returns nothing for clean data', () => {
    expect(findTerms({ a: ['TypeScript', 1, null] }, parseAbsentLists(SAMPLE).skills, 'x')).toEqual(
      [],
    );
  });
});
