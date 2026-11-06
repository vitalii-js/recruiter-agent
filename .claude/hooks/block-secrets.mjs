#!/usr/bin/env node
// PreToolUse hook: blocks tool calls that would read or edit secret files
// (.env*, Terraform state/vars, private keys, cloud credentials).
// Exit code 2 blocks the call and shows stderr to Claude.

const SECRET_PATTERNS = [
  { re: /(^|[\s/'"=:(])\.env[\w.-]*/, label: '.env files' },
  { re: /\.tfstate\b/, label: 'Terraform state' },
  { re: /\.tfvars\b/, label: 'Terraform variable files' },
  { re: /\.(pem|key|p12|pfx)\b/, label: 'private keys / certificates' },
  { re: /\bid_(rsa|dsa|ecdsa|ed25519)\b/, label: 'SSH private keys' },
  { re: /\.aws\/(credentials|config)\b/, label: 'AWS credentials' },
  { re: /[\w-]*secrets?[\w-]*\.(json|ya?ml|txt)\b/i, label: 'secret files' },
];

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function candidates(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return [];
  const keys = ['file_path', 'notebook_path', 'path', 'pattern', 'glob', 'command'];
  return keys.map((k) => toolInput[k]).filter((v) => typeof v === 'string' && v.length > 0);
}

let payload;
try {
  payload = JSON.parse(await readStdin());
} catch {
  process.exit(0); // Not our input format; do not block.
}

for (const value of candidates(payload.tool_input)) {
  for (const { re, label } of SECRET_PATTERNS) {
    if (re.test(value)) {
      process.stderr.write(
        `Blocked by .claude/hooks/block-secrets.mjs: ${payload.tool_name} touches ${label} ("${value}"). ` +
          'Secrets must never be read or edited by the agent. Ask the user to handle this manually.\n',
      );
      process.exit(2);
    }
  }
}

process.exit(0);
