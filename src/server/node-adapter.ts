import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import type { HttpHandler } from './http-handler.js';

// node:http <-> web Request/Response, for the local dev server only (design D5).

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

/**
 * DNS rebinding protection: only accept requests addressed to localhost or 127.0.0.1 on our port,
 * so a web page on another origin cannot reach the local server through a rebound domain.
 */
export function isAllowedHost(host: string | undefined, port: number): boolean {
  if (!host) return false;
  const match = /^([^:]+)(?::(\d+))?$/.exec(host.trim().toLowerCase());
  if (!match?.[1] || !LOCAL_HOSTNAMES.has(match[1])) return false;
  return match[2] === undefined ? port === 80 : Number(match[2]) === port;
}

export function toWebRequest(req: IncomingMessage, port: number): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(name, v));
    else if (value !== undefined) headers.set(name, value);
  }
  const method = (req.method ?? 'GET').toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  return new Request(`http://127.0.0.1:${port}${req.url ?? '/'}`, {
    method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream<Uint8Array>) : null,
    duplex: 'half',
  });
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}

/** A node:http server for `handler`. The Host check uses the port the server listens on. */
export function createDevServer(handler: HttpHandler): Server {
  const server = createServer((req, res) => {
    const port = (server.address() as AddressInfo).port;
    void (async () => {
      if (!isAllowedHost(req.headers.host, port)) {
        await writeResponse(
          res,
          new Response(JSON.stringify({ error: 'Forbidden host' }), {
            status: 403,
            headers: { 'content-type': 'application/json' },
          }),
        );
        return;
      }
      await writeResponse(res, await handler(toWebRequest(req, port)));
    })().catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  return server;
}
