import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handler, toRequest, toResult, type FunctionUrlEvent } from '../src/lambda.js';

const event = (overrides: Partial<FunctionUrlEvent> = {}): FunctionUrlEvent => ({
  rawPath: '/mcp',
  rawQueryString: '',
  headers: {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  },
  requestContext: { domainName: 'abc.lambda-url.eu-central-1.on.aws', http: { method: 'POST' } },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  isBase64Encoded: false,
  ...overrides,
});

describe('toRequest', () => {
  it('maps method, URL, headers and a plain body', async () => {
    const request = toRequest(event({ rawQueryString: 'a=1' }));
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://abc.lambda-url.eu-central-1.on.aws/mcp?a=1');
    expect(request.headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(await request.text())).toMatchObject({ method: 'tools/list' });
  });

  it('decodes a base64 body', async () => {
    const body = '{"jsonrpc":"2.0","id":2,"method":"tools/list"}';
    const request = toRequest(
      event({ body: Buffer.from(body).toString('base64'), isBase64Encoded: true }),
    );
    expect(await request.text()).toBe(body);
  });

  it('drops the body for GET', () => {
    const request = toRequest(event({ requestContext: { http: { method: 'GET' } } }));
    expect(request.method).toBe('GET');
    expect(request.body).toBeNull();
  });
});

describe('toResult', () => {
  it('maps status, headers and body', async () => {
    const result = await toResult(
      new Response('{"ok":true}', { status: 201, headers: { 'content-type': 'application/json' } }),
    );
    expect(result).toEqual({
      statusCode: 201,
      headers: { 'content-type': 'application/json' },
      body: '{"ok":true}',
      isBase64Encoded: false,
    });
  });
});

describe('handler', () => {
  beforeEach(() => {
    vi.stubEnv('PROFILE_BUCKET', '');
    vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('serves tools/list end to end from a Function URL event', async () => {
    const result = await handler(event());
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body) as { result: { tools: unknown[] } };
    expect(body.result.tools).toHaveLength(4);
  });

  it('serves a tool call from a base64 event', async () => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'get_skills', arguments: { query: 'TS' } },
    });
    const result = await handler(
      event({ body: Buffer.from(payload).toString('base64'), isBase64Encoded: true }),
    );
    expect(JSON.parse(result.body)).toMatchObject({
      result: { structuredContent: { status: 'found', items: [{ name: 'TypeScript' }] } },
    });
  });
});
