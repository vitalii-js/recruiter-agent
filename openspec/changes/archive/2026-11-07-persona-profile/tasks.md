# Tasks

## 1. Persona spec (Task 1.2)

- [x] 1.1 Write `specs/persona.md` for Alex Rivera (fictional marker, role and seniority, about 8
      years, stack, travel and healthtech domains, tech-lead experience, education). Verify that every
      section required by the spec exists.
- [x] 1.2 Add 4–6 projects as `### Project: <name>` (domain, role, period, tech, outcomes with
      numbers) and work history as `### Experience: <company>` with invented employers. Verify the
      project count is 4–6 and the periods add up to the stated total years.
- [x] 1.3 Add `## Not in profile: skills and technologies` and `## Not in profile: topics` in the
      `- <Name> -- terms: a, b` format (10+ skill traps including domain-adjacent ones, plus the
      logistics and compensation topics). Verify `npm run lint` (Prettier) passes on the file.
- [x] 1.4 **STOP:** present `specs/persona.md` to the owner and wait for approval before starting
      group 2. Verify: explicit owner approval in the conversation.

## 2. Schema and consistency checks

- [x] 2.1 Add `zod` (v4) as a runtime dependency. Verify `npm install` succeeds and `npm run
    typecheck` passes.
- [x] 2.2 Implement `src/profile/schema.ts` (strict section schemas per design D2, inferred types).
      Add `tests/profile/schema.test.ts` that covers: a valid fixture is accepted; an unknown field
      (`salary`) is rejected with its path; a missing `years` is rejected; `fictional: false` is
      rejected. Verify `npm test` passes.
- [x] 2.3 Implement `src/profile/consistency.ts` (design D3). Add `tests/profile/consistency.test.ts`
      that covers an unlisted project tech, a duplicate alias, skill years above the total, and
      duplicate project ids, each reported with its location. Verify `npm test` passes.
- [x] 2.4 Implement a small parser for the "Not in profile" sections and the
      `### Project:`/`### Experience:` headings in `specs/persona.md` (design D4/D5), with unit
      tests on an inline Markdown sample. Verify `npm test` passes.

## 3. Profile data (Task 1.3)

- [x] 3.1 Generate `data/profile/{summary,skills,projects,experience}.json` from the approved
      `specs/persona.md`. Verify that every fact maps to the spec and nothing is added.
- [x] 3.2 Add `tests/profile/data.test.ts`, which checks four things against the committed data. All
      four sections pass the schema. The consistency check returns no issues. No "Not in profile"
      term (skills or topics) appears in any string. Project and experience names equal the spec
      headings. Verify `npm test` passes, and that adding a trap term to a copy of the data makes
      the test fail.

## 4. Wrap-up

- [x] 4.1 Run `npm run lint`, `npm run typecheck` and `npm test`. Verify all three pass.
- [x] 4.2 Add a short entry to `docs/decision-log.md` (what was done, what went wrong, how it was
      fixed). Verify the entry exists.

## Workflow follow-up

- Review in a fresh Claude Code session (`/review`), then owner review, then squash merge to main.
- Archive the change with `/opsx:archive` after merge.
