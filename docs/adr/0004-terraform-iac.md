# ADR-0004: Terraform for infrastructure as code

## Status

Accepted. Date: 2026-11-06.

## Context

All AWS resources (S3, Lambda, IAM, SSM, Budgets, the OIDC provider) must be reproducible, go
through review, and be deployable from CI. Manual console changes are not allowed. The project is a
portfolio piece, so the tool should be widely recognized.

## Options considered

1. **AWS CDK.**
   - Pros: TypeScript, the same language as the app; high-level constructs.
   - Cons: synthesizes to CloudFormation (slower deploys, stack drift handling); AWS-only.
2. **AWS SAM / CloudFormation.**
   - Pros: native Lambda support; managed state.
   - Cons: verbose YAML; AWS-only; weaker plan/diff experience.
3. **Terraform.**
   - Pros: industry standard; clear `plan` before `apply`; multi-cloud skills; big ecosystem.
   - Cons: we have to manage state ourselves; there is a chicken-and-egg problem with the state
     bucket.

## Decision

Use Terraform for all infrastructure, in `infra/`. State lives in an **S3 backend** with encryption
and versioning. A separate small `infra/bootstrap` configuration with local state creates the state
bucket once. The first apply runs locally with the owner's credentials (it creates the CI OIDC
role); after that, only CI applies.

## Consequences

- Positive: every change shows up as a reviewed `terraform plan`; the environment can be rebuilt
  from code.
- Negative: state files can contain sensitive values. They are gitignored, blocked for the agent,
  and stored only in the encrypted S3 backend.
- Negative: the bootstrap config is a one-time manual step that must be documented.
- `terraform apply` always needs explicit human confirmation in Claude Code; `terraform destroy` is
  denied.
