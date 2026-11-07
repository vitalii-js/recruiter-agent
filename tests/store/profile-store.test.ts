import { describe, expect, it } from 'vitest';
import type { Logger } from '../../src/log.js';
import type { SectionName } from '../../src/profile/schema.js';
import {
  DEFAULT_TTL_MS,
  ProfileStore,
  ProfileUnavailableError,
} from '../../src/store/profile-store.js';
import { SourceError, type ProfileSource } from '../../src/store/sources.js';
import { committedProfile } from '../tools/committed-profile.js';

type Files = Record<SectionName, string | Error>;

const goodFiles = (): Files => {
  const p = committedProfile();
  return {
    summary: JSON.stringify(p.summary),
    skills: JSON.stringify(p.skills),
    projects: JSON.stringify(p.projects),
    experience: JSON.stringify(p.experience),
  };
};

/** An in-memory source whose files can be changed between calls. Counts reads. */
function memorySource(files: Files) {
  const state = { files, reads: 0 };
  const source: ProfileSource = {
    read(section) {
      state.reads++;
      const value = state.files[section];
      return value instanceof Error ? Promise.reject(value) : Promise.resolve(value);
    },
  };
  return { source, state };
}

function setup(files: Files = goodFiles()) {
  const { source, state } = memorySource(files);
  const clock = { now: 1_000_000 };
  const logs: { level: string; event: string; fields: Record<string, unknown> | undefined }[] = [];
  const log: Logger = (level, event, fields) => logs.push({ level, event, fields });
  const store = new ProfileStore({ source, now: () => clock.now, log });
  return { store, state, clock, logs };
}

describe('ProfileStore', () => {
  it('serves a valid profile', async () => {
    const { store } = setup();
    const profile = await store.get();
    expect(profile.summary.fictional).toBe(true);
    expect(profile.skills.length).toBeGreaterThan(0);
  });

  it('reads storage once for calls within the TTL', async () => {
    const { store, state, clock } = setup();
    await store.get();
    clock.now += DEFAULT_TTL_MS - 1;
    await store.get();
    expect(state.reads).toBe(4);
  });

  it('reloads after the TTL and serves the new data', async () => {
    const { store, state, clock } = setup();
    await store.get();
    const summary = { ...committedProfile().summary, headline: 'Updated headline.' };
    state.files.summary = JSON.stringify(summary);
    clock.now += DEFAULT_TTL_MS;
    expect((await store.get()).summary.headline).toBe('Updated headline.');
    expect(state.reads).toBe(8);
  });

  it('shares one load between concurrent cold-start calls', async () => {
    const { store, state } = setup();
    const results = await Promise.all([store.get(), store.get(), store.get()]);
    expect(state.reads).toBe(4);
    expect(results[1]).toBe(results[0]);
    expect(results[2]).toBe(results[0]);
  });

  it('fails when a section has an unknown field, logging the path but not exposing it', async () => {
    const files = goodFiles();
    const skills = JSON.parse(files.skills as string) as Record<string, unknown>[];
    skills[0] = { ...skills[0], salary: 1 };
    files.skills = JSON.stringify(skills);
    const { store, logs } = setup(files);

    const error = await store.get().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProfileUnavailableError);
    expect((error as Error).message).toBe('The profile is temporarily unavailable.');
    expect(logs).toEqual([
      expect.objectContaining({
        level: 'error',
        event: 'profile_load_failed',
        fields: expect.objectContaining({
          section: 'skills',
          code: 'SCHEMA_INVALID',
          errors: ['skills[0].salary: unknown field'],
        }) as unknown,
      }),
    ]);
  });

  it('fails when a section is missing', async () => {
    const files = goodFiles();
    files.projects = new SourceError('projects', 'NoSuchKey');
    const { store, logs } = setup(files);
    await expect(store.get()).rejects.toBeInstanceOf(ProfileUnavailableError);
    expect(logs[0]?.fields).toMatchObject({ section: 'projects', code: 'NoSuchKey' });
  });

  it('fails on invalid JSON', async () => {
    const files = goodFiles();
    files.experience = '{not json';
    const { store, logs } = setup(files);
    await expect(store.get()).rejects.toBeInstanceOf(ProfileUnavailableError);
    expect(logs[0]?.fields).toMatchObject({ section: 'experience', code: 'INVALID_JSON' });
  });

  it('fails when sections are inconsistent', async () => {
    const files = goodFiles();
    const projects = JSON.parse(files.projects as string) as { tech: string[] }[];
    projects[0]?.tech.push('Unlisted Tech');
    files.projects = JSON.stringify(projects);
    const { store, logs } = setup(files);
    await expect(store.get()).rejects.toBeInstanceOf(ProfileUnavailableError);
    expect(logs[0]?.fields).toMatchObject({ code: 'INCONSISTENT' });
  });

  it('keeps serving the last good profile when a reload hits a storage error', async () => {
    const { store, state, clock, logs } = setup();
    const first = await store.get();
    state.files.skills = new SourceError('skills', 'AccessDenied');
    clock.now += DEFAULT_TTL_MS;
    expect(await store.get()).toBe(first);
    expect(logs[0]?.fields).toMatchObject({
      section: 'skills',
      code: 'AccessDenied',
      servingLastGood: true,
    });
  });

  it('never serves invalid data after a good load', async () => {
    const { store, state, clock } = setup();
    const first = await store.get();
    state.files.summary = JSON.stringify({ ...first.summary, fictional: false });
    clock.now += DEFAULT_TTL_MS;
    const served = await store.get();
    expect(served).toBe(first);
    expect(served.summary.fictional).toBe(true);
  });

  it('retries after a failed cold load', async () => {
    const files = goodFiles();
    const good = files.summary;
    files.summary = new SourceError('summary', 'AccessDenied');
    const { store, state } = setup(files);
    await expect(store.get()).rejects.toBeInstanceOf(ProfileUnavailableError);
    state.files.summary = good;
    expect((await store.get()).summary.fictional).toBe(true);
  });
});
