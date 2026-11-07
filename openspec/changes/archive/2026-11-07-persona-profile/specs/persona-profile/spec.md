# Spec Delta

## Purpose

Defines the profile data of the openly fictional engineer: its sections, shape and validation
rules, and what it must not contain, so that MCP tools and evals can rely on it as the only source
of facts about the persona.

## ADDED Requirements

### Requirement: Persona spec is the source of truth

The repository SHALL contain `specs/persona.md`. It describes the persona's role and seniority,
years of experience, main stack, domains, 4 to 6 projects with tech and outcomes, work experience,
and education. It also contains a section listing skills, technologies and topics the persona does
not have.

#### Scenario: Spec covers all required sections

- **WHEN** a reviewer opens `specs/persona.md`
- **THEN** it contains sections for role and seniority, experience, stack, domains, projects,
  education, and the "does not have" list

#### Scenario: Project count is within range

- **WHEN** the projects in `specs/persona.md` are counted
- **THEN** there are at least 4 and at most 6

### Requirement: Profile data is split into four sections

The profile data SHALL consist of exactly four JSON files: `summary`, `skills`, `projects` and
`experience`. Each file SHALL hold only its own section.

#### Scenario: All section files present

- **WHEN** the profile data directory is listed
- **THEN** it contains `summary.json`, `skills.json`, `projects.json` and `experience.json`

### Requirement: Profile data passes schema validation

Every section file SHALL validate against the profile schema. Validation SHALL reject unknown
fields and report the path of each invalid field.

#### Scenario: Valid data is accepted

- **WHEN** the committed profile data is validated
- **THEN** validation succeeds for all four sections

#### Scenario: Unknown field is rejected

- **WHEN** a section contains a field the schema does not define (for example `salary`)
- **THEN** validation fails and the error names that field's path

#### Scenario: Missing required field is rejected

- **WHEN** a skill entry has no `years` value
- **THEN** validation fails and the error names the path of the missing field

### Requirement: Persona is marked as fictional

The summary section SHALL state that the persona is fictional, both as a machine-readable flag and
in its text.

#### Scenario: Fictional marker present

- **WHEN** the summary section is read
- **THEN** its fictional flag is true and its text says the persona is fictional

#### Scenario: Fictional flag cannot be false

- **WHEN** the summary section sets the fictional flag to false
- **THEN** validation fails

### Requirement: Skills describe experience depth

Each skill SHALL have a canonical name, a category, a number of years of experience, and a list of
aliases (possibly empty). No skill SHALL claim more years than the persona's total years of
experience.

#### Scenario: Alias resolves to a skill

- **WHEN** the skills section is searched for a listed alias (for example `TS` for TypeScript)
- **THEN** the alias belongs to exactly one skill entry

#### Scenario: Skill years exceed total experience

- **WHEN** a skill claims more years than the persona's total years of experience
- **THEN** the profile consistency check fails

### Requirement: Sections reference only listed skills

Every technology named in a project or a work experience entry SHALL match a skill's name or alias
in the skills section.

#### Scenario: Unlisted technology in a project

- **WHEN** a project lists a technology that is not a skill name or alias
- **THEN** the profile consistency check fails and names the project and the technology

### Requirement: Absent skills are not in the profile

No term from the "does not have" list in `specs/persona.md` SHALL appear anywhere in the profile
data. Not as a skill, alias, project technology, or in any text. Tools can then return "not found"
for these terms.

#### Scenario: Absent skill is not found

- **WHEN** the profile data is searched for a term on the "does not have" list (for example
  `Kubernetes`)
- **THEN** no match is found in any section

#### Scenario: Absent skill added by mistake

- **WHEN** a term from the "does not have" list is added to any section's data
- **THEN** the absent-terms check fails and names the term and the section

### Requirement: Logistics and compensation are not in the profile

The profile SHALL NOT contain location, timezone, work format, spoken languages, salary or
compensation, notice period, availability, or work authorization. Questions about these topics
must result in "not found".

#### Scenario: Salary is not found

- **WHEN** the profile data is searched for salary or compensation information
- **THEN** no match is found

#### Scenario: Location is not found

- **WHEN** the profile data is searched for the persona's location or timezone
- **THEN** no match is found

### Requirement: Profile data matches the persona spec

The profile data SHALL contain the same facts as `specs/persona.md`: the same projects, employers,
roles, periods, skills and years. It SHALL contain no facts that are not in the spec.

#### Scenario: Projects match the spec

- **WHEN** project names in the data are compared with project names in `specs/persona.md`
- **THEN** both sets are identical
