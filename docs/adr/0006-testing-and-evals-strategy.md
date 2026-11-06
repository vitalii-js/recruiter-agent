# ADR-0006: Testing and evals strategy

## Status

Accepted. Date: 2026-11-06.

## Context

The main risk in this project is **hallucination**: claiming the persona has skills or experience
that are not in the profile. The tools are the system's API. In phase 1 the model belongs to the
client, so we cannot test its answers directly. CI must not need an LLM API key in phase 1.

## Options considered

1. **Unit tests only.**
   - Pros: fast and deterministic.
   - Cons: they check code, not whether the system answers recruiter questions correctly.
2. **End-to-end LLM evals only (LLM-as-judge).**
   - Pros: test real answers.
   - Cons: slow, costly, non-deterministic; need an API key in CI.
3. **Layered approach: contract unit tests + deterministic golden-set evals now, LLM-as-judge
   later.**
   - Pros: cheap, deterministic checks on every push; LLM evals are added when we own the model
     (web chat).
   - Cons: the phase 1 evals check tool output, not the final natural-language answers.

## Decision

- **Unit tests (Vitest)**: every MCP tool has contract tests covering input validation, output
  shape, and the explicit "not found" result. They focus on contracts and critical paths, not a
  coverage percentage.
- **Golden set (`evals/golden.json`)**: 10–15 recruiter questions. Positive cases list the expected
  facts. Negative cases ask about skills the persona explicitly does **not** have (from
  `specs/persona.md`). A script runs them against the tools, checks that the expected facts are
  present and that no invented facts appear. No LLM key is needed.
- **Phase 2**: add LLM-as-judge evals for web chat answers, with Langfuse tracing.
- CI runs lint, unit tests and evals on every push and PR.

## Consequences

- Positive: hallucination guards (negative cases) run on every change at no cost.
- Positive: the persona spec doubles as the source of truth for the negative tests.
- Negative: phase 1 cannot catch a client model that ignores a "not found" result; we can only
  make the tool output unambiguous.
