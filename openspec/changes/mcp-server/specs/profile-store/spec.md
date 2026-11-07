# Spec Delta

## Purpose

Loads the persona profile for the MCP tools from local files in development or from S3 in
production, validates it, caches it briefly, and fails closed when the data is missing or invalid.

## ADDED Requirements

### Requirement: Source selection

The profile store SHALL read from S3 when a profile bucket is configured. Otherwise it SHALL read
the local `data/profile/` directory. When running on AWS Lambda without a configured bucket, it
SHALL fail rather than fall back to local files.

#### Scenario: Local development

- **WHEN** no profile bucket is configured and the server is not running on Lambda
- **THEN** the profile is read from the local `data/profile/` files

#### Scenario: Production

- **WHEN** a profile bucket (and optional key prefix) is configured
- **THEN** the profile is read from that bucket and prefix

#### Scenario: Lambda without a bucket

- **WHEN** the server runs on Lambda and no profile bucket is configured
- **THEN** loading fails and tools return the "profile unavailable" failure

### Requirement: Fixed object names

The store SHALL read exactly four objects, `summary.json`, `skills.json`, `projects.json` and
`experience.json`, under the configured location. Object names and paths SHALL NOT be derived
from tool input or request data.

#### Scenario: Tool input never reaches storage

- **WHEN** a tool is called with a term such as `"../secrets"` or `"skills.json"`
- **THEN** the store reads only the four fixed objects and the term is used only for matching

### Requirement: Validation on load

The store SHALL validate every section with the persona-profile schema and run the consistency
checks before the profile is used. If any section is missing, unreadable, not valid JSON, fails
the schema, or fails consistency, the whole load SHALL fail. Partial profiles SHALL never be served.

#### Scenario: Valid data

- **WHEN** all four sections are present and valid
- **THEN** the tools receive the full profile

#### Scenario: Invalid section

- **WHEN** `skills.json` contains an unknown field such as `salary`
- **THEN** loading fails, and the validation details are logged but not returned to clients

#### Scenario: Missing section

- **WHEN** `projects.json` does not exist
- **THEN** loading fails, and tools return the "profile unavailable" failure

### Requirement: Short-lived cache

The store SHALL cache a successfully loaded profile in memory and reuse it for up to 5 minutes.
After that, the next request SHALL reload it, so data synced to S3 without a code deploy is picked
up. Concurrent requests during a load SHALL share that one load.

#### Scenario: Cached reads

- **WHEN** two tool calls arrive within 5 minutes of a successful load
- **THEN** the profile is read from storage only once

#### Scenario: Reload after expiry

- **WHEN** a tool call arrives more than 5 minutes after the last successful load
- **THEN** the profile is read from storage again and the new data is used

#### Scenario: Concurrent cold start

- **WHEN** several tool calls arrive at the same time before any profile is loaded
- **THEN** storage is read once and all calls use that result

### Requirement: Last good profile on reload failure

If a reload after expiry fails, the store SHALL keep serving the last successfully validated
profile and log the failure. If no profile has ever loaded, the failure SHALL reach the tools.

#### Scenario: S3 error after a good load

- **WHEN** the cache has expired and the reload fails with a storage error
- **THEN** tools keep answering from the last validated profile
- **AND** the failure is logged

#### Scenario: Invalid data after a good load

- **WHEN** the cache has expired and the new data fails validation
- **THEN** tools keep answering from the last validated profile, and the invalid data is never
  served

### Requirement: Failure details stay in logs

Load failures SHALL be logged with enough detail to diagnose them (section, validation path or
storage error code). They SHALL NOT be returned to MCP clients.

#### Scenario: Logged, not returned

- **WHEN** loading fails because S3 denies access
- **THEN** the log entry names the section and the error code
- **AND** the client sees only the generic "profile unavailable" message
