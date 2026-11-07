# Recruiter Agent

An AI agent that answers recruiters' questions about the skills, projects and experience of a
software engineer. **The engineer is an openly fictional persona.** This repository is a
portfolio project showing how to build, test and ship a remote MCP server on AWS.

> Status: early setup. Sections marked _TBD_ are filled in as the project progresses.

## What it is

- A remote [Model Context Protocol](https://modelcontextprotocol.io) server (TypeScript, streamable
  HTTP, stateless) running on AWS Lambda behind a Function URL.
- The persona profile is stored as files in S3.
- Any MCP client (Claude, Cursor, ChatGPT developer mode) can connect and use its own model.
- If the profile has no answer, the tools return an explicit "not found" result. The agent never
  invents skills.

## Architecture

_TBD: C4 diagrams in `docs/architecture.md`._

Key decisions are recorded as ADRs in [`docs/adr/`](docs/adr/README.md). Day-to-day decisions and
lessons learned go in [`docs/decision-log.md`](docs/decision-log.md).

## Connect an MCP client

_TBD: Claude custom connector, Claude Desktop, Cursor._

## Development

Prerequisites: Node.js 22+, [gitleaks](https://github.com/gitleaks/gitleaks) (required by the
pre-commit hook), Terraform (for `infra/`).

```sh
npm install        # also activates git hooks (.githooks/)
npm run lint       # ESLint + Prettier check
npm test           # Vitest unit tests
npm run build      # compile to dist/
```

Repository layout:

| Path     | Contents                            |
| -------- | ----------------------------------- |
| `src/`   | MCP server source                   |
| `tests/` | Unit tests (tool contracts)         |
| `evals/` | Golden question set and eval runner |
| `infra/` | Terraform                           |
| `specs/` | Persona and feature specs           |
| `docs/`  | ADRs, decision log, architecture    |

## Built with Claude Code

_TBD._ The guardrails are committed in `.claude/settings.json`: secret files are blocked, and
Prettier and ESLint run after every edit. Commits are scanned by gitleaks.

The secret-blocking hook (`.claude/hooks/block-secrets.mjs`) is a best-effort extra layer: a
regex over a shell command can never catch every form. The real boundary is that there are no
secrets in the repo to leak. Secret files are gitignored, gitleaks scans every commit, and runtime
secrets live in AWS SSM Parameter Store. Every Bash `aws` command needs explicit approval.

## License

[MIT](LICENSE)
