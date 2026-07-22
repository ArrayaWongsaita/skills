# Task Contracts

Use task contracts to prevent silent scope growth in non-trivial work. Adapt depth to repository complexity and task risk.

## Suggested work-item structure

```text
docs/work-items/<WORK-ITEM-ID>/
├── task.md
├── spec.md
├── plan.md
├── decisions.md
└── verification.md
```

Use one combined file for small or medium work when separate documents would add no decision value. Do not create empty companions.

## Required contract content

Record:

- Problem, goal, and user or system outcome.
- Non-goals and testable acceptance criteria.
- Constraints, assumptions, unknowns, and source of truth.
- Allowed scope, forbidden scope, and affected modules.
- Public-contract, data, security, reliability, and observability impacts.
- Migration, rollout, and rollback requirements.
- Primary task type, risk modifiers, risk level, approvals, and owners.
- Verified commands and verification evidence.

Explicitly forbid unrelated refactoring, unjustified dependencies, architecture redesign during ordinary work, combining migration/upgrade/feature work without approval, and silent expansion beyond the contract.

## Specification and plan boundaries

Use a specification for externally observable behavior, important business rules, cross-team contracts, or major features. Use an implementation plan for multi-step, risky, long-running, or coordinated execution. Use an ADR only for durable architectural decisions.

Keep decisions distinct:

- `task.md`: why and bounded outcome.
- `spec.md`: required behavior and contracts.
- `plan.md`: implementation sequence and verification.
- `decisions.md`: scoped choices not warranting an ADR, with status.
- `verification.md`: commands, results, evidence, and residual risk.

Do not let an implementation plan silently redefine an approved specification.
