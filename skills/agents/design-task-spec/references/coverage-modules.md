# Coverage Modules

Select at least one primary module and every applicable cross-cutting lane. Use these as a coverage audit, not as a questionnaire dump: inspect facts first, then turn only unresolved decisions into frontier questions.

## Contents

- Primary task modules
  - Feature
  - Bug fix
  - Refactor
  - Migration
  - Integration
  - Infrastructure
  - Mixed
- Cross-cutting lanes
  - Frontend and accessibility
  - Data and persistence
  - Asynchronous and distributed behavior
  - Security and privacy
  - Performance and reliability
  - Observability and operations
  - Compatibility and release

## Primary task modules

### Feature

Cover:

- actors, entry points, value, and success signals;
- permissions, eligibility, and feature availability;
- happy paths, empty states, invalid inputs, cancellation, and repeated actions;
- state transitions and effects on existing workflows;
- user-facing, API, event, data, configuration, and analytics changes;
- backward compatibility and phased enablement;
- vertical slices that deliver testable behavior;
- acceptance tests at the observable boundary.

### Bug fix

Cover:

- exact symptom, expected behavior, and affected actors or systems;
- reliable reproduction or the evidence explaining why reproduction is unavailable;
- affected versions, environments, data shapes, and frequency;
- fault localization and evidence-backed root cause;
- triggering preconditions, race windows, and adjacent variants;
- containment, fix boundary, and behavior that must not change;
- corrupted or inconsistent data detection and repair;
- regression tests that fail for the original cause, not only the symptom;
- monitoring that detects recurrence and post-release verification.

### Refactor

Cover:

- motivation and evidence that the current design creates a problem;
- externally observable behavior and performance invariants;
- target boundaries, responsibilities, dependency direction, and naming;
- public contract and stored-data compatibility;
- incremental transition steps and safe intermediate states;
- temporary adapters, duplication, and their removal criteria;
- equivalence, characterization, and regression tests;
- cleanup scope and explicit non-goals.

### Migration

Cover:

- source and target models, ownership, volume, and data quality;
- schema and contract evolution strategy;
- mixed-version operation and deployment ordering;
- dual-read, dual-write, shadow-read, or compatibility adapter decisions;
- backfill batching, throttling, idempotency, checkpointing, and resume behavior;
- validation, reconciliation, audit, and completion thresholds;
- downtime, locks, capacity, and failure recovery;
- rollback boundaries, especially after irreversible writes;
- legacy read/write shutdown and artifact cleanup.

### Integration

Cover:

- system ownership and source of truth;
- transport, wire contract, versioning, and compatibility policy;
- authentication, authorization, secrets, and trust boundaries;
- timeout, retry, backoff, circuit breaking, and rate limits;
- idempotency, deduplication, ordering, replay, and correlation;
- partial failure, dependency outage, dead-letter, and reconciliation behavior;
- sandbox, mock, contract-test, and end-to-end test strategy;
- logs, metrics, tracing, alerting, and operational ownership.

### Infrastructure

Cover:

- affected environments, topology, ownership, and infrastructure-as-code boundary;
- configuration, secrets, identity, permissions, and rotation;
- deployment order, health checks, readiness, and safe convergence;
- capacity, autoscaling, quotas, availability, and failure domains;
- monitoring, alerts, runbooks, escalation, backup, and disaster recovery;
- rollback, state restoration, and irreversible operations;
- cost and resource lifecycle implications;
- local, CI, staging, and production parity.

### Mixed

Select `mixed` when no single module is dominant. Apply every relevant module independently and reconcile conflicting rollout, compatibility, and test needs in one implementation sequence.

## Cross-cutting lanes

### Frontend and accessibility

Cover:

- loading, empty, error, offline, success, and disabled states;
- responsive behavior and supported input methods;
- keyboard flow, focus, semantics, contrast, announcements, and reduced motion;
- localization, formatting, content limits, and truncation;
- server/client ownership, caching, optimistic updates, and stale data;
- visual regression and user-flow verification.

### Data and persistence

Cover:

- ownership, invariants, validation, transactions, and consistency model;
- schema, constraints, indexes, query patterns, and cardinality;
- retention, deletion, privacy requests, audit, and lineage;
- backfill, repair, reconciliation, and duplicate handling;
- pagination, archival, and expected growth;
- fixtures and migration verification.

### Asynchronous and distributed behavior

Cover:

- delivery guarantees, ordering scope, idempotency, and deduplication keys;
- concurrency, races, leases, locks, and atomic boundaries;
- retry ownership, backoff, poison messages, and dead-letter handling;
- timeouts, cancellation, replay, recovery, and eventual consistency;
- correlation, causation, tracing, and operator controls;
- consumer version skew and schema evolution.

### Security and privacy

Cover:

- identities, roles, authorization rules, and tenant isolation;
- trust boundaries, input validation, injection, abuse, and enumeration;
- secrets, encryption, sensitive fields, logging redaction, and data exposure;
- auditability, retention, consent, and compliance constraints;
- dependency or supply-chain implications;
- security-focused negative tests.

### Performance and reliability

Cover:

- measurable constraints and evidence-based load assumptions;
- latency, throughput, fan-out, memory, storage, and network effects;
- caching, invalidation, batching, backpressure, and degradation;
- availability target, failure domains, graceful fallback, and recovery;
- capacity tests and regression thresholds without inventing targets;
- hot-path and worst-case behavior.

### Observability and operations

Cover:

- structured logs, metrics, traces, correlation, and sensitive-data policy;
- dashboards, alerts, thresholds, symptoms, and actionable ownership;
- health checks, runbooks, support diagnostics, and manual recovery;
- release verification, abort signals, and post-release watch period;
- feature flag or operational control lifecycle;
- incident and reconciliation procedures.

### Compatibility and release

Cover:

- API, event, schema, configuration, stored-data, and client compatibility;
- mixed-version behavior and deployment ordering;
- feature flags, canaries, staged exposure, and rollback;
- deprecation, consumer communication, and legacy cleanup;
- release notes, operator steps, and documentation updates;
- irreversible boundaries and restore strategy.

## Coverage discipline

- Do not assume a lane is irrelevant from the task label alone.
- Record each excluded primary module or cross-cutting lane as `N/A — <specific reason>`.
- Promote a lane into the main design when it changes architecture, contracts, sequencing, tests, or readiness.
- Keep the task blocked when a critical lane contains an unresolved decision or unverifiable premise.
