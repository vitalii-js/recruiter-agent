import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkConsistency } from '../../src/profile/consistency.js';
import { SECTION_NAMES, validateSection, type Profile } from '../../src/profile/schema.js';

const DATA_DIR = fileURLToPath(new URL('../../data/profile/', import.meta.url));

/** The committed profile, loaded through the real validation path. */
export function committedProfile(): Profile {
  const sections: Partial<Record<string, unknown>> = {};
  for (const name of SECTION_NAMES) {
    const result = validateSection(
      name,
      JSON.parse(readFileSync(`${DATA_DIR}${name}.json`, 'utf8')) as unknown,
    );
    if (!result.ok) throw new Error(result.errors.join('\n'));
    sections[name] = result.value;
  }
  const profile = sections as unknown as Profile;
  const issues = checkConsistency(profile);
  if (issues.length > 0) throw new Error(JSON.stringify(issues));
  return profile;
}
