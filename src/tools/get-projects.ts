import { z } from 'zod';
import { expandTerm, sameTerm } from '../match/terms.js';
import { projectSchema, type Profile, type Project } from '../profile/schema.js';
import { defineTool, TERM_HINT } from './define.js';
import { found, notFound, outputSchemaFor, termSchema, type Outcome } from './result.js';

export const getProjectsInput = z.strictObject({
  technology: termSchema.optional(),
});

export type GetProjectsInput = z.output<typeof getProjectsInput>;

export function getProjects(profile: Profile, input: GetProjectsInput): Outcome<Project> {
  const { technology } = input;
  if (technology === undefined) return found(profile.projects);

  const terms = expandTerm(profile.skills, technology);
  const projects = profile.projects.filter((project) =>
    project.tech.some((tech) => terms.some((term) => sameTerm(tech, term))),
  );
  if (projects.length > 0) return found(projects, technology);
  return notFound(
    technology,
    `No project in the profile uses "${technology}". Try search_experience for a free-text search.`,
  );
}

export const getProjectsTool = defineTool({
  name: 'get_projects',
  description:
    "Lists the engineer's projects with employer, role, period, tech and outcomes. Optional " +
    `"technology" returns only projects that use it (aliases work, for example "TS"). ${TERM_HINT} ` +
    'Returns not_found when no project uses the technology.',
  inputSchema: getProjectsInput,
  outputSchema: outputSchemaFor(projectSchema),
  handler: getProjects,
});
