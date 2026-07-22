<!-- Use when completion criteria need consistent project-wide interpretation. Do not impose production checks on trivial changes without a trigger. -->
# Definition of Done

- Status: Active
- Owner: `[quality owner]`

## Minimum completion

- [ ] Acceptance criteria are satisfied.
- [ ] Relevant tests, type checks, lint, and affected builds pass or have documented unavailable reasons.
- [ ] The diff has no unrelated changes.
- [ ] Required documentation and contracts are current.

## Production completion when triggered

- [ ] Security and authorization review completed.
- [ ] Compatibility and migration rehearsed where required.
- [ ] Observability, operational owner, and runbooks are ready.
- [ ] Rollback procedure, release readiness, and post-release checks are approved.
- [ ] Regression protection exists for resolved failures where feasible.

Mark non-applicable items with a reason rather than silently skipping them.
