import { describe, expect, it } from 'vitest';
import { TOOLS } from '../../src/tools/index.js';

describe('tool registry', () => {
  it('defines exactly the four tools', () => {
    expect(TOOLS.map((t) => t.name)).toEqual([
      'get_summary',
      'get_skills',
      'get_projects',
      'search_experience',
    ]);
  });

  it('every tool has a description and input and output schemas', () => {
    for (const tool of TOOLS) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.outputSchema).toBeDefined();
    }
  });

  it('every tool that takes a term says to pass a short term', () => {
    for (const tool of TOOLS.filter((t) => t.name !== 'get_summary')) {
      expect(tool.description).toMatch(/short term/);
    }
  });
});
