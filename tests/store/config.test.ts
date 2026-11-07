import { describe, expect, it } from 'vitest';
import {
  createSource,
  DEFAULT_DIR,
  DEFAULT_PREFIX,
  resolveSourceConfig,
} from '../../src/store/config.js';
import { FailingSource, FsSource, S3Source, type S3Like } from '../../src/store/sources.js';

const fakeS3: S3Like = { send: () => Promise.resolve({}) };

describe('resolveSourceConfig', () => {
  it('uses S3 when a bucket is set, with the default prefix', () => {
    expect(resolveSourceConfig({ PROFILE_BUCKET: 'b' })).toEqual({
      kind: 's3',
      bucket: 'b',
      prefix: DEFAULT_PREFIX,
    });
  });

  it('uses the configured prefix', () => {
    expect(resolveSourceConfig({ PROFILE_BUCKET: 'b', PROFILE_PREFIX: 'v2/' })).toMatchObject({
      prefix: 'v2/',
    });
  });

  it('uses S3 on Lambda when a bucket is set', () => {
    expect(
      resolveSourceConfig({ PROFILE_BUCKET: 'b', AWS_LAMBDA_FUNCTION_NAME: 'fn' }),
    ).toMatchObject({ kind: 's3' });
  });

  it('uses local files in development, with data/profile/ as the default', () => {
    expect(resolveSourceConfig({})).toEqual({ kind: 'fs', dir: DEFAULT_DIR });
    expect(DEFAULT_DIR).toMatch(/data[\\/]profile[\\/]$/);
  });

  it('honours PROFILE_DIR', () => {
    expect(resolveSourceConfig({ PROFILE_DIR: '/tmp/p' })).toEqual({ kind: 'fs', dir: '/tmp/p' });
  });

  it('treats an empty bucket as not set', () => {
    expect(resolveSourceConfig({ PROFILE_BUCKET: ' ' })).toMatchObject({ kind: 'fs' });
  });

  it('fails closed on Lambda without a bucket', () => {
    expect(resolveSourceConfig({ AWS_LAMBDA_FUNCTION_NAME: 'fn', PROFILE_DIR: '/x' })).toEqual({
      kind: 'invalid',
      code: 'CONFIG_MISSING_BUCKET',
    });
  });
});

describe('createSource', () => {
  it('builds the matching source', () => {
    expect(createSource({ kind: 's3', bucket: 'b', prefix: 'p/' }, () => fakeS3)).toBeInstanceOf(
      S3Source,
    );
    expect(createSource({ kind: 'fs', dir: '/x' }, () => fakeS3)).toBeInstanceOf(FsSource);
    expect(createSource({ kind: 'invalid', code: 'X' }, () => fakeS3)).toBeInstanceOf(
      FailingSource,
    );
  });
});
