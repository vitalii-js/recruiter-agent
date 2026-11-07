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

## 2026-11-07 — Task 1.1 follow-up: code review fixes (PR #1)

**Done**

- Terraform rules also cover `terraform -chdir=<dir> <cmd>` (deny: state/show/output/destroy;
  ask: plan/apply). As a second layer, the hook blocks these commands with any global flags.
- Restored the explicit `Write(...)` deny rules for secret files and added `*.tfvars.json`.
- Hook hardening: it now catches `<` redirections, `.e*`/`.en?` globs, `printenv`/bare `env`,
  `aws ssm ... --with-decryption` and `secretsmanager get-secret-value`. More AWS verbs that
  change resources (`authorize-`, `revoke-`, `change-`, `batch-`, `copy-`, `reset-`, `replace-`,
  `rotate-`) are in `ask`.
- Hook false positives: Grep's `pattern` (search text) is no longer scanned, and `git commit`
  messages are stripped before Bash commands are checked.
- `prepare` no longer fails without a `.git` directory (Docker, Lambda packaging).
- `@types/node` pinned to `^22` to match the Lambda Node.js 22 runtime.
- New contract tests: `tests/hooks/block-secrets.test.ts` (45 cases, blocked and allowed).

**What went wrong / how it was fixed**

- The 4 pushed commits exposed a work email. The history was rewritten to use the GitHub noreply
  address and both branches were force-pushed. The repo now uses the noreply address locally.
- A local edit had left `settings.json` with a leading blank line and no trailing newline, which
  failed `prettier --check`. Rewritten in Prettier style.
- Known trade-off: Bash commands that only mention a secret file name in search text or a heredoc
  are still blocked (this entry itself was first blocked when written via a shell heredoc).
  From a command string alone, search text and a real file read cannot be told apart reliably.
  Use the Grep, Edit or Write tools instead.
- Vitest only collected `tests/**`, and `passWithNoTests` hid any test placed next to the code.
  It now also collects `src/**` and `evals/**`, and `passWithNoTests` is removed, so an empty
  test run fails. Verified with a temporary test in `src/`.
- Typed ESLint failed on any `.ts` file outside the tsconfig `include` (for example `scripts/`).
  tsconfig now includes `**/*.ts`. The `allowDefaultProject` globs did nothing, because js/mjs
  files are not type-checked, so they were removed. Verified with a temporary `scripts/*.ts`.
- The OpenSpec `archive` guidance ("add a decision-log entry") had been dropped. OpenSpec 1.16
  supports `operations.archive.guidance`, so it is restored.

## 2026-11-07 — Task 1.1 follow-up: second code review (PR #1)

**Done**

- Fixed a bypass I had introduced: commit-message stripping hid `-m "$(cat .env)"`. Only text the
  shell does not expand is stripped now (single quotes, double quotes without `$(`/backticks,
  heredocs with a quoted delimiter).
- `.gitignore`: `.env*` (with `!.env.example`) and `*.tfvars.json`.
- AWS: denied the CLI commands that print credentials (`configure export-credentials`/`get`,
  `sts get-session-token`/`assume-role`, `ecr get-login-password`). The hook catches them too.
- Terraform: `apply --destroy` and `console` are denied.
- The PreToolUse hook now also runs for MCP tools (`mcp__.*`). It scans every string in their
  input, plus AWS SDK names such as `GetSecretValue` and `WithDecryption`.
- AWS permission model: replaced the verb-by-verb ask list (never complete) with
  `Bash(aws:*)` in `ask`.
- ESLint: `.cjs`/`.jsx` no longer use typed linting. tsconfig includes `.mts`/`.cts`.
- `format-and-lint.mjs` now reports a Prettier parse failure (exit 2) instead of ignoring it.
- Hook: catches multi-line commands, `sh -c`, `env -0`, `export -p`, `set`, and any dotfile glob.
  `.key`/`.pem` only match after a file name, so `jq '.key'` passes.
- Tests: 80 cases, including a test for the format-and-lint hook.

**What went wrong / how it was fixed**

- The plan was to put `aws:*` in ask and allow read-only verbs. Claude Code checks deny, then ask,
  then allow, so an ask rule always beats an allow rule. Accepted: every Bash `aws` command asks.
  AWS work goes through the AWS MCP server, which is in ask anyway.
- The hook blocked my own edit scripts three times, because they mentioned `.env`, `tfvars` or
  `terraform console` in their text. Workaround: Edit tool, or a script file whose path is clean.
- Accepted limits: `obj.key` in code still matches as a key file, and `printenv` is blocked even
  inside search text. The hook is documented in README as an extra layer, not the boundary.

## 2026-11-07 — Task 1.1 follow-up: third code review (PR #1)

**Done**

- Hook path patterns are case-insensitive (macOS opens `.env` for `.ENV`).
- More characters may precede a file name (`>`, `,`, `{`, `\`), so `echo X=1 >.env` and
  `cat {a,.env}` are caught.
- The dotfile-glob check now looks only at unquoted tokens and blocks only globs that can expand
  to a .env name. It converts the glob to a regex and tests it against `.env`, `.env.local` and
  `.envrc`. This fixes the false positives I had added (`jq '.[0]'`, `sed 's/.*//'`).
- Commit-message stripping is limited to the `git commit` part of the command.
- The whole `~/.aws/` directory is blocked, including the SSO and CLI token caches. Bare
  `export`/`declare` are blocked, and so are SSO/Cognito credential calls (CLI and SDK).
- The format-and-lint test runs in a temp project outside the repo (with `node_modules` linked
  in), so a killed test run cannot leave a broken file in the working tree. A first attempt that
  put the temp folder in `.prettierignore` made Prettier skip the broken file, and the test caught
  that.
- Tests: 100 hook cases.

**What went wrong / how it was fixed**

- I tried to replace the whole-file lockfile allowlist in gitleaks with an `integrity`-only one.
  A planted token in `package-lock.json` was still not reported: gitleaks' built-in default config
  already skips lockfiles, and `useDefault` cannot undo that. Fix: removed our redundant
  allowlist, and the pre-commit hook now blocks lockfile `resolved` URLs with credentials. Verified
  in a throwaway repo (clean lockfile passes, `https://user:tok@...` is blocked).
- Stopping point: three review rounds found smaller hook gaps each time, and each new rule risked
  new false positives. Forms like `node -p process.env` are accepted as out of scope for a regex
  hook (see README). The hook is not reviewed further in this task.

## 2026-11-07 — Tasks 1.2 + 1.3: Persona spec and profile data (OpenSpec `persona-profile`)

**Done**

- `specs/persona.md`: Alex Rivera (openly fictional), Senior Backend / Platform Engineer, 8 years,
  TypeScript/Node.js + AWS serverless + Terraform. Domains are travel and healthtech, with some
  tech-lead work. It has 6 projects with numeric outcomes and 25 skills with years, level and
  aliases. Two "Not in profile" lists (16 skill groups, 7 logistics/compensation topics) use a
  fixed `- Name -- terms: a, b` format that tests can parse. The domains and dates are chosen so
  the persona does not mirror the repo owner. The owner approved the spec before any data was
  generated.
- `data/profile/{summary,skills,projects,experience}.json`, generated from the approved spec by a
  one-off script (not committed), so facts are copied rather than retyped.
- `src/profile/schema.ts`: strict Zod 4 schemas (an unknown field such as `salary` fails),
  `fictional: z.literal(true)`, `YYYY-MM` periods, and `validateSection` with path-prefixed
  errors (`skills[1].years: ...`). `src/profile/consistency.ts` checks project and experience
  tech against skills, alias uniqueness, skill years against total, and unique project ids.
  `src/profile/persona-spec.ts` parses the "Not in profile" lists and headings and finds
  whole-word terms in any string or key.
- `tests/profile/`: 50 tests. They include the committed data against the schema, consistency,
  trap and topic terms, project and experience names against the spec, and copy tests that prove
  the guard fires.

**What went wrong / how it was fixed**

- The first draft of the spec overstated some skill years (Fastify 2, Docker 6, SQS 5) compared
  with the periods where the skill appears. They were recalculated from the experience periods
  before review, and the consistency check now caps years at total experience.
- Two design details changed during implementation: `summary.disclaimer` (the spec requires the
  text to say "fictional") and `project.employer` (in the persona spec) were added to the schema.
  Project periods allow `end: null`, because one project is ongoing.
- ESLint rejected `const { years: _years, ...rest }` in tests (no-unused-vars without an ignore
  pattern). Replaced with a small `without()` helper instead of loosening the lint config.
- The secret-blocking hook blocked a Bash heredoc that held a Python regex `(.*?)` (read as a
  dotfile glob). This is the known trade-off from Task 1.1. The script was written with the Write
  tool instead.

## 2026-11-07 — Task 1.4: MCP server (OpenSpec `mcp-server`)

**Done**

- Four tools (`get_summary`, `get_skills`, `get_projects`, `search_experience`) as pure functions
  `(profile, input) -> found | not_found`. Thin wrappers turn them into MCP results. `not_found` is
  a normal result (`isError: false`) whose text tells the model not to guess. Only a real failure
  uses `isError: true`, with the generic text "The profile is temporarily unavailable."
- Matching (`src/match/terms.ts`): tools take short terms, not questions. The term is searched for
  in the data (whole phrase, word boundaries, case-insensitive), never the data in the term, so
  "React Native" does not match React and "Java" does not match JavaScript. Skill aliases expand
  ("TS" -> TypeScript). `containsTerm` moved here from `persona-spec.ts`, which re-exports it.
- Stateless MCP over the SDK's `WebStandardStreamableHTTPServerTransport` (JSON responses, no
  sessions, a new server per request). One `Request -> Response` handler is used by the Lambda
  Function URL adapter and the local dev server (`npm run dev`, 127.0.0.1 only, Host check).
  The handler returns 404 for other paths, 405 for non-POST, and 413 above 64 KB.
- Profile store: local files or S3 (`PROFILE_BUCKET`/`PROFILE_PREFIX`), validation with the
  existing schema and consistency checks, a 5-minute cache shared by concurrent loads, and the
  last good profile on reload failure. On Lambda without a bucket it fails closed. Load
  failures are logged as JSON lines and never returned to clients. Query text is not logged.
- 323 tests in total (171 new). A negative sweep reads every "Not in profile" term from
  `specs/persona.md` and asserts `not_found` from every term tool.
- Checked with the official MCP Inspector (CLI mode) against `npm run dev`: found and not_found
  for every tool, and invalid input rejected.

**What went wrong / how it was fixed**

- Spike first (task 1.2): the web-standard transport exists in SDK 1.32 and accepts zod 4
  `strictObject` schemas (`additionalProperties: false`). It also showed that a stateless `GET`
  opens an SSE stream by default, which is why the handler returns 405 before the SDK sees it.
  The SDK reports invalid tool input as an `isError` result, not a JSON-RPC error.
- `sessionIdGenerator: undefined` does not compile under `exactOptionalPropertyTypes`. Leaving the
  option out gives the same stateless mode.
- Design D4 planned to read the server version from `package.json`, but the build's
  `rootDir: src` forbids that import. Now `src/version.ts` holds the version, and a test keeps it
  equal to `package.json`.
- The first dev-server test hid the allowed-Host path behind a port-0 workaround. The server now
  takes the port from its listening socket, and both paths are tested over real `node:http`.
- Port 3000 was taken by an unrelated local process, so the curl calls first hit the wrong
  server. README documents `PORT=3999 npm run dev`.
- An Inspector run showed "Tool ... not found" for every call with arguments. The cause was my
  zsh loop: unquoted `$args` is not word-split in zsh, so the whole string was sent as the tool
  name. The server answered correctly. Rerun with `${=args}`, and every result matched the spec.
