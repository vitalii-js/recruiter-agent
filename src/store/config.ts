import { fileURLToPath } from 'node:url';
import { FailingSource, FsSource, S3Source, type ProfileSource, type S3Like } from './sources.js';

// Chooses the profile source from the environment (design D6, spec "Source selection").

export const DEFAULT_PREFIX = 'profile/';
// Resolves to <repo>/data/profile/ from both src/store/ and dist/store/.
export const DEFAULT_DIR = fileURLToPath(new URL('../../data/profile/', import.meta.url));

export type SourceConfig =
  | { kind: 's3'; bucket: string; prefix: string }
  | { kind: 'fs'; dir: string }
  | { kind: 'invalid'; code: string };

type Env = Record<string, string | undefined>;

const nonEmpty = (value: string | undefined): string | undefined =>
  value !== undefined && value.trim() !== '' ? value.trim() : undefined;

export function resolveSourceConfig(env: Env): SourceConfig {
  const bucket = nonEmpty(env.PROFILE_BUCKET);
  if (bucket) {
    return { kind: 's3', bucket, prefix: env.PROFILE_PREFIX ?? DEFAULT_PREFIX };
  }
  if (nonEmpty(env.AWS_LAMBDA_FUNCTION_NAME)) {
    // On Lambda without a bucket: fail closed instead of serving files bundled with the code.
    return { kind: 'invalid', code: 'CONFIG_MISSING_BUCKET' };
  }
  return { kind: 'fs', dir: nonEmpty(env.PROFILE_DIR) ?? DEFAULT_DIR };
}

export function createSource(config: SourceConfig, s3: () => S3Like): ProfileSource {
  switch (config.kind) {
    case 's3':
      return new S3Source(s3(), config.bucket, config.prefix);
    case 'fs':
      return new FsSource(config.dir);
    case 'invalid':
      return new FailingSource(config.code);
  }
}
