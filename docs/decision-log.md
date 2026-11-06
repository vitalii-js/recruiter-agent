# Decision log

Short entries per task: what was done, what went wrong, how it was fixed. Architectural decisions
go in [`adr/`](adr/README.md).

## 2026-11-06 — Task 1.1: Repo setup

**Done**

- TypeScript (strict, NodeNext, ESM), ESLint (flat config, typescript-eslint type-checked,
  eslint-config-prettier), Prettier, Vitest. Folders `src`, `tests`, `evals`, `infra`, `docs`,
  `specs`. README skeleton. ADRs 0001–0006.
- `.claude/settings.json`: a PreToolUse hook (`block-secrets.mjs`) blocks secret files (`.env*`,
  `*.tfstate*`, `*.tfvars`, keys, AWS credentials) for Read/Edit/Write/Grep/Glob and Bash commands.
  A PostToolUse hook (`format-and-lint.mjs`) runs Prettier + ESLint on the edited file.
  Permissions follow allow, ask and deny lists.
- Gitleaks pre-commit hook in `.githooks/`, activated by the npm `prepare` script
  (`core.hooksPath`). No husky. The hook fails closed if gitleaks is not installed.
- OpenSpec was already initialized (`openspec/config.yaml` holds the CLAUDE.md context).

**What went wrong / how it was fixed**

- The secret-blocking hook went live as soon as it was written. It blocked my own Bash test
  command, because the command text contained `.env` paths. Fix: moved the test cases into a
  separate script so the command line itself has no secret paths. This confirms that the hook
  checks Bash commands, not just file tools.
- `npm audit` reports 10 moderate findings: a minimatch ReDoS inside the eslint 10 /
  typescript-eslint dependency tree. These are dev-only tools that never run on untrusted input.
  The suggested fix downgrades eslint to 9, so we accept the finding and will re-check when
  upstream releases a fix.
- `npm run format` reformatted the hand-written TASKS.md (escaped `*` characters). Fix: reverted it
  and added `CLAUDE.md` and `TASKS.md` to `.prettierignore`.
- gitleaks was not installed. It is now installed with Homebrew (8.30.1). Verified: the clean tree
  passes, and a planted fake GitHub token is blocked (exit 1).
- The AWS MCP server (`mcp__aws-mcp__aws___run_script`) can change AWS resources without going
  through the Bash `aws` CLI rules. It is in the `ask` list as well.
