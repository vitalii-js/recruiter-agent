# ADR-0003: AWS Lambda with Function URL for hosting

## Status

Accepted. Date: 2026-11-06.

## Context

The MCP server needs a public HTTPS endpoint. Traffic will be very low and bursty: recruiters and
demo sessions. The repository is public, so the endpoint must be protected against cost abuse. The
server is stateless (ADR-0001).

## Options considered

1. **ECS Fargate or App Runner container.**
   - Pros: long-lived process; easy to support SSE or sessions.
   - Cons: pays for idle time; more infrastructure to manage.
2. **Lambda behind API Gateway (HTTP API).**
   - Pros: throttling, custom domains, authorizers and usage plans.
   - Cons: another service to configure and pay for; has a 30 s integration timeout; more than the
     MVP needs.
3. **Lambda with a Function URL.**
   - Pros: built-in HTTPS endpoint with no extra service; pay per request with an effectively free
     idle cost; the simplest Terraform; supports response streaming.
   - Cons: no built-in throttling, WAF or API keys; the URL is not a custom domain.

## Decision

Run the server on AWS Lambda (Node.js 22 runtime) with a public Function URL (`AuthType: NONE`;
MCP clients connect anonymously). Protect the public endpoint with:

- a low **reserved concurrency** limit,
- a short function **timeout**,
- an **AWS Budget** with an email alert at a small monthly amount.

## Consequences

- Positive: near-zero cost; minimal infrastructure; stateless design fits the Lambda lifecycle.
- Negative: no per-client rate limiting in the MVP. Reserved concurrency caps total throughput, so
  abuse degrades availability rather than cost. A per-IP limit comes in phase 2.
- Negative: cold starts add latency to the first request.
- Follow-up: if we need WAF, a custom domain or per-client limits, a later ADR may move to
  CloudFront or API Gateway.
