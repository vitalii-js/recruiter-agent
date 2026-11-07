# Tasks

## 1. Dependencies and transport spike

- [x] 1.1 Add `@modelcontextprotocol/sdk` (pinned to `~1.32`) and `@aws-sdk/client-s3` as runtime
      dependencies. Verify `npm install`, `npm run typecheck` and `npm test` still pass.
- [x] 1.2 Spike (throwaway, not committed): create a stateless `McpServer` with
      `WebStandardStreamableHTTPServerTransport` (`sessionIdGenerator: undefined`,
      `enableJsonResponse: true`) and one zod 4 tool with an output schema. Send it `initialize`
      and `tools/call` as web `Request`s. Verify both return JSON with no `Mcp-Session-Id` header.
      If the class is missing or behaves differently, stop and report before group 4 (design D4
      fallback).

## 2. Term matching

- [x] 2.1 Create `src/match/terms.ts` with `normalizeTerm`, `containsTerm` (moved from
      `src/profile/persona-spec.ts`, which now imports it) and `expandTerm`. Verify the existing
      `tests/profile/*` tests pass unchanged.
- [x] 2.2 Add `tests/match/terms.test.ts`: whitespace normalization, case-insensitivity, alias to
      canonical and canonical to aliases, Java vs JavaScript, React Native vs React, regex
      metacharacters ("C++", "a.b"). Verify `npm test` passes.

## 3. Tools (pure functions)

- [x] 3.1 Implement `src/tools/result.ts` (`found`, `notFound`, `unavailable`, shared output-schema
      parts) with unit tests for the exact shapes (status, query, mirrored JSON text, `isError`).
      Verify `npm test` passes.
- [x] 3.2 Implement `get_summary` (input schema, output schema, handler) with unit tests: found
      with `fictional: true` and the disclaimer; unknown argument rejected. Verify `npm test`
      passes.
- [x] 3.3 Implement `get_skills` with unit tests for every spec scenario: all skills, alias
      ("Postgres"), category ("testing" -> Jest, Vitest), absent ("Kubernetes"), not a skill name
      ("Amazon"), query and category disagree, invalid category, empty and 101-character terms.
      Verify `npm test` passes.
- [x] 3.4 Implement `get_projects` with unit tests: all projects, alias ("Lambda", "TS"), a skill no
      project uses ("React"), absent ("GraphQL"), unknown argument rejected. Verify `npm test`
      passes.
- [x] 3.5 Implement `search_experience` with unit tests: "idempotency" (project hit with
      `matchedFields`), "Healthtech" (experience, project and summary hits), "Tech lead"
      (alias expansion into summary leadership), "Java" and "React Native" (not_found), "salary"
      (not_found), empty query rejected. Verify `npm test` passes.
- [x] 3.6 Add `tests/tools/absent-terms.test.ts`: parse `specs/persona.md` and assert `not_found`
      for every "Not in profile" skill term in all three term tools and every topic term in
      `search_experience`. Verify `npm test` passes, and that adding a trap term to a copy of the
      profile makes the test fail.
- [x] 3.7 Create `src/tools/index.ts` with the four tool definitions (name, description saying "pass
      a short term, not a question", input and output schemas, handler). Verify by a unit test that
      exactly four tools are defined and every description and schema is present.

## 4. Profile store

- [x] 4.1 Implement `src/store/sources.ts` (`ProfileSource`, `FsSource`, `S3Source` with an
      injected `{ send }` client) with unit tests: fs reads the fixed file names; S3 uses the
      configured bucket and prefix plus a fixed key; `NoSuchKey` and `AccessDenied` become errors
      that carry the section and the code. Verify `npm test` passes.
- [x] 4.2 Implement `src/store/config.ts` with unit tests: bucket set -> S3 (default prefix
      `profile/`); no bucket and not on Lambda -> fs (default `data/profile/`, `PROFILE_DIR`
      override); on Lambda without a bucket -> configuration error. Verify `npm test` passes.
- [x] 4.3 Implement `src/store/profile-store.ts` (parallel read, `validateSection` +
      `checkConsistency`, 5-minute TTL with an injected clock, single-flight, last-good fallback,
      `ProfileUnavailableError`, JSON log lines) with unit tests for every `profile-store` spec
      scenario. Verify `npm test` passes and that a failing load's log line contains the section
      and code.
- [x] 4.4 Add a test that loads the committed `data/profile/` through `FsSource` + `ProfileStore`
      and gets a valid profile. Verify `npm test` passes.

## 5. MCP server and HTTP handler

- [x] 5.1 Implement `src/server/create-server.ts`: `McpServer` named `recruiter-agent` with the
      version from `package.json`, the fixed instructions, and the four tools wired to the store.
      `ProfileUnavailableError` maps to `unavailable()`. Verify `npm run typecheck` passes.
- [x] 5.2 Implement `src/server/http-handler.ts`: 404 for other paths, 405 for GET and DELETE
      (`Allow: POST`), 413 above 64 KB (by header and by bytes read), a per-request stateless
      transport, and a generic internal error for unexpected failures. Verify `npm run typecheck`
      passes.
- [x] 5.3 Add `tests/server/http-handler.test.ts` (with a fake store): `initialize` returns the
      instructions and no session header; `tools/list` returns four tools with schemas;
      `tools/call` found and not_found; invalid input rejected; 404, 405, 413; an unavailable
      result with no stack trace, path or bucket name. Verify `npm test` passes.

## 6. Entry points

- [x] 6.1 Implement `src/lambda.ts` (Function URL v2 event -> `Request`, including base64 bodies;
      `Response` -> result) and re-export `handler` from `src/index.ts`. Add `tests/lambda.test.ts`
      with plain and base64 sample events. Verify `npm test` passes.
- [x] 6.2 Implement `src/dev.ts` (binds 127.0.0.1, `PORT` default 3000, rejects other `Host`
      headers) and the `dev` npm script (`tsc -p tsconfig.build.json && node dist/dev.js`). Add a
      unit test for the Host check. Verify `npm test` passes and `npm run dev` starts the server.
- [x] 6.3 Add a short "Run locally" section to README (`npm run dev`, connect MCP Inspector to
      `http://127.0.0.1:3000/mcp`, environment variables). Verify the documented commands work as
      written.

## 7. Integration checks

- [x] 7.1 With `npm run dev` running, connect MCP Inspector over streamable HTTP. Call each tool
      once with a found term and once with an absent term ("Kubernetes", "salary"). Verify the
      results match the spec and record any surprises.
- [x] 7.2 Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`. Verify all pass.
- [x] 7.3 Add an entry to `docs/decision-log.md` (what was done, what went wrong, how it was
      fixed, including the spike outcome). Verify the entry exists.

## Workflow follow-up

- Review in a fresh Claude Code session (`/review`), then `/security-review` (required: public
  input handling, S3 access, error messages), then owner review, then squash merge to main.
- Archive the change with `/opsx:archive` after merge.
