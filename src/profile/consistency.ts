import type { Profile } from './schema.js';

export interface ConsistencyIssue {
  /** Where the problem is, for example `projects[2].tech[1]`. */
  path: string;
  message: string;
}

const normalize = (term: string): string => term.trim().toLowerCase();

/**
 * Cross-section checks that a per-section schema cannot express.
 * Returns an empty list when the profile is consistent.
 */
export function checkConsistency(profile: Profile): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  // Every skill name and alias must point to exactly one skill.
  const owners = new Map<string, string>();
  profile.skills.forEach((skill, i) => {
    [skill.name, ...skill.aliases].forEach((term, j) => {
      const key = normalize(term);
      const owner = owners.get(key);
      if (owner !== undefined && owner !== skill.name) {
        const path = j === 0 ? `skills[${i}].name` : `skills[${i}].aliases[${j - 1}]`;
        issues.push({ path, message: `"${term}" is already used by skill "${owner}"` });
      } else {
        owners.set(key, skill.name);
      }
    });
  });

  profile.skills.forEach((skill, i) => {
    if (skill.years > profile.summary.yearsOfExperience) {
      issues.push({
        path: `skills[${i}].years`,
        message: `"${skill.name}" claims ${skill.years} years, more than the total of ${profile.summary.yearsOfExperience}`,
      });
    }
  });

  const checkTech = (section: 'projects' | 'experience', label: string[], tech: string[][]) => {
    tech.forEach((list, i) => {
      list.forEach((term, j) => {
        if (!owners.has(normalize(term))) {
          issues.push({
            path: `${section}[${i}].tech[${j}]`,
            message: `"${label[i] ?? ''}" uses "${term}", which is not a listed skill or alias`,
          });
        }
      });
    });
  };
  checkTech(
    'projects',
    profile.projects.map((p) => p.name),
    profile.projects.map((p) => p.tech),
  );
  checkTech(
    'experience',
    profile.experience.map((e) => `${e.company} (${e.title})`),
    profile.experience.map((e) => e.tech),
  );

  const seenIds = new Set<string>();
  profile.projects.forEach((project, i) => {
    if (seenIds.has(project.id)) {
      issues.push({ path: `projects[${i}].id`, message: `duplicate project id "${project.id}"` });
    }
    seenIds.add(project.id);
  });

  return issues;
}
