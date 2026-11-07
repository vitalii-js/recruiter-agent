import { z } from 'zod';

// Profile data contract. All objects are strict: an unknown field (for example `salary`) is a
// validation error, which keeps topics that are intentionally absent out of the profile.

const text = z.string().trim().min(1);
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM');

export const periodSchema = z
  .strictObject({
    start: yearMonth,
    end: yearMonth.nullable(), // null means "present"
  })
  .refine((period) => period.end === null || period.end >= period.start, {
    message: 'end must not be before start',
    path: ['end'],
  });

export const summarySchema = z.strictObject({
  name: text,
  fictional: z.literal(true),
  disclaimer: text,
  title: text,
  seniority: text,
  yearsOfExperience: z.int().positive(),
  headline: text,
  domains: z.array(z.strictObject({ name: text, description: text })).min(1),
  leadership: z.array(text),
  education: z.array(
    z.strictObject({
      degree: text,
      field: text,
      institution: text,
      graduationYear: z.int().min(1950).max(2100),
    }),
  ),
});

export const skillCategorySchema = z.enum([
  'language',
  'runtime',
  'framework',
  'cloud',
  'database',
  'infrastructure',
  'ci-cd',
  'testing',
  'practice',
]);

export const skillLevelSchema = z.enum(['expert', 'advanced', 'working']);

export const skillSchema = z.strictObject({
  name: text,
  category: skillCategorySchema,
  years: z.int().positive(),
  level: skillLevelSchema.optional(),
  aliases: z.array(text),
});

export const skillsSchema = z.array(skillSchema).min(1);

export const projectSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Expected a kebab-case id'),
  name: text,
  employer: text,
  domain: text,
  role: text,
  period: periodSchema,
  summary: text,
  tech: z.array(text).min(1),
  outcomes: z.array(text).min(1),
});

export const projectsSchema = z.array(projectSchema).min(1);

export const experienceEntrySchema = z.strictObject({
  company: text,
  title: text,
  domain: text,
  period: periodSchema,
  highlights: z.array(text).min(1),
  tech: z.array(text).min(1),
});

export const experienceSchema = z.array(experienceEntrySchema).min(1);

export const sectionSchemas = {
  summary: summarySchema,
  skills: skillsSchema,
  projects: projectsSchema,
  experience: experienceSchema,
} as const;

export type SectionName = keyof typeof sectionSchemas;
export const SECTION_NAMES = Object.keys(sectionSchemas) as SectionName[];

export type Summary = z.infer<typeof summarySchema>;
export type Skill = z.infer<typeof skillSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ExperienceEntry = z.infer<typeof experienceSchema>[number];

export interface Profile {
  summary: Summary;
  skills: Skill[];
  projects: Project[];
  experience: ExperienceEntry[];
}

export type SectionData = { [K in SectionName]: z.infer<(typeof sectionSchemas)[K]> };

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function formatPath(section: string, path: readonly PropertyKey[]): string {
  return path.reduce<string>(
    (acc, key) => (typeof key === 'number' ? `${acc}[${key}]` : `${acc}.${String(key)}`),
    section,
  );
}

/**
 * Validates one section. Each error starts with the full path of the invalid field,
 * for example `skills[3].years` or `summary.salary`.
 */
export function validateSection<K extends SectionName>(
  section: K,
  data: unknown,
): ValidationResult<SectionData[K]> {
  const result = sectionSchemas[section].safeParse(data);
  if (result.success) {
    return { ok: true, value: result.data as SectionData[K] };
  }
  const errors = result.error.issues.flatMap((issue) =>
    issue.code === 'unrecognized_keys'
      ? issue.keys.map((key) => `${formatPath(section, [...issue.path, key])}: unknown field`)
      : [`${formatPath(section, issue.path)}: ${issue.message}`],
  );
  return { ok: false, errors };
}
