import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { log as defaultLog, type Logger } from '../log.js';
import { createMcpServer, type ProfileProvider } from './create-server.js';

// Web Request -> Response handler shared by the Lambda and local entry points (design D4).
// Path, method and size checks run before the MCP SDK sees the request.

export const MCP_PATH = '/mcp';
export const MAX_BODY_BYTES = 64 * 1024;

export interface HttpHandlerOptions {
  store: ProfileProvider;
  log?: Logger;
  maxBodyBytes?: number;
}

export type HttpHandler = (request: Request) => Promise<Response>;

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const jsonRpcError = (status: number, code: number, message: string) =>
  json(status, { jsonrpc: '2.0', error: { code, message }, id: null });

class BodyTooLargeError extends Error {}

/** Reads the body, stopping as soon as it exceeds `limit` bytes. */
async function readBody(request: Request, limit: number): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();
  const reader = (request.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function createHttpHandler(options: HttpHandlerOptions): HttpHandler {
  const log = options.log ?? defaultLog;
  const limit = options.maxBodyBytes ?? MAX_BODY_BYTES;

  return async (request) => {
    const { pathname } = new URL(request.url);
    if (pathname !== MCP_PATH) return json(404, { error: 'Not found' });
    if (request.method !== 'POST') {
      return json(405, { error: 'Method not allowed' }, { allow: 'POST' });
    }

    const declared = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > limit) {
      return jsonRpcError(413, -32600, 'Request body too large');
    }

    try {
      const body = await readBody(request, limit);
      const forwarded = new Request(request.url, {
        method: 'POST',
        headers: request.headers,
        body,
      });
      const server = createMcpServer(options.store, log);
      // No sessionIdGenerator: stateless mode, no Mcp-Session-Id is issued.
      const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
      try {
        await server.connect(transport);
        const response = await transport.handleRequest(forwarded);
        // Buffer the body before closing the per-request server.
        const text = await response.text();
        return new Response(text === '' ? null : text, {
          status: response.status,
          headers: response.headers,
        });
      } finally {
        await server.close();
      }
    } catch (error) {
      if (error instanceof BodyTooLargeError) {
        return jsonRpcError(413, -32600, 'Request body too large');
      }
      log('error', 'request_failed', { error: (error as Error).name });
      return jsonRpcError(500, -32603, 'Internal error');
    }
  };
}
