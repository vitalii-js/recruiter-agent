import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const HOOK = path.join(ROOT, '.claude/hooks/format-and-lint.mjs');
// A throwaway project outside the repo, reusing the repo's node_modules, so no
// broken test file can ever be left behind in the working tree.
const PROJECT = mkdtempSync(path.join(tmpdir(), 'format-and-lint-'));
symlinkSync(path.join(ROOT, 'node_modules'), path.join(PROJECT, 'node_modules'), 'dir');

function runHook(fileName: string, content: string): number | null {
  const filePath = path.join(PROJECT, fileName);
  writeFileSync(filePath, content);
  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: PROJECT },
    encoding: 'utf8',
  });
  return result.status;
}

afterAll(() => {
  rmSync(PROJECT, { recursive: true, force: true });
});

describe('format-and-lint hook', () => {
  it('passes valid JSON', () => {
    expect(runHook('ok.json', '{"a": 1}\n')).toBe(0);
  });

  it('reports a file Prettier cannot parse (exit 2)', () => {
    expect(runHook('broken.json', '{"a": \n')).toBe(2);
  });
});
