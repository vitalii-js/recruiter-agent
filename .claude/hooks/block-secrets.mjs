#!/usr/bin/env node
// PreToolUse hook: blocks tool calls that would read or edit secret files
// (.env*, Terraform state/vars, private keys, cloud credentials), dump secrets
// from the environment or AWS, or run destructive / state-reading Terraform.
// Exit code 2 blocks the call and shows stderr to Claude.
//
// This is a best-effort extra layer, not the security boundary: a regex over a
// shell string cannot be complete. The real boundary is that no secrets live in
// the repo (.gitignore + gitleaks pre-commit; runtime secrets are in SSM).

// Characters that can directly precede a file name in a shell command:
// whitespace, path, quotes, `=`/`:`, `(`, redirections, brace lists, `\` escape.
const SEP = String.raw`(^|[\s/'"=:(<>,{\\])`;

// Paths that must never be touched. Case-insensitive: macOS file systems are
// case-insensitive by default, so `.ENV` opens the real `.env`.
const FILE_PATTERNS = [
  { re: new RegExp(`${SEP}\\.env[\\w.-]*`, 'mi'), label: '.env files' },
  { re: /\.tfstate\b/i, label: 'Terraform state' },
  { re: /\.tfvars\b/i, label: 'Terraform variable files' },
  // Require a file name before the extension so `jq '.key'` is not blocked.
  { re: /[\w*-]\.(pem|key|p12|pfx)(?![\w(])/i, label: 'private keys / certificates' },
  { re: /\bid_(rsa|dsa|ecdsa|ed25519)\b/i, label: 'SSH private keys' },
  { re: /\.aws\/[\w*?[]/i, label: 'AWS credentials / token caches' },
  { re: /[\w-]*secrets?[\w-]*\.(json|ya?ml|txt)\b/i, label: 'secret files' },
];

// Unquoted shell glob tokens that start with a dot (`.e*`, `.[e]nv`, `.*`).
// Quoted text is not expanded by the shell, so `jq '.[0]'` is not a glob.
const DOT_GLOB = /(?:^|[\s<>,{(=:/])(\.[\w.*?[\]!-]*[*?[][\w.*?[\]!-]*)(?=$|[\s;&|)}>,])/gm;
const ENV_NAMES = ['.env', '.env.local', '.envrc'];

// True if the shell glob could expand to a .env file name.
function globMatchesEnv(glob) {
  const source = glob
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/\[!/g, '[^');
  try {
    const re = new RegExp(`^${source}$`, 'i');
    return ENV_NAMES.some((name) => re.test(name));
  } catch {
    return true; // Unparseable glob: assume the worst.
  }
}

function findEnvGlob(value) {
  for (const match of value.matchAll(DOT_GLOB)) {
    if (match[1] && globMatchesEnv(match[1])) return match[1];
  }
  return null;
}

// Start of a shell command: line start, after a separator, `$(`, or `sh -c '`.
const CMD = String.raw`(^|[;&|(\x60\n]|\$\(|-c\s+['"]?)\s*`;
// End of a command with no further arguments.
const END = String.raw`\s*($|[;&|)\x60>'"])`;

// Shell commands that leak secrets or bypass the Terraform permission rules
// (e.g. `terraform -chdir=infra destroy`).
const COMMAND_PATTERNS = [
  {
    re: /\bterraform(\s+-\S+)*\s+(state|show|output|destroy|console)\b/,
    label: 'Terraform state / destroy',
  },
  { re: /\bterraform\b[^;&|\n]*\bapply\b[^;&|\n]*\s--?destroy\b/, label: 'Terraform destroy' },
  { re: /\bprintenv\b/, label: 'environment dump (printenv)' },
  { re: new RegExp(`${CMD}env(\\s+-\\S+)*${END}`, 'm'), label: 'environment dump (env)' },
  {
    re: new RegExp(`${CMD}(export|declare|typeset)(\\s+-[px])?${END}`, 'm'),
    label: 'environment dump (export/declare)',
  },
  { re: new RegExp(`${CMD}set${END}`, 'm'), label: 'environment dump (set)' },
  { re: /\bssm\b[^;&|\n]*--with-decryption\b/, label: 'SSM SecureString decryption' },
  { re: /\bsecretsmanager\s+get-secret-value\b/, label: 'Secrets Manager values' },
  { re: /\bconfigure\s+(export-credentials|get)\b/, label: 'AWS CLI credentials' },
  {
    re: /\b(sts\s+(get-session-token|get-federation-token|assume-role[\w-]*)|sso\s+get-role-credentials|get-credentials-for-identity)\b/,
    label: 'AWS temporary credentials',
  },
  { re: /\bget-login-password\b/, label: 'registry login password' },
];

// MCP tools take free-form input (file paths, scripts, SDK calls): every string
// is scanned with all patterns above plus these AWS SDK operations.
const MCP_PATTERNS = [
  {
    re: /\b(GetSecretValue|WithDecryption|GetSessionToken|GetFederationToken|AssumeRole\w*|GetAuthorizationToken|ExportCredentials|GetRoleCredentials|GetCredentialsForIdentity|CreateAccessKey)\b/,
    label: 'AWS secret or credential API',
  },
];

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

// Commit message text is prose, not a file access: drop it before scanning so
// `git commit -m "Ignore .env files"` is not blocked. Only messages that belong
// to a `git commit` (same command segment) are dropped, and only text the shell
// does not expand: single quotes, double quotes without `$(`/backticks, and
// heredocs with a quoted delimiter. `-m "$(cat .env)"` is still scanned.
const COMMIT_PREFIX = String.raw`(\bgit\b[^;&|\n]*?\bcommit\b[^;&|\n]*?)`;
const COMMIT_HEREDOC = new RegExp(
  `${COMMIT_PREFIX}(-m|--message)(=|\\s+)"\\$\\(cat\\s+<<-?\\s*'(\\w+)'\\n[\\s\\S]*?\\n\\s*\\4\\s*\\n\\s*\\)"`,
);
const COMMIT_QUOTED = new RegExp(
  `${COMMIT_PREFIX}(-m|--message)(=|\\s+)("(?:[^"\\\\$\`]|\\\\.)*"|'[^']*')`,
);

function stripCommitMessages(command) {
  let result = command;
  for (let i = 0; i < 20; i += 1) {
    const next = result.replace(COMMIT_HEREDOC, '$1$2 MSG').replace(COMMIT_QUOTED, '$1$2 MSG');
    if (next === result) break;
    result = next;
  }
  return result;
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
  const glob = findEnvGlob(value);
  if (glob) block(toolName, `dotfile glob that can expand to .env (${glob})`, value);
}

process.exit(0);
