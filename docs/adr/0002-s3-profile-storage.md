# ADR-0002: S3 for profile storage

## Status

Accepted. Date: 2026-11-06.

## Context

The persona profile is small, read-mostly structured data (summary, skills, projects, experience).
It changes rarely, only through reviewed commits. The server must read it in production on AWS
Lambda and from local files during development. Cost should be close to zero.

## Options considered

1. **Bundle the data into the Lambda deployment package.**
   - Pros: simplest option, no runtime I/O, no extra IAM.
   - Cons: every profile change needs a code redeploy; data and code are coupled.
2. **DynamoDB.**
   - Pros: queryable and fast.
   - Cons: overkill for a few small documents; needs schema design and seeding; adds cost and
     complexity.
3. **JSON files in S3.**
   - Pros: very cheap; the same file format locally and in production; the profile can be updated
     by syncing the folder (through CI) without changing code; easy least-privilege access
     (`s3:GetObject` on one prefix).
   - Cons: a network read on cold start; there is no query engine, so search happens in memory.

## Decision

Store the profile as JSON files, one per section, in a private, versioned S3 bucket. The server
reads them through a small storage interface: S3 in production and the local filesystem in
development. Files are validated with a Zod schema on load. CI syncs the data folder to the bucket
after deploy.

## Consequences

- Positive: profile changes ship through CI, separately from code; data is versioned in git and S3.
- Positive: the Lambda role needs read-only access to a single bucket.
- Negative: cold starts include S3 reads; we cache in memory per Lambda instance.
- Negative: search is a simple in-memory match. That is fine for this data size, but it is not
  semantic search.
