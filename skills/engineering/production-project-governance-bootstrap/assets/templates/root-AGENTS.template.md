<!-- Use for repository-wide invariants and routing. Do not use as a full architecture, testing, security, database, or release manual. Delete this comment after adaptation. -->
# Repository Agent Instructions

## Scope and sources of truth

- Scope: `[repository root and all descendants unless narrower instructions apply]`
- Authoritative project sources, in repository-specific order: `[verified paths and statuses]`
- On conflict: report the sources, scope, status, and risk; do not silently choose.

## Safety invariants

- Preserve uncommitted and unrelated work.
- Do not expose secrets or execute destructive/production actions without the repository's explicit human gate.
- Do not expand task scope, add dependencies, or redesign architecture without justification and approval.

## Classify and route work

Classify one primary task type and all risk modifiers before planning. Add only verified routes:

| Trigger | Read | Required workflow | Verification | Escalate when |
| --- | --- | --- | --- | --- |
| `[observable trigger]` | `[relative link]` | `[required steps]` | `[verified command/check]` | `[approval or unresolved condition]` |

## Working context

Start with the task contract, nearest applicable instructions, relevant source/tests, and directly applicable specs. Do not load the entire documentation, ADR, incident, lesson, or skill tree.

## Minimum completion

- Acceptance criteria are satisfied.
- Relevant verified checks pass or are reported unavailable.
- No unrelated changes are included.
- Required contracts and documentation are current.
