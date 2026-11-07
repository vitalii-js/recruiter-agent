import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const HOOK = path.join(ROOT, '.claude/hooks/format-and-lint.mjs');
// Inside the project so the hook does not skip it; removed after the tests.
const TMP = mkdtempSync(path.join(ROOT, 'tests/.tmp-format-'));

function runHook(fileName: string, content: string): number | null {
  const filePath = path.join(TMP, fileName);
  writeFileSync(filePath, content);
  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: filePath } }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT },
    encoding: 'utf8',
  });
  return result.status;
}

afterAll(() => {
  rmSync(TMP, { recursive: true, force: true });
});

describe('format-and-lint hook', () => {
  it('passes valid JSON', () => {
    expect(runHook('ok.json', '{"a": 1}\n')).toBe(0);
  });

  it('reports a file Prettier cannot parse (exit 2)', () => {
    expect(runHook('broken.json', '{"a": \n')).toBe(2);
  });
});
