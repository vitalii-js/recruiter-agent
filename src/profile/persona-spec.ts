// Reads the machine-checkable parts of specs/persona.md: the "Not in profile" lists and the
// project and experience headings. See design D4/D5 of the persona-profile change.

import { containsTerm } from '../match/terms.js';

export { containsTerm };

export interface AbsentEntry {
  name: string;
  terms: string[];
}

export interface AbsentLists {
  skills: AbsentEntry[];
  topics: AbsentEntry[];
}

export const ABSENT_SKILLS_HEADING = '## Not in profile: skills and technologies';
export const ABSENT_TOPICS_HEADING = '## Not in profile: topics';

const ENTRY_LINE = /^- (.+?) -- terms: (.+)$/;

function sectionLines(markdown: string, heading: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) {
    throw new Error(`Missing section "${heading}"`);
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,2} /.test(line));
  return end === -1 ? rest : rest.slice(0, end);
}

function parseEntries(markdown: string, heading: string): AbsentEntry[] {
  const entries = sectionLines(markdown, heading)
    .filter((line) => line.startsWith('- '))
    .map((line) => {
      const match = ENTRY_LINE.exec(line.trim());
      const terms = match?.[2]
        ?.split(',')
        .map((term) => term.trim())
        .filter(Boolean);
      if (!match?.[1] || !terms?.length) {
        throw new Error(`Malformed entry under "${heading}": ${line}`);
      }
      return { name: match[1].trim(), terms };
    });
  if (entries.length === 0) {
    throw new Error(`Section "${heading}" has no entries`);
  }
  return entries;
}

export function parseAbsentLists(markdown: string): AbsentLists {
  return {
    skills: parseEntries(markdown, ABSENT_SKILLS_HEADING),
    topics: parseEntries(markdown, ABSENT_TOPICS_HEADING),
  };
}

/** Names from `### Project: <name>` or `### Experience: <name>` headings, in file order. */
export function parseHeadingNames(markdown: string, kind: 'Project' | 'Experience'): string[] {
  const pattern = new RegExp(`^### ${kind}: (.+)$`, 'gm');
  return [...markdown.matchAll(pattern)].map((match) => (match[1] ?? '').trim());
}

export interface TermHit {
  /** Path of the string that contains the term, for example `projects[1].summary`. */
  path: string;
  entry: string;
  term: string;
}

/** Finds every listed term in every string (keys included) of `value`. */
export function findTerms(value: unknown, entries: AbsentEntry[], root: string): TermHit[] {
  const hits: TermHit[] = [];
  const scan = (text: string, path: string) => {
    for (const entry of entries) {
      for (const term of entry.terms) {
        if (containsTerm(text, term)) hits.push({ path, entry: entry.name, term });
      }
    }
  };
  const walk = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      scan(node, path);
    } else if (Array.isArray(node)) {
      node.forEach((item, i) => {
        walk(item, `${path}[${i}]`);
      });
    } else if (node !== null && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        scan(key, `${path}.${key}`);
        walk(child, `${path}.${key}`);
      }
    }
  };
  walk(value, root);
  return hits;
}
