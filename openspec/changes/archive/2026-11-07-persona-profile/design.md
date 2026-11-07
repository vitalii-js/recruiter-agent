# Design

## Context

The repo has the TypeScript/Vitest/ESLint scaffold from Task 1.1 but no application code yet
(`src/index.ts` is a placeholder). ADR-0002 already fixes the storage model: JSON files per section,
validated with Zod on load, stored in S3 in production and read from local files in development.
This change produces the data and its contract. The loader and the tools come in Task 1.4. See
proposal.md for scope.

Note: the root `specs/` folder (persona spec for humans) is not the same as `openspec/specs/`
(OpenSpec capabilities). `specs/persona.md` goes in the root folder.

## Goals / Non-Goals

**Goals:**

- A schema and pure validation functions that Task 1.4 can import unchanged.
- Machine checks for the hallucination guards: absent terms, logistics topics, cross-references.
- `specs/persona.md` structured so tests can parse the parts they need, while staying readable.

**Non-Goals:**

- Reading files from S3 or caching (Task 1.4).
- Searching or ranking (Task 1.4 `search_experience`).
- A checker for full semantic equality between spec and data. Only names are checked
  automatically. The rest is checked in review.

## Decisions

### D1. File layout

```
specs/persona.md                      human source of truth (reviewed first)
data/profile/summary.json
data/profile/skills.json
data/profile/projects.json
data/profile/experience.json
src/profile/schema.ts                 Zod schemas + inferred types
src/profile/consistency.ts            cross-section checks (pure functions)
tests/profile/schema.test.ts
tests/profile/consistency.test.ts
tests/profile/data.test.ts            validates the committed data + absent terms
```

`data/profile/` sits at the repo root, not under `src/`, because CI syncs it to S3 separately from
code (ADR-0002). Alternative: `src/data/`. Rejected because it mixes deployable data with code.

### D2. Schema shape (Zod 4, all objects strict)

- **summary**: `name`, `fictional: true` (literal), `disclaimer`, `title`, `seniority`,
  `yearsOfExperience` (int), `headline`, `domains[]`, `leadership[]` (short statements), `education[]`
  (`degree`, `field`, `institution`, `graduationYear`).
- **skills**: `[{ name, category, years, aliases[], level? }]`. `category` is an enum (`language`,
  `runtime`, `framework`, `cloud`, `database`, `infrastructure`, `ci-cd`, `testing`, `practice`).
  `level` is an enum (`expert`, `advanced`, `working`).
- **projects**: `[{ id, name, employer, domain, role, period: { start, end | null }, summary,
  tech[], outcomes[] }]`.
- **experience**: `[{ company, title, domain, period: { start, end | null }, highlights[], tech[] }]`.
- Dates are `YYYY-MM` strings. `end: null` means "present".

Strict objects make an unknown field (for example `salary`) a validation error. This is the main
guard for the logistics requirement. Alternative: passthrough objects plus a text scan only.
Rejected because a strict schema catches the problem at the shape level and gives a precise path.

`fictional: z.literal(true)` makes it impossible to drop the marker without failing validation.

### D3. Cross-section consistency is a separate pure step

`checkConsistency(profile)` returns a list of issues (empty means OK):
- every `tech[]` entry in projects and experience matches a skill name or alias (case-insensitive);
- every alias belongs to exactly one skill;
- `skill.years <= summary.yearsOfExperience`;
- project ids are unique.

This check is kept out of the Zod schema (no `superRefine` across files), because each section is
parsed on its own and the loader in Task 1.4 may load sections separately. Alternative: one
combined schema with refinements. Rejected because its error messages are harder to read and
validation would always need all four files at once.

### D4. "Does not have" list format in `specs/persona.md`

Two sections with a fixed heading and a fixed line format, so the test can parse them:

```
## Not in profile: skills and technologies
- Kubernetes -- terms: Kubernetes, k8s, EKS
- Go -- terms: Golang
...
## Not in profile: topics
- Salary -- terms: salary, compensation
...
```

The test reads the `terms` and searches every string in the JSON data, case-insensitively and by
whole word. Terms are explicit, so ambiguous names stay safe: "Go" is matched only as `Golang`,
never as the English word "go". Alternative: a separate machine-readable `absent.json`. Rejected
because it would be a second list that can drift from the spec the user reviews. The golden set
in Task 1.5 will reuse the same parsed list.

### D5. Spec-to-data name check

`specs/persona.md` uses `### Project: <name>` and `### Experience: <company>` headings. The data
test compares those name sets with `projects.json` and `experience.json`. Other facts (years,
outcomes) are checked in review, because a full parser for the Markdown would be more code than
the data itself.

### D6. Persona content rules

- Employer names are invented and must not match real, well-known companies.
- The persona must differ from the repo owner's real background in domains (travel and healthtech)
  and in dates.
- Outcomes use concrete but modest numbers (for example "-30% p95 latency"), so evals have specific
  facts to check.
- Domain-adjacent trap terms (for example HL7/FHIR for healthtech, GDS/Amadeus for travel) go on
  the "does not have" list.

## Risks / Trade-offs

- [The text scan finds a trap term inside an innocent phrase] → Terms are explicit and matched by
  whole word. Data text is written to avoid them. A failing test is a signal to reword.
- [Spec and data drift beyond names] → Owner reviews the spec before any data is generated (a
  stop point in tasks). Data is generated from the reviewed spec in a single step.
- [Zod 4 API differences from Zod 3 examples] → Use `z.strictObject` and pin the major version.
- [The persona is too thin for good evals] → 4–6 projects with outcomes, about 20–30 skills, and
  10+ trap terms across skills and topics.

## Migration Plan

Not applicable. New data, no consumers yet.
