import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { SECTION_NAMES, type SectionName } from '../profile/schema.js';

// Where profile sections are read from (design D6). Object names are always one of the four fixed
// section names; they are never built from tool input.

export interface ProfileSource {
  read(section: SectionName): Promise<string>;
}

/** A read failure with the section and a short error code, for logs only. */
export class SourceError extends Error {
  constructor(
    readonly section: SectionName | undefined,
    readonly code: string,
    options?: ErrorOptions,
  ) {
    super(`Cannot read profile section "${section ?? '*'}": ${code}`, options);
    this.name = 'SourceError';
  }
}

function assertSection(section: SectionName): void {
  if (!SECTION_NAMES.includes(section)) {
    throw new SourceError(undefined, 'UNKNOWN_SECTION');
  }
}

function errorCode(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
    if (error.name && error.name !== 'Error') return error.name;
  }
  return fallback;
}

export class FsSource implements ProfileSource {
  constructor(private readonly dir: string) {}

  async read(section: SectionName): Promise<string> {
    assertSection(section);
    try {
      return await readFile(join(this.dir, `${section}.json`), 'utf8');
    } catch (error) {
      throw new SourceError(section, errorCode(error, 'READ_FAILED'), { cause: error });
    }
  }
}

/** The part of the S3 client this source uses, so tests can pass a fake. */
export interface S3Like {
  send(command: GetObjectCommand): Promise<{ Body?: { transformToString(): Promise<string> } }>;
}

export class S3Source implements ProfileSource {
  constructor(
    private readonly client: S3Like,
    private readonly bucket: string,
    private readonly prefix: string,
  ) {}

  async read(section: SectionName): Promise<string> {
    assertSection(section);
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: `${this.prefix}${section}.json` }),
      );
      if (!response.Body) throw new SourceError(section, 'EMPTY_BODY');
      return await response.Body.transformToString();
    } catch (error) {
      if (error instanceof SourceError) throw error;
      throw new SourceError(section, errorCode(error, 'S3_ERROR'), { cause: error });
    }
  }
}

/** A source that always fails, used when the configuration is invalid (fail closed). */
export class FailingSource implements ProfileSource {
  constructor(private readonly code: string) {}

  read(): Promise<string> {
    return Promise.reject(new SourceError(undefined, this.code));
  }
}
