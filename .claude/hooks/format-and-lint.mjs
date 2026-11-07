#!/usr/bin/env node
// PostToolUse hook: runs Prettier and ESLint on the file Claude just wrote or edited.
// Remaining ESLint errors exit with code 2 so Claude sees them and fixes them.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const PRETTIER_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.css',
  '.html',
]);
const ESLINT_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

let payload;
try {
  payload = JSON.parse(await readStdin());
} catch {
  process.exit(0);
}

const projectDir = process.env.CLAUDE_PROJECT_DIR ?? payload.cwd ?? process.cwd();
const filePath = payload.tool_input?.file_path;
if (typeof filePath !== 'string' || !existsSync(filePath)) process.exit(0);

const rel = path.relative(projectDir, path.resolve(filePath));
if (rel.startsWith('..') || path.isAbsolute(rel) || rel.split(path.sep).includes('node_modules')) {
  process.exit(0);
}

const bin = (name) => path.join(projectDir, 'node_modules', '.bin', name);
const ext = path.extname(filePath).toLowerCase();

if (PRETTIER_EXT.has(ext) && existsSync(bin('prettier'))) {
  // --ignore-path respects .prettierignore; ignored files are silently skipped.
  const result = spawnSync(bin('prettier'), ['--write', '--log-level', 'warn', rel], {
    cwd: projectDir,
    encoding: 'utf8',
  });
  // Non-zero means Prettier could not parse the file (e.g. broken JSON/YAML).
  if (result.status !== 0) {
    process.stderr.write(`Prettier failed on ${rel}:\n${result.stdout}${result.stderr}`);
    process.exit(2);
  }
}

if (ESLINT_EXT.has(ext) && existsSync(bin('eslint'))) {
  const result = spawnSync(
    bin('eslint'),
    ['--fix', '--no-warn-ignored', '--max-warnings', '0', rel],
    { cwd: projectDir, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    process.stderr.write(`ESLint reported problems in ${rel}:\n${result.stdout}${result.stderr}`);
    process.exit(2);
  }
}

process.exit(0);
