import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHttpHandler } from '../../src/server/http-handler.js';
import { createDevServer, isAllowedHost } from '../../src/server/node-adapter.js';
import { committedProfile } from '../tools/committed-profile.js';

describe('isAllowedHost', () => {
  it.each(['localhost:3000', '127.0.0.1:3000', 'LOCALHOST:3000'])('allows %s', (host) => {
    expect(isAllowedHost(host, 3000)).toBe(true);
  });

  it.each([
    undefined,
    '',
    'evil.example:3000',
    'localhost.evil.example:3000',
    '127.0.0.1:4000',
    'localhost',
    '0.0.0.0:3000',
  ])('rejects %s', (host) => {
    expect(isAllowedHost(host, 3000)).toBe(false);
  });
});

describe('dev server', () => {
  const profile = committedProfile();
  const server = createDevServer(
    createHttpHandler({ store: { get: () => Promise.resolve(profile) }, log: () => undefined }),
  );
  let port = 0;

  beforeAll(async () => {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  /** node:http sends the Host header exactly as given. */
  const send = (host: string) =>
    new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = request(
        {
          host: '127.0.0.1',
          port,
          path: '/mcp',
          method: 'POST',
          headers: {
            host,
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
          },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk: Buffer) => (body += chunk.toString()));
          res.on('end', () => {
            resolve({ status: res.statusCode ?? 0, body });
          });
        },
      );
      req.on('error', reject);
      req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }));
    });

  it('serves MCP for a localhost Host header', async () => {
    const response = await send(`localhost:${port}`);
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ result: { tools: expect.any(Array) as [] } });
  });

  it('rejects a foreign Host header (DNS rebinding)', async () => {
    const response = await send(`evil.example:${port}`);
    expect(response.status).toBe(403);
  });
});
