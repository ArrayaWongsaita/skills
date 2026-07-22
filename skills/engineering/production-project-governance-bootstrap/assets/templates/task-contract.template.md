<!-- Use for non-trivial work needing scope, risk, and acceptance control. Do not require for mechanical local changes. -->
# Task Contract: `[WORK-ITEM-ID — outcome]`

- Status: Draft
- Owner: `[delivery owner]`
- Approver: `[required role or None]`
- Primary task type: `[classification]`
- Risk modifiers: `[list or None]`
- Risk level: `[R0–R4 or repository equivalent]`

## Problem and outcome

- Problem: `[observable gap]`
- Goal: `[bounded change]`
- User/system outcome: `[observable result]`
- Source of truth: `[approved source or unresolved conflict]`

## Acceptance and scope

- Acceptance criteria: `[testable statements]`
- Non-goals: `[explicit exclusions]`
- Allowed scope: `[paths/modules/contracts]`
- Forbidden scope: `[unrelated refactors, upgrades, migrations, dependencies, redesign]`
- Constraints and assumptions: `[facts versus assumptions]`

## Impact and controls

| Concern | Impact | Required control or `None — reason` |
| --- | --- | --- |
| Modules | `[affected areas]` | `[boundary check]` |
| Public contracts | `[impact]` | `[compatibility/versioning]` |
| Data/migration | `[impact]` | `[migration/backfill/rollback]` |
| Security/privacy | `[impact]` | `[review/test/approval]` |
| Reliability/observability | `[impact]` | `[failure and signal contract]` |
| Rollout/rollback | `[impact]` | `[strategy and trigger]` |

## Verification and approval

| Purpose | Verified command/check | Source | Expected evidence |
| --- | --- | --- | --- |
| `[purpose]` | `[command or Unknown — requires project owner confirmation]` | `[source]` | `[result]` |

- Required approvals: `[operation, approver role, and gate]`
- Open decisions: `[decision and owner]`
