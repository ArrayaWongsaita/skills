<!-- Use when a release, migration, configuration, or traffic change needs explicit recovery. Do not claim data rollback is possible without evidence. -->
# Rollback Plan: `[change]`

- Status: Proposed
- Decision owner: `[role]`
- Execution owner: `[role]`
- Related release: `[link]`

## Trigger and decision

Define measurable rollback triggers, observation window, decision authority, and conditions where rollback is unsafe.

## Procedure

| Order | Action | Required access/approval | Verification | Stop/escalate condition |
| --- | --- | --- | --- | --- |
| `1` | `[exact reversible action]` | `[role/gate]` | `[signal/check]` | `[condition]` |

## Data and dependency limits

State application, configuration, traffic, schema, and data recovery separately. Record irreversible effects, backfill/forward-fix needs, consumer coordination, and communication.

## Completion

Define restored health, smoke checks, monitoring period, incident/lesson updates, and residual risk.
