# ADR-0001: MCP server as the core

## Status

Accepted. Date: 2026-11-06.

## Context

Recruiters should be able to ask questions about a (fictional) engineer's skills, projects and
experience. The answers must come only from the profile data, never from invented facts. The
project should work with the AI tools people already use, and later with our own web chat. We do
not want to pay for LLM inference for every visitor in the first version.

## Options considered

1. **Custom chat app with its own LLM backend first.**
   - Pros: full control over the UX and the system prompt.
   - Cons: we pay for every question; it works only in our UI; a public endpoint needs rate
     limiting and prompt-injection defenses from day one.
2. **REST API with OpenAPI (e.g. a GPT Action).**
   - Pros: simple and widely understood.
   - Cons: tied to one vendor's integration format; there is no standard way for most LLM clients
     to discover and call it.
3. **Remote MCP server (streamable HTTP, stateless).**
   - Pros: one open standard works with Claude, Cursor, ChatGPT developer mode and our future web
     chat. The client brings its own model, so our inference cost is zero. Tools have typed
     contracts that are easy to unit test.
   - Cons: MCP is young and the spec is still changing; some clients have limited support for
     remote servers.

## Decision

Build the core as a remote MCP server in TypeScript with the official MCP TypeScript SDK. It uses
the streamable HTTP transport in **stateless mode** (no sessions), so any server instance can serve
any request. The first tools are `get_summary`, `get_skills`, `get_projects` and `search_experience`.
Each one returns an explicit "not found" result when the profile has no answer.

## Consequences

- Positive: client-agnostic; no LLM cost in the MVP; the tools are the system's API, so contract
  tests cover the important behavior.
- Positive: the phase 2 web chat (Vercel AI SDK) reuses the same server as an MCP client.
- Negative: answer quality depends on the client's model and system prompt, which we do not control
  in phase 1.
- Negative: we have to track MCP spec and SDK changes.
