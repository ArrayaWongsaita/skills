# Security and Reliability

Load this reference only when a security, reliability, compatibility, migration, or production-critical trigger is present.

## Security triggers

Authentication, authorization, sessions, tokens, payments, uploads, webhooks, administration, user-controlled input, personal or sensitive data, secrets, external integrations, or tenant isolation require security routing.

Consider:

- Assets, actors, trust boundaries, abuse cases, and threat model.
- Input validation, output encoding, authentication, authorization, and least privilege.
- Audit logging, secret handling, rate limiting, replay prevention, and idempotency.
- Dependency risk, secure failure behavior, sensitive-log redaction, and security testing.

Never place approval gates or prohibitions on exposing secrets only in an optional security document; keep them in always-loaded instructions too.

## Reliability triggers

Critical request paths, background jobs, external calls, queues, events, payments, data synchronization, long-running processing, or explicit availability targets require reliability routing.

Consider failure modes, timeouts, retry ownership, backoff, idempotency, circuit breaking only when justified, dead-letter handling, recovery, SLI/SLO, observability, capacity, and rollback. Do not introduce distributed-system patterns merely because they are conventional.

## Observability contract

For production-critical behavior, define structured logs, metrics, traces, correlation identifiers, health indicators, actionable alerts, dashboards when justified, prohibited sensitive fields, expected baselines, ownership, and post-release verification. Tie alerts to meaningful user or system symptoms. Do not require a dashboard for a trivial change.

## Compatibility and migration

For public APIs, events, schemas, shared packages, or configuration changes, consider consumers, versioning, deprecation, migration period, contract tests, deployment order, rollback, backfill, and dual-read/write risks.

Use expand-and-contract only when independent deployment, compatibility, or rollback requirements justify it. Record data rollback limitations explicitly.
