<!-- Use for production releases with material operational risk. Do not treat approval of this checklist as authorization to deploy. -->
# Release Readiness: `[release/change]`

- Status: Proposed
- Release owner: `[role]`
- Operational owner: `[role]`
- Strategy: `[verified direct/rolling/canary/blue-green/flag/staged/shadow]`
- Execution approval: `[required approver and status]`

## Sequence and compatibility

Record deployment order, migration order, dependent consumers, compatibility window, feature-flag defaults, and data limitations.

## Readiness checks

| Check | Evidence | Owner | Status or `Not applicable — reason` |
| --- | --- | --- | --- |
| Build/test/security/migration/contract | `[link/result]` | `[owner]` | `[status]` |
| Health indicators and smoke tests | `[signals/steps]` | `[owner]` | `[status]` |
| Rollback plan and trigger | `[link]` | `[owner]` | `[status]` |
| Communication and monitoring window | `[plan]` | `[owner]` | `[status]` |

## Go/no-go decision

Record approver, unresolved risk, conditions, and the exact production execution that remains separately gated.
