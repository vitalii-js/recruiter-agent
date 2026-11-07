# Proposal

## Why

The MCP tools (Task 1.4) and the golden-set evals (Task 1.5) need a profile to answer from and a
source of truth to test against. The persona has to exist first, as a reviewed spec plus validated
data. It also has to include an explicit list of what the persona does **not** have, so negative
evals can catch invented skills.

## What Changes

- Add `specs/persona.md`: the human-readable source of truth for the openly fictional engineer
  **Alex Rivera**. It covers a Senior Backend / Platform Engineer with about 8 years of experience,
  TypeScript/Node.js, AWS serverless, PostgreSQL and Terraform, travel and healthtech domains, some
  tech-lead experience, 4–6 projects with tech and outcomes, and education. It also lists the skills,
  technologies and topics the persona does **not** have.
- Implementation pauses after `specs/persona.md` is written, for the owner's review, before any
  data is generated.
- Add profile data generated from the spec: one JSON file per section (`summary`, `skills`,
  `projects`, `experience`) under `data/profile/`.
- Add a Zod schema for the profile and tests that validate the data, check cross-references
  between sections, and check that nothing on the "does not have" list appears in the data.
- Add `zod` as a runtime dependency.

## Capabilities

### New Capabilities

- `persona-profile`: The persona's profile data: its sections, shape and validation rules, the
  fictional marker, and what the profile must not contain. The MCP tools and evals depend on this
  contract.

### Modified Capabilities

None.

## Out of scope

- MCP server and tools (`get_summary`, `get_skills`, `get_projects`, `search_experience`): Task 1.4.
- The profile loader for S3 and the local filesystem, and in-memory caching: Task 1.4.
- Golden set and eval script (`evals/golden.json`): Task 1.5.
- Uploading data to S3, Terraform, CI sync: Tasks 1.6–1.7.
- Location, timezone, work format, spoken languages, salary, notice period, work authorization:
  intentionally **not** in the profile. Tools must answer "not found" for them.
- A machine-readable "does not have" list inside the profile data. It lives only in
  `specs/persona.md`, and later in the evals.
- Contact details, links or a photo of the persona.

## Impact

- New files: `specs/persona.md`, `data/profile/{summary,skills,projects,experience}.json`,
  `src/profile/schema.ts`, and tests under `tests/profile/`.
- New runtime dependency: `zod`.
- Downstream: Task 1.4 tools read this data through the schema. Task 1.5 evals use the
  "does not have" list from `specs/persona.md`.
