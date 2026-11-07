import type { ToolDefinition } from './define.js';
import { getProjectsTool } from './get-projects.js';
import { getSkillsTool } from './get-skills.js';
import { getSummaryTool } from './get-summary.js';
import { searchExperienceTool } from './search-experience.js';

export type { ToolDefinition } from './define.js';
export * from './result.js';

/** The four MCP tools, in the order they are listed to clients. */
export const TOOLS: readonly ToolDefinition[] = [
  getSummaryTool,
  getSkillsTool,
  getProjectsTool,
  searchExperienceTool,
];
