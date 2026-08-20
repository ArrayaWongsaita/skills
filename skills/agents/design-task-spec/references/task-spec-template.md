# Task Specification Template

Use every top-level section. Write `N/A — <reason>` when a section is not applicable. Keep facts, decisions, assumptions, and blockers separate.

## Contents

- Document template
- Status transitions

```markdown
---
status: draft
task_type: feature
last_updated: YYYY-MM-DD
---

# <Outcome-oriented task title>

## Handoff contract

- **Source request**: <issue, prompt, incident, or link>
- **Prepared for**: Implementation agent
- **Approval**: Pending
- **Applicable modules**: <primary and cross-cutting modules>
- **Implementation boundary**: Do not change product behavior or architecture beyond this specification. Re-verify cited facts and return the task to `draft` if the repository contradicts them.

## Executive summary

<Problem, intended outcome, chosen approach, and why it matters in a short paragraph.>

## Product intent

### Problem and evidence

<Observed need and evidence that the problem exists.>

### Actors and value

<Affected users, operators, systems, or stakeholders and the value each receives.>

### Success signals

<Observable product or operational signals that demonstrate the outcome. Do not invent numeric targets.>

## Scope

### Goals

- <Required outcome>

### Non-goals

- <Explicitly excluded outcome>

### Constraints and invariants

- <Compatibility, policy, timing, platform, or behavior that must remain true>

## Evidence and current state

### Verified facts

- `<path>:<line>` — `<symbol>`: <fact>
- `<command, test, log, or authoritative URL>`: <fact>

### Current behavior and data flow

<Describe relevant components, boundaries, state, and sequence today.>

### Existing tests and observability

<Current coverage, metrics, logs, alerts, dashboards, and gaps.>

## Target behavior

### Behavior rules

- <Unambiguous rule, including permissions and state transitions>

### Scenarios

1. **<Happy or unhappy path>**
   - Given: <precondition>
   - When: <action or event>
   - Then: <observable result>

### Failure and recovery behavior

<Validation, partial failure, retry, timeout, idempotency, concurrency, ordering, and recovery semantics.>

## Implementation design

### Architecture and boundaries

<Chosen components, responsibilities, ownership, and dependency direction.>

### Interfaces and contracts

<Public APIs, commands, events, schemas, types, configuration, compatibility, and versioning. Include exact wire shapes only when the decision is established.>

### Persistence and data lifecycle

<Reads, writes, transactions, indexes, retention, migration, backfill, reconciliation, and cleanup.>

### Security and privacy

<Authentication, authorization, trust boundaries, secrets, sensitive data, abuse cases, and audit needs.>

### Performance and reliability

<Load assumptions, latency or throughput constraints, availability, resource limits, degradation, and capacity implications.>

## Delivery plan

### Implementation sequence

1. <Vertical, verifiable change>

### Compatibility and migration

<Deployment order, mixed-version behavior, data migration, feature flags, and legacy removal.>

### Observability and operations

<Logs, metrics, traces, dashboards, alerts, runbooks, ownership, and post-release verification.>

### Rollout and rollback

<Stages, gates, abort signals, rollback steps, and irreversible boundaries.>

## Verification

### Test plan

- **Unit**: <behavior and boundary>
- **Integration/contract**: <cross-component behavior>
- **End-to-end/manual**: <user or operator outcome>
- **Migration/operational**: <data and rollout verification>

### Acceptance criteria

- [ ] <Externally observable, binary criterion>

## Decisions and knowledge gaps

### Decisions

- **<Decision>** — <choice, owner, reason, and rejected alternatives>

### Assumptions

- **<Assumption>** — <evidence gap and invalidation condition>

### Blockers

- **<Blocker>** — Owner: <owner>; prevents: <downstream work>

### Coverage exclusions

- **<Module or lane>**: N/A — <reason>

## Readiness checklist

- [ ] Product goal, actors, value, and success signals are confirmed.
- [ ] Scope, non-goals, constraints, and invariants are explicit.
- [ ] Repository facts are source-linked and current behavior is understood.
- [ ] Target rules and meaningful happy, edge, and failure scenarios are complete.
- [ ] Architecture, contracts, data flow, and ownership are decided.
- [ ] Security, privacy, reliability, and operational implications are covered or justified as N/A.
- [ ] Compatibility, migration, rollout, rollback, and legacy cleanup are decided or justified as N/A.
- [ ] Tests and acceptance criteria prove each required outcome.
- [ ] No critical assumption, blocker, or open decision remains.
- [ ] The user confirmed the shared-understanding summary.
```

## Status transitions

- Start at `draft`.
- Set `blocked` when critical evidence or a decision remains unavailable.
- Set `ready-for-implementation` only after every checklist item is satisfied and the user explicitly approves the final shared-understanding summary.
- Return to `draft` after any material change and clear the recorded approval.
