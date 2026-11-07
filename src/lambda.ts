import { S3Client } from '@aws-sdk/client-s3';
import { log } from './log.js';
import { createHttpHandler, type HttpHandler } from './server/http-handler.js';
import { createSource, resolveSourceConfig } from './store/config.js';
import { ProfileStore } from './store/profile-store.js';

// AWS Lambda Function URL entry point (design D5): event -> Request -> handler -> result.

/** The parts of a Function URL (payload format 2.0) event this adapter uses. */
export interface FunctionUrlEvent {
  rawPath: string;
  rawQueryString?: string;
  headers?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  requestContext: { domainName?: string; http: { method: string } };
}

export interface FunctionUrlResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: false;
}

export function toRequest(event: FunctionUrlEvent): Request {
  const host = event.requestContext.domainName ?? 'localhost';
  const query = event.rawQueryString ? `?${event.rawQueryString}` : '';
  const headers = new Headers();
  for (const [name, value] of Object.entries(event.headers ?? {})) {
    if (value !== undefined) headers.set(name, value);
  }
  const method = event.requestContext.http.method.toUpperCase();
  const hasBody = event.body !== undefined && method !== 'GET' && method !== 'HEAD';
  return new Request(`https://${host}${event.rawPath}${query}`, {
    method,
    headers,
    body: hasBody ? Buffer.from(event.body ?? '', event.isBase64Encoded ? 'base64' : 'utf8') : null,
  });
}

export async function toResult(response: Response): Promise<FunctionUrlResult> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  return {
    statusCode: response.status,
    headers,
    body: await response.text(),
    isBase64Encoded: false,
  };
}

let httpHandler: HttpHandler | undefined;

/** Created once per container, so the profile cache survives between invocations. */
function getHttpHandler(): HttpHandler {
  httpHandler ??= createHttpHandler({
    store: new ProfileStore({
      source: createSource(resolveSourceConfig(process.env), () => new S3Client({})),
    }),
  });
  return httpHandler;
}

export async function handler(event: FunctionUrlEvent): Promise<FunctionUrlResult> {
  try {
    return await toResult(await getHttpHandler()(toRequest(event)));
  } catch (error) {
    log('error', 'request_failed', { error: (error as Error).name });
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: null,
      }),
      isBase64Encoded: false,
    };
  }
}
