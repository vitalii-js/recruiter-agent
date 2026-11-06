# Architecture Decision Records

Each significant architectural decision gets its own numbered ADR, written with
[`0000-template.md`](0000-template.md).

Rules:

- New decisions get a new number. Existing ADRs are never rewritten to change the decision.
- When a decision is replaced, the old ADR's status becomes `Superseded by ADR-XXXX` and the new ADR
  says `Supersedes ADR-YYYY`.
- Smaller, day-to-day decisions and lessons learned go in [`../decision-log.md`](../decision-log.md).

| ADR                                         | Title                                    | Status   |
| ------------------------------------------- | ---------------------------------------- | -------- |
| [0001](0001-mcp-server-as-core.md)          | MCP server as the core                   | Accepted |
| [0002](0002-s3-profile-storage.md)          | S3 for profile storage                   | Accepted |
| [0003](0003-lambda-function-url-hosting.md) | AWS Lambda with Function URL for hosting | Accepted |
| [0004](0004-terraform-iac.md)               | Terraform for infrastructure as code     | Accepted |
| [0005](0005-github-oidc-ci-access.md)       | GitHub OIDC for CI access to AWS         | Accepted |
| [0006](0006-testing-and-evals-strategy.md)  | Testing and evals strategy               | Accepted |
