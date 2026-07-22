# Task Classification

Use one primary task type and zero or more independent risk modifiers. Classification controls context, artifacts, checks, and approval; it does not authorize execution.

## Primary task types

| Type | Default contract |
| --- | --- |
| Local change | Nearest instructions, affected source/tests, minimum verification; no spec or ADR by default |
| Bug fix | Reproduction and regression test where feasible; add memory only when the lesson is reusable |
| Standard feature | Lightweight task contract; spec when behavior or acceptance criteria are non-trivial |
| Major feature | Full contract, Definition of Ready, spec, implementation plan, rollout and rollback as applicable |
| Architectural change | Requirements, constraints, alternatives, trade-offs, ADR, migration/rollback, approval before implementation |
| Maintenance or upgrade | Compatibility, dependency/source verification, migration and rollback; ADR only for hard-to-reverse choices |
| Production release | Release readiness, owner, health checks, rollback, and explicit execution approval |
| Incident response | Containment and recovery first; incident record only for meaningful production or process impact |

## Risk modifiers

Apply every relevant modifier independently:

```text
Security-sensitive
Database change
Data migration
Public contract change
Performance-sensitive
Reliability-sensitive
External integration
Personal or sensitive data
Infrastructure change
Destructive operation
Cross-service change
```

Each modifier activates its conditional rules, verification, and approval tier. For example, a standard feature with database and public-contract modifiers needs schema/compatibility review without becoming an architectural change automatically.

## Architecture trigger

Activate full system design only when the change affects at least one of:

- Application, module, service, data-ownership, deployment, or infrastructure boundaries.
- Communication patterns or consistency model.
- Public integration contracts.
- Authentication, authorization, or tenant-isolation boundaries.
- Major availability, latency, throughput, technology, or hard-to-reverse vendor decisions.

Ordinary CRUD does not qualify by itself.

For an architectural change require:

1. Requirements, constraints, assumptions, and unknowns.
2. At least three viable alternatives when meaningful.
3. Trade-off comparison and the simplest suitable recommendation.
4. ADR creation or update tied to the requirement served.
5. Migration and rollback consideration.
6. Human approval before implementation.

When only one option is technically viable, document why alternatives fail instead of inventing artificial choices.
