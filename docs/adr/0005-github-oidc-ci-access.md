# ADR-0005: GitHub OIDC for CI access to AWS

## Status

Accepted. Date: 2026-11-06.

## Context

GitHub Actions must run `terraform plan/apply`, deploy the Lambda and sync profile data to S3. The
repository is public, so fork pull requests and leaked credentials are real threats. Secrets must
never be committed (CLAUDE.md).

## Options considered

1. **IAM user access keys stored as GitHub secrets.**
   - Pros: simple and familiar.
   - Cons: long-lived credentials; manual rotation; a leak gives persistent access.
2. **Self-hosted runner with an instance role.**
   - Pros: no keys in GitHub.
   - Cons: running a self-hosted runner for a public repo is dangerous (untrusted fork code) and
     costs money.
3. **GitHub OIDC federation (`AssumeRoleWithWebIdentity`).**
   - Pros: short-lived credentials per job; no stored secrets; the trust policy can be scoped to
     one repository and branch.
   - Cons: the trust policy has to be written carefully; one-time setup through Terraform.

## Decision

Use GitHub OIDC. Terraform creates the GitHub OIDC identity provider and a deploy role. The role's
trust policy accepts only `token.actions.githubusercontent.com` with `aud = sts.amazonaws.com` and
`sub = repo:<owner>/<repo>:ref:refs/heads/main`. Pull request workflows (including from forks) get
no AWS access. The deploy role's permissions are limited to the resources this project manages.

## Consequences

- Positive: no long-lived AWS keys exist anywhere.
- Positive: only code merged to `main` can deploy.
- Negative: the first apply has to run locally (chicken-and-egg), as ADR-0004 describes.
- Negative: PRs cannot run `terraform plan` against real AWS without a separate read-only role. If
  that becomes necessary, a later ADR will address it.
