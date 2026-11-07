#!/usr/bin/env node
// PreToolUse hook: blocks tool calls that would read or edit secret files
// (.env*, Terraform state/vars, private keys, cloud credentials), dump secrets
// from the environment or AWS, or run destructive / state-reading Terraform.
// Exit code 2 blocks the call and shows stderr to Claude.

// Paths that must never be touched. The leading class includes `<` so shell
// redirections (`cat <.env`, `$(<.env)`) are caught too.
const FILE_PATTERNS = [
  { re: /(^|[\s/'"=:(<])\.env[\w.-]*/, label: '.env files' },
  { re: /(^|[\s/'"=:(<])\.e(nv?)?[*?[]/, label: '.env files (glob)' },
  { re: /\.tfstate\b/, label: 'Terraform state' },
  { re: /\.tfvars\b/, label: 'Terraform variable files' },
  { re: /\.(pem|key|p12|pfx)\b/, label: 'private keys / certificates' },
  { re: /\bid_(rsa|dsa|ecdsa|ed25519)\b/, label: 'SSH private keys' },
  { re: /\.aws\/(credentials|config)\b/, label: 'AWS credentials' },
  { re: /[\w-]*secrets?[\w-]*\.(json|ya?ml|txt)\b/i, label: 'secret files' },
];

// Shell commands that leak secrets or bypass the Terraform permission rules
// (e.g. `terraform -chdir=infra destroy`).
const COMMAND_PATTERNS = [
  {
    re: /\bterraform(\s+-\S+)*\s+(state|show|output|destroy)\b/,
    label: 'Terraform state / destroy',
  },
  { re: /\bterraform\b[^;&|]*\bapply\b[^;&|]*\s-destroy\b/, label: 'Terraform destroy' },
  { re: /(^|[;&|(`]|\$\()\s*printenv\b/, label: 'environment dump (printenv)' },
  { re: /(^|[;&|(`]|\$\()\s*env\s*($|[;&|)`>])/, label: 'environment dump (env)' },
  { re: /\bssm\b[^;&|]*--with-decryption\b/, label: 'SSM SecureString decryption' },
  { re: /\bsecretsmanager\s+get-secret-value\b/, label: 'Secrets Manager values' },
];

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Commit message text is prose, not a file access: drop it before scanning so
// `git commit -m "Ignore .env files"` is not blocked.
function stripCommitMessages(command) {
  if (!/\bgit\b[^;&|]*\bcommit\b/.test(command)) return command;
  return command
    .replace(
      /(-m|--message)(=|\s+)"\$\(cat\s+<<-?\s*'?(\w+)'?\n[\s\S]*?\n\s*\3\s*\n\s*\)"/g,
      '$1 MSG',
    )
    .replace(/(-m|--message)(=|\s+)("(?:[^"\\]|\\.)*"|'[^']*')/g, '$1 MSG');
}

// Only fields that name paths (or the shell command) are scanned. Grep's
// `pattern` is search text, not a path; Glob's `pattern` is a path glob.
function candidates(toolName, toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return [];
  const keysByTool = {
    Bash: ['command'],
    Grep: ['path', 'glob'],
    Glob: ['pattern', 'path'],
  };
  const keys = keysByTool[toolName] ?? ['file_path', 'notebook_path', 'path'];
  return keys
    .map((k) => toolInput[k])
    .filter((v) => typeof v === 'string' && v.length > 0)
    .map((v) => (toolName === 'Bash' ? stripCommitMessages(v) : v));
}

function block(toolName, label, value) {
  process.stderr.write(
    `Blocked by .claude/hooks/block-secrets.mjs: ${toolName} touches ${label} ("${value}"). ` +
      'Secrets must never be read or edited by the agent. Ask the user to handle this manually.\n',
  );
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(await readStdin());
} catch {
  process.exit(0); // Not our input format; do not block.
}

const toolName = payload.tool_name;
for (const value of candidates(toolName, payload.tool_input)) {
  for (const { re, label } of FILE_PATTERNS) {
    if (re.test(value)) block(toolName, label, value);
  }
  if (toolName === 'Bash') {
    for (const { re, label } of COMMAND_PATTERNS) {
      if (re.test(value)) block(toolName, label, value);
    }
  }
}

process.exit(0);
