# Design

## Context

See proposal.md (Why) and the `mcp-server` and `profile-store` specs for the required behavior.

What exists today:

- `src/profile/schema.ts`: strict Zod 4 section schemas and `validateSection` (path-prefixed
  errors). `src/profile/consistency.ts`: cross-section checks. Both are reused unchanged.
- `src/profile/persona-spec.ts`: parses the "Not in profile" lists from `specs/persona.md` and
  provides `containsTerm` (whole word or phrase, case-insensitive, regex-escaped).
- `data/profile/*.json`: about 10 KB in total. 25 skills, 6 projects, 3 experience entries. The
  persona-profile data tests already guarantee that no "Not in profile" term appears anywhere in
  the data.
- `src/index.ts` is a placeholder. The MCP SDK and the AWS SDK are not installed yet.
- Build: `tsc -p tsconfig.build.json` emits `src/` to `dist/`. ESM, NodeNext, Node 22.
- `@modelcontextprotocol/sdk` 1.32.x accepts zod `^3.25 || ^4.0`, so the existing zod 4 works.

## Goals / Non-Goals

**Goals:**

- Tool logic as pure functions `(profile, input) -> result`, testable without MCP, HTTP or S3,
  and reusable by the Task 1.5 eval script.
- One HTTP handler (web `Request` -> `Response`) shared by the Lambda entry and the local dev
  server, so both run the same code path.
- Negative cases proven by tests: every term in the persona spec's "Not in profile" lists returns
  `not_found` from every tool that takes a term.

**Non-Goals:**

- Bundling or minifying for Lambda, and choosing between the bundled and runtime AWS SDK. That is
  Task 1.7. This change only has to build with `tsc`.
- Request logging and analytics beyond what is needed to diagnose failures.
- Origin or CORS policy for browser clients on the public URL (the web chat, Task 2.1).

## Decisions

### D1. Module layout

```
src/
  match/terms.ts           normalizeTerm, containsTerm (moved here), expandTerm(profile, term)
  tools/result.ts          found / notFound / unavailable builders, shared output schema
  tools/get-summary.ts     each tool: input schema + pure handler(profile, input)
  tools/get-skills.ts
  tools/get-projects.ts
  tools/search-experience.ts
  tools/index.ts           tool definitions (name, description, schemas, handler)
  store/sources.ts         ProfileSource interface; fs and S3 implementations
  store/profile-store.ts   load all sections, validate, cache, last-good, single-flight
  store/config.ts          env -> source selection
  server/create-server.ts  McpServer with instructions and the four tools
  server/http-handler.ts   Request -> Response: path, method, size checks, transport
  lambda.ts                Function URL event <-> Request/Response
  dev.ts                   node:http on 127.0.0.1 -> http-handler
  index.ts                 re-exports the Lambda handler
```

`containsTerm` moves from `persona-spec.ts` to `match/terms.ts` because the server now depends on
it. `persona-spec.ts` imports it from there, so behavior and tests stay the same. Alternative:
import it from `persona-spec.ts`. Rejected because it would make runtime code depend on a module
that exists only to parse a Markdown spec.

### D2. Term matching

- `normalizeTerm`: trim and collapse inner whitespace. Case is handled by the regex.
- `expandTerm(profile, term)`: if the term equals a skill's name or alias (case-insensitive), it
  returns `[name, ...aliases]`. Otherwise it returns `[term]`.
- A match means `containsTerm(field, t)` holds for some `t` in the expansion. The direction is
  always term-in-data, never data-in-term (spec: Term matching).
- `get_skills.query` does **not** use substring search. It is an exact name or alias lookup, so
  "Amazon" does not return every "Amazon ..." skill. `get_projects.technology` compares each
  tech entry to the expansion by exact equality, case-insensitive. The tech lists hold canonical
  names, so "Lambda" expands to "AWS Lambda" and matches it.
- `search_experience` fields: experience `company`, `title`, `domain`, `highlights[]`, `tech[]`;
  project `name`, `domain`, `role`, `summary`, `outcomes[]`, `tech[]`; summary `title`,
  `seniority`, `headline`, `domains[].name/description`, `leadership[]`. A hit is
  `{ section, id, matchedFields }`, where `id` is the project id, `<company> (<title>)` for
  experience, or `summary`. It includes the full matching entry, so the client needs no second
  call.

Why this is safe: `containsTerm` escapes the term before building the regex, so user input cannot
inject a pattern and there is no catastrophic backtracking. The data tests already guarantee
absent terms never appear in the data, so whole-phrase search returns `not_found` for all of them
by construction. D7 adds tests that check this through the tools.

Alternatives: token-OR matching or stopword lists. Rejected in exploration because they produce
false positives ("React Native" -> React), which is worse than a miss.

### D3. Result envelope

`tools/result.ts` builds all results:

```
found(items, query?)  -> { structuredContent: { status: "found", query?, items },
                           content: [{ type: "text", text: JSON.stringify(structured) }] }
notFound(query, scope)-> { structuredContent: { status: "not_found", query, message },
                           content: [{ type: "text", text: message + " Do not infer or guess;
                                       tell the user this is not in the profile." }] }
unavailable()         -> { isError: true,
                           content: [{ type: "text", text: "The profile is temporarily unavailable." }] }
```

`message` names the tool's scope, for example "No skill named \"Kubernetes\" is in the profile."
`get_skills` and `get_projects` add "Try search_experience for a free-text search." Their scope is
narrower, and a miss there is not proof that the term is absent everywhere.

Output schema: one Zod object per tool, `status: enum(["found","not_found"])`, optional `query`,
`message`, and `items` typed with that tool's item schema (reusing the profile schemas). The SDK
skips output validation for `isError` results, so `unavailable()` needs no schema branch.

Alternative: `isError: true` for not found. Rejected in exploration, because models treat it as a
broken tool and retry or apologise instead of stating the fact.

### D4. Transport and HTTP handling

- A new `McpServer` and a new `WebStandardStreamableHTTPServerTransport` are created **per request**
  with `sessionIdGenerator: undefined` and `enableJsonResponse: true`. This is the SDK's stateless
  pattern. Creating them costs microseconds next to the request. Reusing one transport across
  requests is unsafe in stateless mode, because JSON-RPC request ids from different clients can
  collide.
- `http-handler.ts` runs in this order, before the SDK sees the request:
  1. path `!== "/mcp"` -> 404.
  2. method `GET` or `DELETE` -> 405 with `Allow: POST`. No SSE stream is opened, since the server
     never sends server-initiated messages.
  3. `Content-Length` over 64 KB, or a body read that exceeds 64 KB -> 413.
  4. Pass to the transport. Any thrown error -> a JSON-RPC internal error with a generic message.
     The details go to the log.
- Errors the SDK returns itself (invalid params, unknown tool) are protocol errors that describe
  the input. They do not include internals, so they are passed through.
- Server instructions: a fixed English string in `create-server.ts` (spec: Server instructions).
- Server name `recruiter-agent`, version read from `package.json` at build time via
  `resolveJsonModule`.

Alternatives: the Node `StreamableHTTPServerTransport` with Express plus `serverless-http`, or the
AWS Lambda Web Adapter layer. Both add dependencies or infrastructure only to convert the event to
a Node request. The web-standard transport lets the Lambda entry map the event to a `Request`
in about 30 lines. **Spike first (tasks 1.2):** confirm the class name, import path and
JSON-response behavior in SDK 1.32. If it is missing, fall back to the Node transport plus a small
`IncomingMessage` shim, and record that in the decision log.

### D5. Entry points

- `lambda.ts`: handles a Function URL (payload v2) event. It builds a `Request` from
  `requestContext.http.method`, `rawPath`, `rawQueryString`, `headers` and `body`, decoding base64
  when `isBase64Encoded` is set. It runs `http-handler` and maps the `Response` back to
  `{ statusCode, headers, body }`. Buffered mode is used, not response streaming, because the
  responses are small JSON.
- `dev.ts`: a `node:http` server that binds **127.0.0.1** only (port from `PORT`, default 3000).
  It converts `IncomingMessage` to `Request` and calls the same handler. It rejects requests whose
  `Host` header is not `localhost` or `127.0.0.1` (DNS rebinding protection). This matters only
  locally, where a browser page could otherwise reach the server.
- npm script `dev`: `tsc -p tsconfig.build.json && node dist/dev.js`. Running the compiled output
  avoids a new dev dependency (tsx). Node's type stripping cannot resolve the `.js` import
  specifiers that NodeNext requires.
- The public URL has **no Origin or Host check**. The server is anonymous, read-only and holds no
  credentials or user state, so a cross-site request gains nothing. CORS for browser clients is
  set on the Function URL in Terraform when the web chat needs it.

### D6. Profile store

- `ProfileSource` has one method, `read(section: SectionName): Promise<string>`. The section is
  one of the four fixed names, so object keys are never built from input (spec: Fixed object
  names).
  - `FsSource(dir)`: `readFile(join(dir, `${section}.json`))`.
  - `S3Source(client, bucket, prefix)`: `GetObject` on `${prefix}${section}.json`. The client is
    injected through a minimal `{ send }`-shaped interface, so tests need no mocking library.
- `config.ts` reads the environment:
  - `PROFILE_BUCKET` set -> S3, with `PROFILE_PREFIX` (default `profile/`). The region comes from
    the Lambda environment.
  - otherwise, if `AWS_LAMBDA_FUNCTION_NAME` is set -> a configuration error. This fails closed
    and avoids silently serving files bundled with the code.
  - otherwise -> `FsSource(PROFILE_DIR ?? "<repo>/data/profile")`, with the default resolved from
    `import.meta.url`.
- `ProfileStore.get()`:
  - The four sections are read in parallel, then parsed with `JSON.parse`, checked with
    `validateSection` and `checkConsistency`. Any failure rejects the whole load (no partial
    profile).
  - Cache: `{ profile, loadedAt }`, TTL 5 minutes, using an injected clock for tests. One
    in-flight promise is shared by concurrent callers (single-flight).
  - When a reload fails and a last good profile exists, it logs the failure and returns the last
    good profile. With no last good profile, it throws `ProfileUnavailableError`, which the tool
    wrapper turns into `unavailable()`.
- Why a 5-minute TTL: CI syncs data to S3 without a code deploy (Task 1.7), and a warm container
  can live for hours. Cost per reload is 4 small GETs, which is negligible. Alternatives: cache
  for the container's lifetime (stale for hours), or an ETag check on every request (an extra S3
  call on every request).

### D7. Logging and errors

- Logs are one JSON line per event to stdout/stderr (CloudWatch picks them up). Fields: `level`,
  `event` (`profile_load_failed`, `request_failed`), `section`, `code` and validation `errors`.
  There is no logging library.
- Tool calls are **not** logged with their query text in this change. Queries are public, untrusted
  input and may contain personal data. Observability is Task 2.3.
- Clients only ever see: SDK protocol errors about their own input, the generic unavailable text,
  or a generic internal error.

### D8. Testing

- **Pure tools** (`tests/tools/*.test.ts`): the committed profile data is loaded once through the
  real validation path, plus the small fixture from `tests/profile/fixture.ts` for edge cases.
  Every spec scenario of each tool is a test.
- **Negative sweep** (`tests/tools/absent-terms.test.ts`): it parses `specs/persona.md` with
  `parseAbsentLists` and asserts `not_found` for every skill term in `get_skills`, `get_projects`
  and `search_experience`, and for every topic term in `search_experience`. If someone later adds
  a trap term to the spec, it is covered automatically.
- **Matching** (`tests/match/terms.test.ts`): normalization, alias expansion, Java vs JavaScript,
  React Native vs React, regex metacharacters in the term ("C++", "a.b").
- **Store** (`tests/store/*.test.ts`): fake sources and a fake clock test cache hits, expiry,
  single-flight, last good on storage error and on invalid data, no-profile failure, and config
  selection (including Lambda without a bucket). The S3 source is tested with a fake `send` that
  checks the bucket and key and maps `NoSuchKey`/`AccessDenied` errors.
- **HTTP and MCP** (`tests/server/*.test.ts`): `Request` objects are sent to `http-handler` with a
  fake store. The tests cover `initialize` (instructions, no session header), `tools/list` (four
  tools with schemas), `tools/call` found and not_found, invalid input, 404, 405, 413, and the
  unavailable result containing no internals.
- **Lambda adapter** (`tests/lambda.test.ts`): sample Function URL events, plain and base64, map
  to the expected `Request`, and the response maps back.

## Risks / Trade-offs

- [The web-standard transport is missing or behaves differently in SDK 1.32] -> Spike task 1.2
  before any server code. The documented fallback is in D4.
- [Exact term matching misses reasonable phrasings ("Postgres DB", "AWS serverless")] -> This is
  accepted: a miss returns `not_found`, which is safe. Tool descriptions ask for short terms, and
  `get_skills`/`get_projects` misses point to `search_experience`. Task 1.5 evals will show
  whether misses happen in practice.
- [Up to 5 minutes of stale data after an S3 sync] -> Accepted for a portfolio profile.
- [Last-good fallback hides a broken sync] -> The failure is logged as `profile_load_failed`.
  Task 1.7 CI validates data before syncing, so this is a second line of defense.
- [The public anonymous endpoint can be abused for cost] -> Input and size limits here. Reserved
  concurrency, timeout and a budget alarm come in Task 1.6.
- [MCP spec or SDK changes (stateless mode, output schemas)] -> Pin the SDK minor version in
  `package.json`. The server tests exercise the protocol end to end, so an upgrade that breaks it
  fails CI.
- [Moving `containsTerm` breaks persona-profile tests] -> `persona-spec.ts` imports it from the new
  module, and the existing tests run unchanged.

## Migration Plan

There is no deployed system yet. The Lambda handler first ships in Tasks 1.6 and 1.7, which set
`PROFILE_BUCKET`/`PROFILE_PREFIX`. Rollback is a redeploy of the previous Lambda version.
