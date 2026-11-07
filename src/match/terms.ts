import type { Skill } from '../profile/schema.js';

// Term matching for the MCP tools (design D2). A query is always searched for inside profile
// data, never the other way round, so "React Native" cannot match the skill "React".

/** Trims a term and collapses inner whitespace. Case is handled by the matchers. */
export function normalizeTerm(term: string): string {
  return term.trim().replace(/\s+/g, ' ');
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True when `term` occurs in `text` as a whole word (or phrase), ignoring case. */
export function containsTerm(text: string, term: string): boolean {
  const pattern = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`, 'i');
  return pattern.test(text);
}

/** Case-insensitive equality, used for exact name and alias lookups. */
export function sameTerm(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** The skill whose name or one of whose aliases equals `term`, if any. */
export function findSkill(skills: readonly Skill[], term: string): Skill | undefined {
  const wanted = normalizeTerm(term);
  return skills.find((skill) => [skill.name, ...skill.aliases].some((n) => sameTerm(n, wanted)));
}

/**
 * The terms to search for. A known skill name or alias expands to the canonical name plus all
 * aliases; any other term is searched as-is.
 */
export function expandTerm(skills: readonly Skill[], term: string): string[] {
  const skill = findSkill(skills, term);
  return skill ? [skill.name, ...skill.aliases] : [normalizeTerm(term)];
}

/** True when any of `terms` occurs in `text` as a whole word or phrase. */
export function containsAny(text: string, terms: readonly string[]): boolean {
  return terms.some((term) => containsTerm(text, term));
}
