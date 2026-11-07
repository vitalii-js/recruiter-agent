import { z } from 'zod';
import { containsAny, expandTerm } from '../match/terms.js';
import {
  experienceEntrySchema,
  projectSchema,
  summarySchema,
  type ExperienceEntry,
  type Profile,
  type Project,
  type Summary,
} from '../profile/schema.js';
import { defineTool, TERM_HINT } from './define.js';
import { found, notFound, outputSchemaFor, termSchema, type Outcome } from './result.js';

export const searchExperienceInput = z.strictObject({
  query: termSchema,
});

export type SearchExperienceInput = z.output<typeof searchExperienceInput>;

export const searchHitSchema = z.discriminatedUnion('section', [
  z.object({
    section: z.literal('experience'),
    id: z.string(),
    matchedFields: z.array(z.string()),
    entry: experienceEntrySchema,
  }),
  z.object({
    section: z.literal('project'),
    id: z.string(),
    matchedFields: z.array(z.string()),
    entry: projectSchema,
  }),
  z.object({
    section: z.literal('summary'),
    id: z.string(),
    matchedFields: z.array(z.string()),
    entry: summarySchema,
  }),
]);

export type SearchHit = z.infer<typeof searchHitSchema>;

/** Searchable fields as [field path, text] pairs. Lists get one pair per element. */
type Fields = [string, string][];

const list = (name: string, values: readonly string[]): Fields =>
  values.map((value, i) => [`${name}[${i}]`, value]);

function experienceFields(e: ExperienceEntry): Fields {
  return [
    ['company', e.company],
    ['title', e.title],
    ['domain', e.domain],
    ...list('highlights', e.highlights),
    ...list('tech', e.tech),
  ];
}

function projectFields(p: Project): Fields {
  return [
    ['name', p.name],
    ['domain', p.domain],
    ['role', p.role],
    ['summary', p.summary],
    ...list('outcomes', p.outcomes),
    ...list('tech', p.tech),
  ];
}

function summaryFields(s: Summary): Fields {
  return [
    ['title', s.title],
    ['seniority', s.seniority],
    ['headline', s.headline],
    ...s.domains.flatMap((d, i): Fields => [
      [`domains[${i}].name`, d.name],
      [`domains[${i}].description`, d.description],
    ]),
    ...list('leadership', s.leadership),
  ];
}

function matched(fields: Fields, terms: readonly string[]): string[] {
  return fields.filter(([, text]) => containsAny(text, terms)).map(([path]) => path);
}

export function searchExperience(
  profile: Profile,
  input: SearchExperienceInput,
): Outcome<SearchHit> {
  const { query } = input;
  const terms = expandTerm(profile.skills, query);
  const hits: SearchHit[] = [];

  for (const entry of profile.experience) {
    const matchedFields = matched(experienceFields(entry), terms);
    if (matchedFields.length > 0) {
      hits.push({
        section: 'experience',
        id: `${entry.company} (${entry.title})`,
        matchedFields,
        entry,
      });
    }
  }
  for (const entry of profile.projects) {
    const matchedFields = matched(projectFields(entry), terms);
    if (matchedFields.length > 0) {
      hits.push({ section: 'project', id: entry.id, matchedFields, entry });
    }
  }
  const summaryMatches = matched(summaryFields(profile.summary), terms);
  if (summaryMatches.length > 0) {
    hits.push({
      section: 'summary',
      id: 'summary',
      matchedFields: summaryMatches,
      entry: profile.summary,
    });
  }

  if (hits.length > 0) return found(hits, query);
  return notFound(query, `The profile has no information about "${query}".`);
}

export const searchExperienceTool = defineTool({
  name: 'search_experience',
  description:
    'Free-text search across work experience, projects and the profile summary. Matches the whole ' +
    `term as a phrase, ignoring case; skill aliases are expanded. ${TERM_HINT} Each hit names its ` +
    'section, id and matched fields. Returns not_found when the profile does not mention the term.',
  inputSchema: searchExperienceInput,
  outputSchema: outputSchemaFor(searchHitSchema),
  handler: searchExperience,
});
