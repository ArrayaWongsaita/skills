# Governance Model

Use this reference to select the smallest governance profile and separate durable guidance by purpose.

## Complexity classification

Classify from observed evidence, not repository size alone. Choose the highest profile clearly justified by deployment, ownership, contracts, data, security, CI, migration, and operational complexity.

| Class | Evidence | Default governance |
| --- | --- | --- |
| Small | One bounded application or library, one deployment unit or none, simple CI, few owners, no material cross-system coordination | One concise root `AGENTS.md`, verified commands, minimum Definition of Done; reuse existing docs |
| Medium | Several packages or applications, meaningful data/security/release concerns, or more than one ownership boundary | Root router, a few scoped instructions, conditional testing/security/data/release rules, lightweight specs and memory index |
| Large | Multiple deployment units or teams, public contracts, complex CI, migrations, significant operations, or several high-risk domains | Root router, justified service instructions, task contracts, ADR/risk controls, engineering memory, release/rollback, registry, validation, evals |
| Multi-system | Independently deployed systems with cross-system data, contracts, observability, compatibility, or deployment sequencing | Large profile plus explicit data ownership, contract governance, service-specific instructions, migration/dependency sequencing, cross-service observability |

Do not average conflicting signals. A small codebase handling payments may need focused security controls without receiving an entire large-repository hierarchy.

## Five governance layers

1. **Root instructions:** invariants, task classification, routing, approvals, minimum verification, and context limits.
2. **Scoped instructions:** only rules unique to a meaningful application, service, data package, shared library, or infrastructure boundary.
3. **Conditional rules:** detailed task guidance activated by explicit triggers.
4. **Sources of truth:** product requirements, specs, architecture, ADRs, plans, runbooks, incidents, and lessons.
5. **Automated enforcement:** types, lint, tests, scanners, CI gates, runtime validation, monitoring, and alerts.

Every proposed file must answer: what observed need activates it, who maintains it, how an agent finds it, and why an existing source cannot serve the same purpose.

## Source-of-truth policy

Start with this candidate order and adapt it when the repository has an established authoritative system:

1. Approved specification
2. Accepted ADR
3. Public API, event, and schema contracts
4. Current architecture documentation
5. Applicable instructions
6. Executable tests
7. Current implementation
8. Historical documentation

When sources conflict:

1. Name the conflicting sources, scopes, statuses, dates, and owners.
2. Check whether either source is explicitly superseded.
3. Avoid risky or irreversible implementation.
4. Propose a resolution and obtain the required owner approval.
5. Record the resolution and update or supersede stale sources without deleting history.

## Definition of Ready

Require readiness for non-trivial work, not mechanical local changes. Confirm the problem, outcome, testable acceptance criteria, non-goals, contracts, security/data effects, resolved or deferred architecture questions, dependencies, risk, migration/rollout impact, and verification strategy.

When work is not ready, investigate, clarify, draft a spec, or surface decisions. Do not guess critical business rules and treat them as approved.

## Layered Definition of Done

Minimum completion, when applicable:

- Acceptance criteria are satisfied.
- Relevant tests, type checks, lint, and affected builds pass.
- The diff contains no unrelated changes.
- Required documentation is current.

Add production completion only when triggered: security and authorization review, migration rehearsal, compatibility checks, observability, rollback, release readiness, post-release checks, operational ownership, runbook updates, and regression protection.
