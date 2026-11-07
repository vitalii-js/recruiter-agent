# Spec Delta

## Purpose

A public, stateless MCP endpoint whose tools answer questions about the fictional persona only
from the profile data, and say "not found" when the profile has no answer.

## ADDED Requirements

### Requirement: Stateless streamable HTTP endpoint

The server SHALL expose MCP over the streamable HTTP transport at the path `/mcp`, without
sessions. It SHALL NOT issue an `Mcp-Session-Id`, and any server instance SHALL be able to answer
any request. Responses SHALL be plain JSON, not an SSE stream.

#### Scenario: Initialize without a session

- **WHEN** a client sends an `initialize` request to `POST /mcp`
- **THEN** the server responds with a JSON result containing its name, version and tool capability
- **AND** the response has no `Mcp-Session-Id` header

#### Scenario: Tool call on a fresh instance

- **WHEN** a client sends `tools/call` to `POST /mcp` without first calling `initialize` on the same
  instance
- **THEN** the server runs the tool and returns its result

#### Scenario: Unsupported methods and paths

- **WHEN** a client sends `GET /mcp` or `DELETE /mcp`
- **THEN** the server responds with HTTP 405 and does not open a stream
- **WHEN** a client sends any request to a path other than `/mcp`
- **THEN** the server responds with HTTP 404

### Requirement: Server instructions for clients

The `initialize` result SHALL include instructions telling the client's model that the persona is
fictional, that answers must come only from tool results, and that a `not_found` result means the
information is not in the profile and must not be guessed.

#### Scenario: Instructions are returned

- **WHEN** a client calls `initialize`
- **THEN** the result's `instructions` mention that the persona is fictional
- **AND** they tell the model to answer only from tool results and to report `not_found` plainly

### Requirement: Tool set

The server SHALL list exactly four tools: `get_summary`, `get_skills`, `get_projects` and
`search_experience`. Each tool SHALL declare an input schema and an output schema, and a
description that says the tool takes a short term, not a full question.

#### Scenario: Listing tools

- **WHEN** a client calls `tools/list`
- **THEN** the result contains exactly the four tools, each with `inputSchema` and `outputSchema`

### Requirement: Shared result contract

Every tool SHALL return one of three outcomes. `found` and `not_found` are normal results
(`isError` false) whose structured content has a `status` field and is repeated as JSON text in
the content. A failure is an error result (`isError` true) with a generic message only.

#### Scenario: Found result

- **WHEN** a tool finds matching profile data
- **THEN** the structured content is `{ status: "found", items: [...] }`, with `query` when one was
  given
- **AND** the text content holds the same data as JSON
- **AND** `isError` is false

#### Scenario: Not found result

- **WHEN** a tool finds no matching profile data for `"Kubernetes"`
- **THEN** the structured content is `{ status: "not_found", query: "Kubernetes", message }`
- **AND** the text content says the profile has no information about "Kubernetes" and that the
  model must not infer or guess it
- **AND** `isError` is false

#### Scenario: Profile unavailable

- **WHEN** the profile cannot be loaded or fails validation
- **THEN** the tool returns `isError: true` with the text "The profile is temporarily unavailable."
- **AND** the result contains no stack trace, file path, bucket name, object key or AWS error text

### Requirement: Term matching

Tools that take a term SHALL treat it as a short term, not a question. Matching SHALL be
case-insensitive, on word boundaries, and on the whole term as one phrase, after trimming and
collapsing whitespace. The term SHALL be searched for in the profile data, and profile values SHALL
never be searched for inside the term.

#### Scenario: Whole words only

- **WHEN** `search_experience` is called with `"Java"`
- **THEN** the result is `not_found`, even though the profile mentions JavaScript

#### Scenario: Whole phrase, not any word

- **WHEN** `get_skills` or `search_experience` is called with `"React Native"`
- **THEN** the result is `not_found`, even though the profile has the skill React

#### Scenario: Case and spacing are ignored

- **WHEN** `get_skills` is called with `"  typescript "`
- **THEN** the result is `found` with the TypeScript skill

### Requirement: Alias expansion

When a term equals the name or an alias of a profile skill (ignoring case), tools that search by
technology or text SHALL also match that skill's canonical name and all its aliases.

#### Scenario: Alias finds canonical name

- **WHEN** `get_projects` is called with technology `"TS"`
- **THEN** the result includes every project whose tech list contains TypeScript

#### Scenario: Canonical name finds alias text

- **WHEN** `search_experience` is called with `"Tech lead"`
- **THEN** the result includes the summary leadership text that mentions "Tech Lead"

### Requirement: Input limits

Tool inputs SHALL be strict: unknown arguments, empty or whitespace-only terms, and terms longer
than 100 characters SHALL be rejected as invalid input. The request body SHALL be limited in size.

#### Scenario: Empty term

- **WHEN** `search_experience` is called with `"   "`
- **THEN** the call is rejected as invalid input, and no profile search runs

#### Scenario: Term too long

- **WHEN** `get_skills` is called with a 101-character term
- **THEN** the call is rejected as invalid input

#### Scenario: Unknown argument

- **WHEN** `get_projects` is called with `{ "technology": "Terraform", "salary": "x" }`
- **THEN** the call is rejected as invalid input

#### Scenario: Oversized request

- **WHEN** a request body is larger than 64 KB
- **THEN** the server responds with HTTP 413 without parsing it

### Requirement: get_summary

`get_summary` SHALL take no arguments and return the persona summary, including the fictional
flag and the disclaimer text.

#### Scenario: Summary is returned

- **WHEN** a client calls `get_summary`
- **THEN** the result is `found` with one item holding the summary
- **AND** the item has `fictional: true` and the disclaimer

### Requirement: get_skills

`get_skills` SHALL accept an optional `query` (term) and an optional `category` (one of the profile
skill categories). `query` SHALL match a skill's name or alias exactly (after normalization). With
both, a skill SHALL match both. With neither, all skills are returned.

#### Scenario: All skills

- **WHEN** `get_skills` is called with no arguments
- **THEN** the result is `found` with every skill in the profile

#### Scenario: Skill by alias

- **WHEN** `get_skills` is called with `{ "query": "Postgres" }`
- **THEN** the result is `found` with the PostgreSQL skill, including years and level

#### Scenario: Skill by category

- **WHEN** `get_skills` is called with `{ "category": "testing" }`
- **THEN** the result is `found` with Jest and Vitest only

#### Scenario: Absent skill

- **WHEN** `get_skills` is called with `{ "query": "Kubernetes" }`
- **THEN** the result is `not_found` for `"Kubernetes"`

#### Scenario: Term that is not a skill name

- **WHEN** `get_skills` is called with `{ "query": "Amazon" }`
- **THEN** the result is `not_found`, because no skill is named or aliased exactly "Amazon"

#### Scenario: Query and category disagree

- **WHEN** `get_skills` is called with `{ "query": "Terraform", "category": "testing" }`
- **THEN** the result is `not_found`

#### Scenario: Invalid category

- **WHEN** `get_skills` is called with `{ "category": "mobile" }`
- **THEN** the call is rejected as invalid input

### Requirement: get_projects

`get_projects` SHALL accept an optional `technology` (term). With it, the result SHALL contain the
projects whose tech list matches the term after alias expansion. Without it, all projects are
returned.

#### Scenario: All projects

- **WHEN** `get_projects` is called with no arguments
- **THEN** the result is `found` with every project, including tech, period and outcomes

#### Scenario: Projects by technology alias

- **WHEN** `get_projects` is called with `{ "technology": "Lambda" }`
- **THEN** the result contains exactly the projects whose tech list contains AWS Lambda

#### Scenario: A skill no project uses

- **WHEN** `get_projects` is called with `{ "technology": "React" }`
- **THEN** the result is `not_found`, because no project lists React

#### Scenario: Absent technology

- **WHEN** `get_projects` is called with `{ "technology": "GraphQL" }`
- **THEN** the result is `not_found`

### Requirement: search_experience

`search_experience` SHALL require a `query` (term) and search the work experience entries, the
projects and the summary text. Each hit SHALL name its section (`experience`, `project` or
`summary`), identify the entry, and list the fields that matched.

#### Scenario: Hit in a project

- **WHEN** `search_experience` is called with `"idempotency"`
- **THEN** the result is `found` and includes the Idempotent Booking Service with section `project`
  and the matching field

#### Scenario: Hits in several sections

- **WHEN** `search_experience` is called with `"Healthtech"`
- **THEN** the result includes hits from `experience`, `project` and `summary`

#### Scenario: Absent topic

- **WHEN** `search_experience` is called with `"salary"`, `"visa"` or `"remote"`
- **THEN** the result is `not_found`

#### Scenario: Absent skill

- **WHEN** `search_experience` is called with `"Kafka"`
- **THEN** the result is `not_found`

### Requirement: Read-only and no outbound calls

The tools SHALL NOT modify profile data and SHALL NOT call any external service other than
reading the profile through the profile store.

#### Scenario: Repeated calls give the same answer

- **WHEN** the same tool is called twice with the same input and the profile has not changed
- **THEN** both results are identical
