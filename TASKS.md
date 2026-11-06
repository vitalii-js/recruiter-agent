# TASKS.md

Feed tasks to Claude Code one at a time, in plan mode. First show the whole phase with: "Read this list for context only. Do nothing yet. We start with Task 1.1."

Each task is marked **Mode: OpenSpec** (proposal → review specs and tasks → apply → archive) or **Mode: plain prompt** (setup, infra, docs — no spec needed).

Review flow for every task: run /review in a fresh Claude Code session (not the one that wrote the code), then my own review, then squash merge to main. Tasks marked **Security review: required** also get /security-review before merge.

## Phase 1 — before the interview (mandatory)

### Task 1.1 — Repo setup

**Mode: plain prompt.** Also run openspec init here and copy the CLAUDE.md context into the OpenSpec project file.

Initialize the repository: TypeScript, Node.js, ESLint, Prettier, Vitest, .gitignore (including .env, Terraform state and GLOSSARY.md), README skeleton, folders: src, tests, evals, infra, docs, specs. CLAUDE.md already exists — do not overwrite it.

Create the initial ADRs in docs/adr/ (format: context, options considered, decision, consequences, status): 0001 MCP server as the core, 0002 S3 for profile storage, 0003 AWS Lambda with Function URL for hosting, 0004 Terraform for IaC, 0005 GitHub OIDC for CI access, 0006 testing and evals strategy. Later decisions get new ADRs; replaced ones are marked "Superseded by".

Hooks (in .claude/settings.json, committed to the repo):

- PostToolUse on file edits: run Prettier and ESLint on the changed file.
- PreToolUse: block reading or editing .env\*, *.tfstate* and other secret files.
- Git pre-commit hook with gitleaks to block commits containing keys or tokens.

Permissions (same .claude/settings.json):

- allow: npm test, npm run lint, npm run build, git status, git diff, git log, terraform fmt, terraform validate, terraform plan.
- ask (always confirm with me): terraform apply, git push, any aws CLI command that changes resources.
- deny: reading or editing .env\*, *.tfstate* and secret files; rm -rf; terraform destroy.

### Task 1.2 — Persona spec

**Mode: OpenSpec** (one change covering 1.2 and 1.3: persona-profile).

Create specs/persona.md describing the fictional engineer: role and seniority, years of experience, main stack, domains, 4–6 projects with tech and outcomes, education, and an explicit list of skills and technologies the persona does NOT have (used for negative tests). Stop and wait for my review.

### Task 1.3 — Generate profile data

**Mode: OpenSpec** (same change as 1.2).

From specs/persona.md, generate the profile data files (by section: summary, skills, projects, experience). Validate them with a Zod schema. Data must match the spec exactly.

### Task 1.4 — MCP server

**Mode: OpenSpec** (change: mcp-server).

**Security review: required** — public input handling, S3 access, error messages leaking internals.

Implement the MCP server with tools: get\_summary, get\_skills, get\_projects, search\_experience. Read data from S3 in production and local files in development. Return explicit "not found" results. Unit tests for every tool.

Use the streamable HTTP transport in stateless mode (no sessions), so any Lambda instance can serve any request.

### Task 1.5 — Golden set and evals

**Mode: OpenSpec** (change: golden-evals).

Create evals/golden.json with 10–15 questions: positive cases with expected facts and negative cases about skills the persona does not have. Write a script that runs them against the tools and checks expected facts and the absence of invented facts. No LLM key required.

### Task 1.6 — Terraform infrastructure

**Mode: plain prompt.**

**Security review: required** — IAM least privilege, OIDC trust policy (repo + main only), public Function URL, no secrets in state or code.

In infra/: S3 bucket for profile data, Lambda with Function URL, least-privilege IAM role, SSM parameters, S3 backend for state, GitHub OIDC provider and a deploy role trusted only for this repository's main branch.

State bootstrap: a separate small infra/bootstrap config (local state) creates the S3 state bucket once; the main config then uses it as its backend.

Public endpoint protection (required, repo is public): Lambda reserved concurrency set to a low limit, a short timeout, and an AWS Budget with an email alert at a small monthly amount.

First apply: run bootstrap and the first terraform apply locally with my own AWS credentials (this creates the OIDC role); after that, CI handles all applies.

### Task 1.7 — CI/CD

**Mode: plain prompt.**

**Security review: required** — workflow permissions, OIDC usage, fork PRs cannot deploy or read secrets.

GitHub Actions: on every push and PR run lint, unit tests and evals; on push to main run terraform plan/apply and deploy via OIDC. Add status badges to README.

After deploy, sync the profile data folder to the S3 bucket, so profile changes ship through CI too.

### Task 1.8 — Documentation

**Mode: plain prompt.**

C4 diagrams in Mermaid (Context and Container) in docs/architecture.md. Review the ADRs from Task 1.1 against what was actually built and add ADRs for any new decisions from the decision log. Finish README: what it is, architecture, how to connect any MCP client (Claude custom connector, Claude Desktop, Cursor), how it was built with Claude Code.

### Task 1.9 — Verify end to end

**Mode: plain prompt.**

Connect the deployed MCP server to Claude Code and MCP Inspector, run the golden questions, fix issues, record findings in the decision log.

## Phase 2 — after the interview

### Task 2.1 — Web chat

**Mode: OpenSpec** (change: web-chat).

**Security review: required** — API key handling, prompt injection, CORS.

React web chat with Vercel AI SDK: streamText, agent loop with a step limit, MCP client connected to our MCP server, DeepSeek provider swappable via config. System prompt: English only, answer only from tool results, say clearly when information is missing.

Hosting: static frontend on S3 behind CloudFront, provisioned with Terraform and deployed by the CI workflow.

### Task 2.2 — Limits

**Mode: OpenSpec** (change: rate-limits).

**Security review: required** — limit bypass, IP spoofing via headers.

Global daily question limit with a friendly message showing how many questions were asked today, plus a soft per-IP daily limit. Counters in DynamoDB via Terraform.

### Task 2.3 — Observability and LLM evals

**Mode: OpenSpec** (change: observability).

Langfuse tracing for the agent loop (tool calls, tokens, cost). Extend evals with LLM-as-judge for web chat answers.

### Task 2.4 — MCP resources, prompts, guardrail

**Mode: OpenSpec** (change: mcp-resources-guardrail).

**Security review: required** — guardrail bypass and injection through MCP resources.

Expose the profile as MCP resources, add a prompt like "interview this candidate". Input guardrail: moderation and a basic prompt-injection filter.

### Task 2.5 — Launch

**Mode: plain prompt.**

Final README polish, demo GIF, LinkedIn post with the GitHub link.
