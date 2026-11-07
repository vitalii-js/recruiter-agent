#!/usr/bin/env node
// PreToolUse hook: blocks tool calls that would read or edit secret files
// (.env*, Terraform state/vars, private keys, cloud credentials), dump secrets
// from the environment or AWS, or run destructive / state-reading Terraform.
// Exit code 2 blocks the call and shows stderr to Claude.
//
// This is a best-effort extra layer, not the security boundary: a regex over a
// shell string cannot be complete. The real boundary is that no secrets live in
// the repo (.gitignore + gitleaks pre-commit; runtime secrets are in SSM).

const SEP = String.raw`(^|[\s/'"=:(<])`;

// Paths that must never be touched. SEP includes `<` so shell redirections
// (`cat <.env`, `$(<.env)`) are caught too.
const FILE_PATTERNS = [
  { re: new RegExp(`${SEP}\\.env[\\w.-]*`, 'm'), label: '.env files' },
  // Any dotfile glob (`.e*`, `.[e]nv`, `.*`, `.??*`, `.[!.]*`) can expand to .env.
  {
    re: new RegExp(`${SEP}\\.[\\w[\\]!*?-]*[*?[]`, 'm'),
    label: 'dotfile glob (may expand to .env)',
  },
  { re: /\.tfstate\b/, label: 'Terraform state' },
  { re: /\.tfvars\b/, label: 'Terraform variable files' },
  // Require a file name before the extension so `jq '.key'` is not blocked.
  { re: /[\w*-]\.(pem|key|p12|pfx)(?![\w(])/, label: 'private keys / certificates' },
  { re: /\bid_(rsa|dsa|ecdsa|ed25519)\b/, label: 'SSH private keys' },
  { re: /\.aws\/(credentials|config)\b/, label: 'AWS credentials' },
  { re: /[\w-]*secrets?[\w-]*\.(json|ya?ml|txt)\b/i, label: 'secret files' },
];

// Start of a shell command: line start, after a separator, `$(`, or `sh -c '`.
const CMD = String.raw`(^|[;&|(\x60\n]|\$\(|-c\s+['"]?)\s*`;

// Shell commands that leak secrets or bypass the Terraform permission rules
// (e.g. `terraform -chdir=infra destroy`).
const COMMAND_PATTERNS = [
  {
    re: /\bterraform(\s+-\S+)*\s+(state|show|output|destroy|console)\b/,
    label: 'Terraform state / destroy',
  },
  { re: /\bterraform\b[^;&|\n]*\bapply\b[^;&|\n]*\s--?destroy\b/, label: 'Terraform destroy' },
  { re: /\bprintenv\b/, label: 'environment dump (printenv)' },
  {
    re: new RegExp(`${CMD}env(\\s+-\\S+)*\\s*($|[;&|)\\x60>'"])`, 'm'),
    label: 'environment dump (env)',
  },
  {
    re: new RegExp(`${CMD}(export|declare|typeset)\\s+-[px]\\b`, 'm'),
    label: 'environment dump (export -p)',
  },
  { re: new RegExp(`${CMD}set\\s*($|[;&|)\\x60>'"])`, 'm'), label: 'environment dump (set)' },
  { re: /\bssm\b[^;&|\n]*--with-decryption\b/, label: 'SSM SecureString decryption' },
  { re: /\bsecretsmanager\s+get-secret-value\b/, label: 'Secrets Manager values' },
  { re: /\bconfigure\s+(export-credentials|get)\b/, label: 'AWS CLI credentials' },
  {
    re: /\bsts\s+(get-session-token|get-federation-token|assume-role[\w-]*)\b/,
    label: 'AWS temporary credentials',
  },
  { re: /\bget-login-password\b/, label: 'registry login password' },
];

// MCP tools take free-form input (file paths, scripts, SDK calls): every string
// is scanned with all patterns above plus these AWS SDK operations.
const MCP_PATTERNS = [
  {
    re: /\b(GetSecretValue|WithDecryption|GetSessionToken|GetFederationToken|AssumeRole\w*|GetAuthorizationToken|ExportCredentials)\b/,
    label: 'AWS secret or credential API',
  },
];

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Commit message text is prose, not a file access: drop it before scanning so
// `git commit -m "Ignore .env files"` is not blocked. Only text the shell does
// not expand is dropped: single quotes, double quotes without `$(`/backticks,
// and heredocs with a quoted delimiter. `-m "$(cat .env)"` is still scanned.
function stripCommitMessages(command) {
  if (!/\bgit\b[^;&|]*\bcommit\b/.test(command)) return command;
  return command
    .replace(
      /(-m|--message)(=|\s+)"\$\(cat\s+<<-?\s*'(\w+)'\n[\s\S]*?\n\s*\3\s*\n\s*\)"/g,
      '$1 MSG',
    )
    .replace(/(-m|--message)(=|\s+)("(?:[^"\\$`]|\\.)*"|'[^']*')/g, '$1 MSG');
}

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object')
    Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

// Only fields that name paths (or the shell command) are scanned for built-in
// tools. Grep's `pattern` is search text, not a path; Glob's is a path glob.
function candidates(toolName, toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return [];
  if (toolName.startsWith('mcp__')) return collectStrings(toolInput).filter((v) => v.length > 0);
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

function patternsFor(toolName) {
  if (toolName === 'Bash') return [...FILE_PATTERNS, ...COMMAND_PATTERNS];
  if (toolName.startsWith('mcp__')) return [...FILE_PATTERNS, ...COMMAND_PATTERNS, ...MCP_PATTERNS];
  return FILE_PATTERNS;
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

const toolName = typeof payload.tool_name === 'string' ? payload.tool_name : '';
const patterns = patternsFor(toolName);
for (const value of candidates(toolName, payload.tool_input)) {
  for (const { re, label } of patterns) {
    if (re.test(value)) block(toolName, label, value);
  }
}

process.exit(0);
