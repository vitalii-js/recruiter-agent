import { z } from 'zod';
import { findSkill } from '../match/terms.js';
import { skillCategorySchema, skillSchema, type Profile, type Skill } from '../profile/schema.js';
import { defineTool, TERM_HINT } from './define.js';
import { found, notFound, outputSchemaFor, termSchema, type Outcome } from './result.js';

export const getSkillsInput = z.strictObject({
  query: termSchema.optional(),
  category: skillCategorySchema.optional(),
});

export type GetSkillsInput = z.output<typeof getSkillsInput>;

export function getSkills(profile: Profile, input: GetSkillsInput): Outcome<Skill> {
  const { query, category } = input;
  let skills = category ? profile.skills.filter((s) => s.category === category) : profile.skills;
  if (query !== undefined) {
    const skill = findSkill(profile.skills, query);
    skills = skill && skills.includes(skill) ? [skill] : [];
  }
  if (skills.length > 0) return found(skills, query);

  const inCategory = category ? ` in category "${category}"` : '';
  const message =
    query !== undefined
      ? `No skill named "${query}"${inCategory} is in the profile. Try search_experience for a free-text search.`
      : `The profile has no skills${inCategory}.`;
  return notFound(query ?? category ?? '', message);
}

export const getSkillsTool = defineTool({
  name: 'get_skills',
  description:
    'Lists the engineer\'s skills with category, years and level. Optional "query" matches a skill ' +
    `name or alias exactly (for example "Postgres"). ${TERM_HINT} Optional "category" filters by ` +
    'category. Returns not_found when the profile has no such skill.',
  inputSchema: getSkillsInput,
  outputSchema: outputSchemaFor(skillSchema),
  handler: getSkills,
});
