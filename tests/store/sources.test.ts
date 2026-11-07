import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GetObjectCommand } from '@aws-sdk/client-s3';
import { afterAll, describe, expect, it } from 'vitest';
import type { SectionName } from '../../src/profile/schema.js';
import {
  FailingSource,
  FsSource,
  S3Source,
  SourceError,
  type S3Like,
} from '../../src/store/sources.js';

const dir = mkdtempSync(join(tmpdir(), 'profile-source-'));
writeFileSync(join(dir, 'skills.json'), '[1]');
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('FsSource', () => {
  it('reads <section>.json from its directory', async () => {
    expect(await new FsSource(dir).read('skills')).toBe('[1]');
  });

  it('a missing file becomes a SourceError with the section and code', async () => {
    await expect(new FsSource(dir).read('projects')).rejects.toMatchObject({
      name: 'SourceError',
      section: 'projects',
      code: 'ENOENT',
    });
  });

  it('refuses names that are not one of the four sections', async () => {
    await expect(new FsSource(dir).read('../secrets' as SectionName)).rejects.toMatchObject({
      code: 'UNKNOWN_SECTION',
    });
  });
});

function fakeS3(respond: (bucket: string, key: string) => string | Error) {
  const calls: { bucket: string; key: string }[] = [];
  const client: S3Like = {
    send(command: GetObjectCommand) {
      const bucket = command.input.Bucket ?? '';
      const key = command.input.Key ?? '';
      calls.push({ bucket, key });
      const result = respond(bucket, key);
      if (result instanceof Error) return Promise.reject(result);
      return Promise.resolve({ Body: { transformToString: () => Promise.resolve(result) } });
    },
  };
  return { client, calls };
}

const awsError = (name: string) => Object.assign(new Error('raw AWS message'), { name });

describe('S3Source', () => {
  it('reads <prefix><section>.json from the configured bucket', async () => {
    const { client, calls } = fakeS3(() => '{"ok":true}');
    expect(await new S3Source(client, 'my-bucket', 'profile/').read('summary')).toBe('{"ok":true}');
    expect(calls).toEqual([{ bucket: 'my-bucket', key: 'profile/summary.json' }]);
  });

  it.each(['NoSuchKey', 'AccessDenied'])('maps %s to a SourceError code', async (name) => {
    const { client } = fakeS3(() => awsError(name));
    const error = await new S3Source(client, 'b', 'p/').read('skills').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SourceError);
    expect(error).toMatchObject({ section: 'skills', code: name });
  });

  it('an empty body is an error', async () => {
    const client: S3Like = { send: () => Promise.resolve({}) };
    await expect(new S3Source(client, 'b', 'p/').read('skills')).rejects.toMatchObject({
      code: 'EMPTY_BODY',
    });
  });
});

describe('FailingSource', () => {
  it('always rejects with its code', async () => {
    await expect(new FailingSource('CONFIG_MISSING_BUCKET').read()).rejects.toMatchObject({
      code: 'CONFIG_MISSING_BUCKET',
    });
  });
});
