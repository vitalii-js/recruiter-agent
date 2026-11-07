import { describe, expect, it } from 'vitest';
import type { Logger } from '../../src/log.js';
import { SERVER_INSTRUCTIONS } from '../../src/server/create-server.js';
import { createHttpHandler, type HttpHandler } from '../../src/server/http-handler.js';
import { ProfileUnavailableError } from '../../src/store/profile-store.js';
import { committedProfile } from '../tools/committed-profile.js';

const profile = committedProfile();
const silent: Logger = () => undefined;
const goodHandler = createHttpHandler({
  store: { get: () => Promise.resolve(profile) },
  log: silent,
});

const HEADERS = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
};

const post = (body: unknown, path = '/mcp') =>
  new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: HEADERS,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

interface RpcResponse {
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

async function rpc(handler: HttpHandler, method: string, params?: unknown) {
  const response = await handler(post({ jsonrpc: '2.0', id: 1, method, params }));
  return { response, body: (await response.json()) as RpcResponse };
}

const call = (handler: HttpHandler, name: string, args: unknown) =>
  rpc(handler, 'tools/call', { name, arguments: args });

describe('MCP over HTTP', () => {
  it('initialize returns instructions as JSON and no session id', async () => {
    const { response, body } = await rpc(goodHandler, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
    expect(response.headers.get('mcp-session-id')).toBeNull();
    expect(body.result).toMatchObject({
      serverInfo: { name: 'recruiter-agent' },
      instructions: SERVER_INSTRUCTIONS,
    });
    expect(SERVER_INSTRUCTIONS).toMatch(/fictional/);
    expect(SERVER_INSTRUCTIONS).toMatch(/only from the results/);
    expect(SERVER_INSTRUCTIONS).toMatch(/not_found/);
  });

  it('tools/list returns the four tools with input and output schemas', async () => {
    const { body } = await rpc(goodHandler, 'tools/list');
    const tools = body.result?.tools as {
      name: string;
      inputSchema: unknown;
      outputSchema: unknown;
    }[];
    expect(tools.map((t) => t.name)).toEqual([
      'get_summary',
      'get_skills',
      'get_projects',
      'search_experience',
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
      expect(tool.outputSchema).toMatchObject({ type: 'object' });
    }
  });

  it('tools/call works without a prior initialize (stateless)', async () => {
    const { body } = await call(goodHandler, 'get_skills', { query: 'Postgres' });
    expect(body.result?.isError).toBe(false);
    expect(body.result?.structuredContent).toMatchObject({
      status: 'found',
      items: [{ name: 'PostgreSQL' }],
    });
  });

  it('tools/call returns not_found as a normal result', async () => {
    const { body } = await call(goodHandler, 'search_experience', { query: 'Kubernetes' });
    expect(body.result?.isError).toBe(false);
    expect(body.result?.structuredContent).toMatchObject({
      status: 'not_found',
      query: 'Kubernetes',
    });
    const content = body.result?.content as { text: string }[];
    expect(content[0]?.text).toMatch(/no information about "Kubernetes".*do not infer or guess/i);
  });

  it('rejects invalid input', async () => {
    for (const [name, args] of [
      ['search_experience', { query: '   ' }],
      ['get_skills', { query: 'a'.repeat(101) }],
      ['get_projects', { technology: 'Terraform', salary: 'x' }],
      ['get_skills', { category: 'mobile' }],
    ] as const) {
      const { body } = await call(goodHandler, name, args);
      expect(body.result?.isError).toBe(true);
      const content = body.result?.content as { text: string }[];
      expect(content[0]?.text).toMatch(/invalid/i);
    }
  });
});

describe('HTTP checks', () => {
  it('returns 404 for other paths', async () => {
    expect((await goodHandler(post({}, '/'))).status).toBe(404);
    expect((await goodHandler(post({}, '/mcp/x'))).status).toBe(404);
  });

  it.each(['GET', 'DELETE'])('returns 405 for %s without opening a stream', async (method) => {
    const response = await goodHandler(
      new Request('http://localhost/mcp', { method, headers: { accept: 'text/event-stream' } }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('POST');
    expect(response.headers.get('content-type')).toMatch(/application\/json/);
  });

  it('returns 413 when Content-Length is over the limit', async () => {
    const request = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { ...HEADERS, 'content-length': String(64 * 1024 + 1) },
      body: '{}',
    });
    expect((await goodHandler(request)).status).toBe(413);
  });

  it('returns 413 when the body is over the limit without a Content-Length', async () => {
    const big = new TextEncoder().encode(`"${'x'.repeat(64 * 1024)}"`);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(big);
        controller.close();
      },
    });
    const request = new Request('http://localhost/mcp', {
      method: 'POST',
      headers: HEADERS,
      body: stream,
      duplex: 'half',
    });
    expect((await goodHandler(request)).status).toBe(413);
  });

  it('accepts a body just under the limit', async () => {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
      params: { _meta: { pad: 'x'.repeat(60 * 1024) } },
    });
    expect((await goodHandler(post(body))).status).toBe(200);
  });
});

describe('profile unavailable', () => {
  const leaky = new Error('AccessDenied s3://secret-bucket/profile/skills.json at /var/task/x.js');

  it.each([
    ['ProfileUnavailableError', new ProfileUnavailableError()],
    ['an unexpected error', leaky],
  ])('returns only the generic message for %s', async (_label, error) => {
    const logs: unknown[] = [];
    const handler = createHttpHandler({
      store: { get: () => Promise.reject(error) },
      log: (...args) => logs.push(args),
    });
    const { response, body } = await call(handler, 'get_summary', {});
    const raw = JSON.stringify(body);
    expect(response.status).toBe(200);
    expect(body.result).toEqual({
      content: [{ type: 'text', text: 'The profile is temporarily unavailable.' }],
      isError: true,
    });
    expect(raw).not.toMatch(/secret-bucket|\/var\/task|AccessDenied|stack/);
  });
});
