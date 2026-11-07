# Persona: Alex Rivera

> **Alex Rivera is a fictional person.** This persona exists only to demonstrate an AI agent that
> answers recruiters' questions. Employers, projects and the university below are invented.

This file is the human-readable source of truth for the profile data in `data/profile/`. The data
must match this file exactly: no extra facts, nothing missing.

## Role and seniority

- **Name:** Alex Rivera
- **Title:** Senior Backend / Platform Engineer
- **Seniority:** Senior, currently Tech Lead of a platform team
- **Headline:** Backend and platform engineer who builds event-driven systems on AWS serverless
  with TypeScript and Terraform.

## Experience summary

- **Total years of professional experience:** 8 (since June 2018)
- **Leadership:**
  - Tech Lead of a platform team of 4 engineers since March 2024.
  - Mentored 2 junior engineers to mid-level.
  - Introduced a lightweight RFC process for cross-team technical decisions.
  - Took part in the on-call rotation for production services since 2021.

## Main stack

| Skill                     | Category       | Years | Level    | Aliases                     |
| ------------------------- | -------------- | ----- | -------- | --------------------------- |
| TypeScript                | language       | 8     | expert   | TS                          |
| JavaScript                | language       | 8     | expert   | JS                          |
| SQL                       | language       | 8     | advanced |                             |
| Node.js                   | runtime        | 8     | expert   | Node, NodeJS                |
| Express                   | framework      | 3     | advanced | Express.js                  |
| Fastify                   | framework      | 1     | advanced |                             |
| React                     | framework      | 2     | working  | React.js                    |
| AWS                       | cloud          | 5     | advanced | Amazon Web Services         |
| AWS Lambda                | cloud          | 5     | expert   | Lambda                      |
| Amazon SQS                | cloud          | 3     | advanced | SQS                         |
| Amazon EventBridge        | cloud          | 2     | advanced | EventBridge                 |
| Amazon S3                 | cloud          | 3     | advanced | S3                          |
| Amazon API Gateway        | cloud          | 3     | advanced | API Gateway                 |
| Amazon CloudWatch         | cloud          | 5     | advanced | CloudWatch                  |
| PostgreSQL                | database       | 8     | advanced | Postgres                    |
| Amazon DynamoDB           | database       | 5     | advanced | DynamoDB                    |
| Redis                     | database       | 3     | working  |                             |
| Terraform                 | infrastructure | 5     | expert   |                             |
| Docker                    | infrastructure | 3     | advanced |                             |
| GitHub Actions            | ci-cd          | 3     | advanced |                             |
| Jest                      | testing        | 5     | advanced |                             |
| Vitest                    | testing        | 2     | advanced |                             |
| Event-driven architecture | practice       | 5     | advanced | EDA                         |
| Technical leadership      | practice       | 3     | advanced | Tech lead                   |
| Incident response         | practice       | 5     | advanced | On-call, Production support |

## Domains

- **Travel:** fare search, booking flows, supplier API integrations.
- **Healthtech:** lab results processing, patient data access auditing, HIPAA-driven compliance
  work.
- **Developer platforms:** internal tooling, infrastructure modules, CI/CD for product teams.

## Work experience

### Experience: Saltmarsh Travel

- **Title:** Backend Engineer
- **Domain:** Travel
- **Period:** 2018-06 to 2021-08
- **Highlights:**
  - Built and maintained the fare search and booking backend for a mid-size online travel agency.
  - Integrated with external supplier APIs for flights and hotels.
  - Moved the team's services from manual deploys to Docker-based deploys.
- **Tech:** TypeScript, Node.js, Express, Fastify, PostgreSQL, Redis, Docker, Jest

### Experience: Meridale Health

- **Title:** Senior Backend Engineer
- **Domain:** Healthtech
- **Period:** 2021-09 to 2024-02
- **Highlights:**
  - Designed event-driven processing of lab results on AWS serverless.
  - Built the audit log for access to patient data.
  - Wrote Terraform for the team's AWS infrastructure.
  - Built small React admin screens for internal operations staff.
- **Tech:** TypeScript, Node.js, AWS Lambda, Amazon SQS, Amazon EventBridge, Amazon DynamoDB,
  Amazon S3, Amazon API Gateway, Amazon CloudWatch, PostgreSQL, Terraform, React, Jest

### Experience: Meridale Health

- **Title:** Tech Lead, Platform Team
- **Domain:** Developer platforms
- **Period:** 2024-03 to present
- **Highlights:**
  - Leads a platform team of 4 engineers that serves the product teams.
  - Owns shared Terraform modules and reusable GitHub Actions workflows.
  - Led an AWS cost optimization effort.
  - Mentors 2 junior engineers.
- **Tech:** TypeScript, Node.js, Terraform, GitHub Actions, AWS Lambda, Amazon DynamoDB,
  Amazon CloudWatch, Vitest

## Projects

### Project: Fare Search Cache

- **Employer:** Saltmarsh Travel
- **Domain:** Travel
- **Role:** Backend Engineer
- **Period:** 2019-03 to 2020-06
- **Summary:** A caching layer in front of supplier fare APIs, with time-based invalidation per
  route.
- **Tech:** TypeScript, Node.js, Redis, PostgreSQL
- **Outcomes:**
  - p95 search latency dropped from 1.8 s to 450 ms.
  - Calls to supplier APIs dropped by 40%.

### Project: Idempotent Booking Service

- **Employer:** Saltmarsh Travel
- **Domain:** Travel
- **Role:** Backend Engineer
- **Period:** 2020-07 to 2021-08
- **Summary:** A rewrite of the booking API with idempotency keys and safe retries towards
  suppliers.
- **Tech:** TypeScript, Node.js, Fastify, PostgreSQL, Docker, Jest
- **Outcomes:**
  - Duplicate bookings caused by client retries dropped to zero.
  - Booking-related support tickets dropped by 35%.

### Project: Lab Results Pipeline

- **Employer:** Meridale Health
- **Domain:** Healthtech
- **Role:** Senior Backend Engineer
- **Period:** 2021-11 to 2023-03
- **Summary:** An event-driven pipeline that ingests lab results from partner labs, validates them
  and makes them available to clinicians.
- **Tech:** TypeScript, AWS Lambda, Amazon SQS, Amazon EventBridge, Amazon DynamoDB, Terraform
- **Outcomes:**
  - Time from lab result to clinician view dropped from 15 minutes (nightly batches) to under
    30 seconds.
  - Handles about 120,000 results per day.

### Project: Patient Data Access Audit Log

- **Employer:** Meridale Health
- **Domain:** Healthtech
- **Role:** Senior Backend Engineer
- **Period:** 2023-04 to 2024-01
- **Summary:** An append-only audit log of every access to patient records, with a query API for
  the compliance team.
- **Tech:** TypeScript, AWS Lambda, Amazon DynamoDB, Amazon S3, Amazon API Gateway, Terraform
- **Outcomes:**
  - The yearly compliance audit found no issues in access logging.
  - Audit queries that took hours of manual work now take minutes.

### Project: Internal Delivery Platform

- **Employer:** Meridale Health
- **Domain:** Developer platforms
- **Role:** Tech Lead
- **Period:** 2024-03 to present
- **Summary:** Shared Terraform modules and reusable GitHub Actions workflows that product teams
  use to create and ship new services.
- **Tech:** Terraform, GitHub Actions, AWS Lambda, Amazon CloudWatch, TypeScript
- **Outcomes:**
  - Setting up a new service went from about 3 days to about 2 hours.
  - 25 services were onboarded onto the platform.

### Project: AWS Cost Optimization

- **Employer:** Meridale Health
- **Domain:** Developer platforms
- **Role:** Tech Lead
- **Period:** 2024-09 to 2025-03
- **Summary:** A review of Lambda memory settings, DynamoDB capacity modes and log retention
  across all services.
- **Tech:** AWS Lambda, Amazon DynamoDB, Amazon CloudWatch, Terraform
- **Outcomes:**
  - The monthly AWS bill dropped by 28%.

## Education

- **Degree:** BSc in Computer Science
- **Institution:** University of Northbrook (fictional)
- **Graduation year:** 2018

## Not in profile: skills and technologies

The persona does **not** have these skills. The profile data must not mention them, and the agent
must say they are not in the profile. Matching uses only the listed terms, as whole words,
ignoring case.

- Kubernetes -- terms: Kubernetes, k8s, EKS, Helm
- Google Cloud -- terms: GCP, Google Cloud
- Microsoft Azure -- terms: Azure
- Go -- terms: Golang
- Java and Spring -- terms: Java, Spring, Spring Boot
- Kotlin -- terms: Kotlin
- Apache Kafka -- terms: Kafka, MSK
- MongoDB -- terms: MongoDB, Mongo
- Pulumi -- terms: Pulumi
- AWS CloudFormation and CDK -- terms: CloudFormation, CDK
- GraphQL -- terms: GraphQL
- React Native and mobile -- terms: React Native, Swift, iOS, Android
- Python and machine learning -- terms: Python, machine learning, TensorFlow, PyTorch
- Rust -- terms: Rust
- HL7 and FHIR (healthcare data standards) -- terms: HL7, FHIR
- Travel GDS (Amadeus, Sabre) -- terms: GDS, Amadeus, Sabre

## Not in profile: topics

The profile intentionally says nothing about these topics. The agent must say this information is
not in the profile.

- Location -- terms: location, based in, relocation, relocate
- Timezone -- terms: timezone, time zone, UTC
- Work format -- terms: remote, hybrid, onsite, on-site
- Spoken languages -- terms: spoken languages, native speaker, fluent
- Salary and compensation -- terms: salary, compensation, hourly rate, expected pay
- Notice period and start date -- terms: notice period, start date, available to start
- Work authorization -- terms: visa, work permit, sponsorship, citizenship
