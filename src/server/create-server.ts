import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger } from '../log.js';
import type { Profile } from '../profile/schema.js';
import { ProfileUnavailableError } from '../store/profile-store.js';
import { TOOLS, toToolResult, unavailable, type ToolDefinition } from '../tools/index.js';
import { SERVER_NAME, SERVER_VERSION } from '../version.js';

// One MCP server per request (stateless, design D4). The tools read the profile through the store.

export const SERVER_INSTRUCTIONS =
  'This server describes an openly fictional software engineer, created for a portfolio demo. ' +
  'Answer questions about the engineer only from the results of these tools. ' +
  'Pass short terms (for example "TypeScript" or "Kubernetes"), not full questions. ' +
  'If a tool returns status "not_found", tell the user the information is not in the profile; ' +
  'do not infer, guess or fill gaps from general knowledge.';

export interface ProfileProvider {
  get(): Promise<Profile>;
}

async function callTool(tool: ToolDefinition, store: ProfileProvider, args: unknown, log: Logger) {
  let profile: Profile;
  try {
    profile = await store.get();
  } catch (error) {
    if (!(error instanceof ProfileUnavailableError)) {
      log('error', 'request_failed', { tool: tool.name, error: (error as Error).name });
    }
    return unavailable();
  }
  try {
    return toToolResult(tool.run(profile, args));
  } catch (error) {
    log('error', 'request_failed', { tool: tool.name, error: (error as Error).name });
    return unavailable();
  }
}

export function createMcpServer(store: ProfileProvider, log: Logger): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: SERVER_INSTRUCTIONS },
  );
  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      (args: unknown) => callTool(tool, store, args, log),
    );
  }
  return server;
}
