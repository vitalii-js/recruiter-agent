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
    // Second review: commit-message expansion, env dumps, credentials, globs.
    'git commit --allow-empty -m "$(cat .env)"',
    'git commit -m "`cat .env`"',
    `git commit -F- <<EOF\n$(cat .env)\nEOF`,
    'echo hi\nprintenv',
    'bash -c printenv',
    "sh -c 'env'",
    'env -0',
    'export -p',
    'set',
    'aws configure export-credentials --format env',
    'aws configure get aws_secret_access_key',
    'aws sts get-session-token',
    'aws sts assume-role --role-arn arn:aws:iam::123:role/x --role-session-name s',
    'aws ecr get-login-password',
    'terraform apply --destroy',
    'terraform -chdir=infra console',
    "echo 'var.db_password' | terraform console",
    'cat .[e]nv',
    'cat .*',
    'head .??*',
    'cat .[!.]*',
    'cat certs/server.key',
    // Third review: case, separators, scoped commit stripping, token caches.
    'cat .ENV',
    'cat .Env.local',
    'echo X=1 >.env',
    'cat {README.md,.env}',
    'cat \\.env',
    "git commit -m ok; somecmd -m '.env'",
    'cat ~/.aws/sso/cache/abc.json',
    'cat ~/.aws/cli/cache/x.json',
    'export',
    'declare',
    'aws sso get-role-credentials --role-name r --account-id 1 --access-token t',
    'cat dir/.e*',
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
    ['mcp__webstorm__read_file', { pathInProject: '.env' }],
    ['mcp__webstorm__execute_terminal_command', { command: 'cat .env' }],
    [
      'mcp__aws-mcp__aws___run_script',
      { code: "await call_boto3(service_name='secretsmanager', operation_name='GetSecretValue')" },
    ],
    [
      'mcp__aws-mcp__aws___run_script',
      { code: "params={'Name': '/app/key', 'WithDecryption': True}" },
    ],
    [
      'mcp__aws-mcp__aws___run_script',
      { code: "await call_boto3(service_name='sso', operation_name='GetRoleCredentials')" },
    ],
    ['Read', { file_path: '/repo/.ENV' }],
    ['Glob', { pattern: '**/.*' }],
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
    "jq '.key' package.json",
    'set -euo pipefail',
    'ls src/*.ts',
    'npx eslint .claude/hooks/*.mjs',
    'cat ./README.md',
    "jq '.[0]' package.json",
    `jq '.scripts["lint"]' package.json`,
    "sed -n 's/.*version//p' package.json",
    "grep -E '^.*(error)' log.txt",
    'export NODE_ENV=test',
    'git commit -m "Ignore .env" -m "Second paragraph about .tfvars"',
    'ls .github/*',
  ])('Bash: %s', (command) => {
    expect(bash(command)).toBe(0);
  });

  it.each([
    ['Grep', { pattern: '\\.env', path: '/repo/docs' }],
    ['Grep', { pattern: 'tfstate', path: '/repo/README.md' }],
    ['Read', { file_path: '/repo/src/index.ts' }],
    ['Glob', { pattern: 'src/**/*.ts' }],
    ['mcp__webstorm__read_file', { pathInProject: 'src/index.ts' }],
    [
      'mcp__aws-mcp__aws___run_script',
      { code: "await call_boto3(service_name='s3', operation_name='ListBuckets')" },
    ],
  ])('%s: %j', (tool, input) => {
    expect(runHook(tool, input)).toBe(0);
  });

  it('ignores malformed input', () => {
    const result = spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' });
    expect(result.status).toBe(0);
  });
});
