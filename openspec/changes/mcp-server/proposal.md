# Proposal

## Why

The persona profile now exists as validated data (`persona-profile`), but nothing can answer
questions about it yet. The MCP server is the project's core (ADR-0001). It lets any MCP client
(Claude, Cursor, ChatGPT developer mode) ask about the persona using its own model. Its tools have
to stick to the profile: when the profile has no answer, they return an explicit "not found" rather
than letting the client's model guess.

## What Changes

- Add four MCP tools that answer from the profile only:
  - `get_summary`: the persona summary, including the fictional marker.
  - `get_skills`: all skills, or skills filtered by a term (exact name or alias) and/or a category.
  - `get_projects`: all projects, or projects that use a given technology.
  - `search_experience`: free-text term search across work experience, projects and summary text.
    Each hit is labelled with its section and the fields that matched.
- Tools take **short terms** (for example `"React Native"`), not natural-language questions. The
  client's model extracts the term. Matching is whole-phrase, case-insensitive and on word
  boundaries. A term that names a known skill also matches that skill's other names. A term is
  never matched in reverse: the query is searched for in the profile, the profile is never
  searched for in the query.
- Every tool returns the same result shape with three outcomes: `found`, `not_found` (a normal
  result, not an error, with a message telling the model not to guess), or a failure (an error
  result with a generic message and no internal details).
- The server tells clients during initialization that the persona is fictional, that answers must
  come only from tool results, and that "not found" means the information is not in the profile.
- A stateless MCP server over the streamable HTTP transport (no sessions). It has two entry
  points: an AWS Lambda handler for the Function URL, and a local HTTP server for development and
  MCP Inspector.
- Profile loading through one storage interface: local files in development, S3 in production.
  Data is validated with the existing `persona-profile` schema and consistency checks on load,
  and cached in memory for a short time.
- Input hardening for a public, anonymous endpoint: strict tool inputs with length limits, a
  request size limit, and error messages that never expose stack traces, bucket names or paths.
- New runtime dependencies: `@modelcontextprotocol/sdk` and `@aws-sdk/client-s3`.

## Capabilities

### New Capabilities

- `mcp-server`: The MCP endpoint and its tools: transport behavior (stateless HTTP), the tool set,
  term matching rules, the shared found / not_found / failure result contract, server
  instructions, input limits, and how errors are reported to clients.
- `profile-store`: Loading the profile for the tools: choosing the local or S3 source, validating
  data on load, caching it, and failing closed when data is missing or invalid.

### Modified Capabilities

None. The tools read `persona-profile` data through its existing schema and add no requirements to
it.

## Out of scope

- Terraform: S3 bucket, Lambda, Function URL, IAM role, reserved concurrency, budget (Task 1.6).
- Bundling the Lambda package, CI, deploy, and syncing `data/profile/` to S3 (Task 1.7).
- Golden set and eval script (Task 1.5). This change keeps the tool functions callable without
  MCP so the evals can reuse them.
- Natural-language query parsing, fuzzy or semantic search, stemming and stopwords.
- Extra filters (project id, domain, period), pagination, MCP resources and prompts (Task 2.4).
- Authentication, rate limiting and per-IP limits (Task 2.2; the Function URL stays anonymous).
- SSE streaming and session management.
- The web chat (Task 2.1).

## Impact

- New code under `src/` (tools, matching, profile store with local and S3 sources, MCP server
  factory, Lambda handler, local dev server) and tests under `tests/`. `src/index.ts` stops being
  a placeholder.
- Reuses `src/profile/schema.ts` (`validateSection`) and `src/profile/consistency.ts` unchanged.
- New runtime dependencies: `@modelcontextprotocol/sdk`, `@aws-sdk/client-s3`.
- New npm script to run the local dev server.
- Environment variables the Lambda will need (bucket and prefix). Task 1.6 sets them in Terraform.
- Security review required before merge (public input handling, S3 access, error messages).
