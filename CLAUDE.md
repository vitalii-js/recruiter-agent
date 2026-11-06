# CLAUDE.md

You are working on a public GitHub portfolio project: an AI agent that answers recruiters' questions about a fictional software engineer (skills, projects, experience). The persona is openly fictional.

Architecture:

- Core: a remote MCP server (TypeScript, Node.js, official MCP TypeScript SDK, streamable HTTP transport) running on AWS Lambda behind a Function URL.
- Data: the persona profile is stored as files in S3.
- Any MCP client (Claude, Cursor, ChatGPT dev mode) can connect and use its own model.
- Later: a web chat built on Vercel AI SDK using DeepSeek, with the provider swappable (e.g. Amazon Bedrock).
- Infrastructure: Terraform only, state in an S3 backend. No manual console changes.
- CI/CD: GitHub Actions, AWS access via OIDC (no long-lived keys).
- Language of the agent: English only.

Rules:

- TypeScript strict mode. Small, focused modules.
- Never commit secrets. Secrets live in AWS SSM Parameter Store. .env and \*.tfstate are gitignored.
- If the profile has no answer, tools return an explicit "not found" result; the agent must say the information is not in the profile and never invent skills.
- Every tool has unit tests for its contract.
- Before implementing, propose a plan and wait for approval.
- After each task, append a short entry to docs/decision-log.md: what was done, what went wrong, how it was fixed.
- Keep the MVP small; do not add features outside the current task.
