import { describe, expect, it } from 'vitest';
import { createSource, resolveSourceConfig } from '../../src/store/config.js';
import { ProfileStore } from '../../src/store/profile-store.js';

describe('committed profile data', () => {
  it('loads through the default local source and the store', async () => {
    const config = resolveSourceConfig({});
    expect(config.kind).toBe('fs');
    const source = createSource(config, () => {
      throw new Error('S3 must not be used locally');
    });
    const profile = await new ProfileStore({ source, log: () => undefined }).get();
    expect(profile.summary.fictional).toBe(true);
    expect(profile.projects.length).toBeGreaterThanOrEqual(4);
  });
});
