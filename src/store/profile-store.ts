import { log as defaultLog, type Logger } from '../log.js';
import { checkConsistency } from '../profile/consistency.js';
import {
  SECTION_NAMES,
  validateSection,
  type Profile,
  type SectionName,
} from '../profile/schema.js';
import { SourceError, type ProfileSource } from './sources.js';

// Loads, validates and caches the profile (design D6, spec "profile-store").

export const DEFAULT_TTL_MS = 5 * 60 * 1000;

/** Thrown to tools when no valid profile can be served. Carries no details. */
export class ProfileUnavailableError extends Error {
  constructor() {
    super('The profile is temporarily unavailable.');
    this.name = 'ProfileUnavailableError';
  }
}

/** Why a load failed. Details are for logs only. */
export class ProfileLoadError extends Error {
  constructor(
    readonly section: SectionName | undefined,
    readonly code: string,
    readonly errors: string[] = [],
    options?: ErrorOptions,
  ) {
    super(`Profile load failed (${section ?? '*'}): ${code}`, options);
    this.name = 'ProfileLoadError';
  }
}

async function readSection(source: ProfileSource, section: SectionName): Promise<unknown> {
  let raw: string;
  try {
    raw = await source.read(section);
  } catch (error) {
    const code = error instanceof SourceError ? error.code : 'READ_FAILED';
    throw new ProfileLoadError(section, code, [], { cause: error });
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new ProfileLoadError(section, 'INVALID_JSON', [], { cause: error });
  }
  const result = validateSection(section, data);
  if (!result.ok) throw new ProfileLoadError(section, 'SCHEMA_INVALID', result.errors);
  return result.value;
}

/** Reads all four sections in parallel and validates them. Never returns a partial profile. */
export async function loadProfile(source: ProfileSource): Promise<Profile> {
  const values = await Promise.all(SECTION_NAMES.map((name) => readSection(source, name)));
  const profile = Object.fromEntries(
    SECTION_NAMES.map((name, i) => [name, values[i]]),
  ) as unknown as Profile;
  const issues = checkConsistency(profile);
  if (issues.length > 0) {
    throw new ProfileLoadError(
      undefined,
      'INCONSISTENT',
      issues.map((issue) => `${issue.path}: ${issue.message}`),
    );
  }
  return profile;
}

export interface ProfileStoreOptions {
  source: ProfileSource;
  ttlMs?: number;
  now?: () => number;
  log?: Logger;
}

export class ProfileStore {
  private readonly source: ProfileSource;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly log: Logger;
  private cached: { profile: Profile; loadedAt: number } | undefined;
  private inflight: Promise<Profile> | undefined;

  constructor(options: ProfileStoreOptions) {
    this.source = options.source;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? Date.now;
    this.log = options.log ?? defaultLog;
  }

  /** The current profile. Rejects with ProfileUnavailableError when none can be served. */
  get(): Promise<Profile> {
    if (this.cached && this.now() - this.cached.loadedAt < this.ttlMs) {
      return Promise.resolve(this.cached.profile);
    }
    this.inflight ??= this.reload().finally(() => {
      this.inflight = undefined;
    });
    return this.inflight;
  }

  private async reload(): Promise<Profile> {
    try {
      const profile = await loadProfile(this.source);
      this.cached = { profile, loadedAt: this.now() };
      return profile;
    } catch (error) {
      const details =
        error instanceof ProfileLoadError
          ? { section: error.section, code: error.code, errors: error.errors }
          : { code: 'UNEXPECTED' };
      this.log('error', 'profile_load_failed', {
        ...details,
        servingLastGood: this.cached !== undefined,
      });
      if (this.cached) {
        // Keep serving the last validated profile; retry after another TTL.
        this.cached = { profile: this.cached.profile, loadedAt: this.now() };
        return this.cached.profile;
      }
      throw new ProfileUnavailableError();
    }
  }
}
