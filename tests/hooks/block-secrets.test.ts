import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const HOOK = fileURLToPath(new URL('../../.claude/hooks/block-secrets.mjs', import.meta.url));

function runHook(toolName: string, toolInput: Record<string, unknown>): number | null {
  const result = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput }),
    encoding: 'utf8',
  });
  return result.status;
}

const bash = (command: string): number | null => runHook('Bash', { command });

describe('block-secrets hook: blocked (exit 2)', () => {
  it.each([
    'cat .env',
    'cat <.env',
    'echo "$(<.env)"',
    'cat .e*',
    'cat .en?',
    'cat infra/terraform.tfstate',
    'cat prod.tfvars',
    'cat ~/.aws/credentials',
    'terraform state pull',
    'terraform -chdir=infra state pull',
    'terraform -chdir=infra output -json',
    'terraform -chdir=infra show',
    'terraform -chdir=infra destroy',
    'terraform -chdir=infra apply -destroy',
    'cd infra && terraform destroy -auto-approve',
    'printenv',
    'printenv AWS_SECRET_ACCESS_KEY',
    'env',
    'env | grep AWS',
    'aws ssm get-parameter --name /app/key --with-decryption',
    'aws ssm get-parameters-by-path --path /app --with-decryption',
    'aws secretsmanager get-secret-value --secret-id app',
    'git commit -m "safe message"; cat .env',
  ])('Bash: %s', (command) => {
    expect(bash(command)).toBe(2);
  });

  it.each([
    ['Read', { file_path: '/repo/.env' }],
    ['Read', { file_path: '/repo/.env.local' }],
    ['Write', { file_path: '/repo/infra/terraform.tfstate' }],
    ['Edit', { file_path: '/repo/infra/prod.tfvars' }],
    ['Glob', { pattern: '**/.env*' }],
    ['Grep', { pattern: 'API_KEY', path: '/repo/.env' }],
    ['Grep', { pattern: 'x', glob: '*.tfvars' }],
  ])('%s: %j', (tool, input) => {
    expect(runHook(tool, input)).toBe(2);
  });
});

describe('block-secrets hook: allowed (exit 0)', () => {
  it.each([
    'npm test',
    'git status',
    'git commit -m "Ignore .env and *.tfstate files"',
    "git commit -m 'Ignore .env files'",
    `git commit -m "$(cat <<'EOF'\nIgnore .env and *.tfvars files\nEOF\n)"`,
    'terraform -chdir=infra plan',
    'terraform -chdir=infra validate',
    'terraform fmt -recursive infra',
    'env NODE_ENV=test node script.js',
    'aws ssm get-parameter --name /app/public-flag',
  ])('Bash: %s', (command) => {
    expect(bash(command)).toBe(0);
  });

  it.each([
    ['Grep', { pattern: '\\.env', path: '/repo/docs' }],
    ['Grep', { pattern: 'tfstate', path: '/repo/README.md' }],
    ['Read', { file_path: '/repo/src/index.ts' }],
    ['Glob', { pattern: 'src/**/*.ts' }],
  ])('%s: %j', (tool, input) => {
    expect(runHook(tool, input)).toBe(0);
  });

  it('ignores malformed input', () => {
    const result = spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' });
    expect(result.status).toBe(0);
  });
});
