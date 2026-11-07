import { log } from './log.js';
import { createHttpHandler } from './server/http-handler.js';
import { createDevServer } from './server/node-adapter.js';
import { createSource, resolveSourceConfig } from './store/config.js';
import { ProfileStore } from './store/profile-store.js';
import { S3Client } from '@aws-sdk/client-s3';

// Local development server: `npm run dev`, then connect MCP Inspector to http://127.0.0.1:3000/mcp.

const port = Number(process.env.PORT ?? 3000);
const config = resolveSourceConfig(process.env);
const store = new ProfileStore({ source: createSource(config, () => new S3Client({})) });

createDevServer(createHttpHandler({ store })).listen(port, '127.0.0.1', () => {
  log('info', 'dev_server_started', {
    url: `http://127.0.0.1:${port}/mcp`,
    source: config.kind,
  });
});
