<!-- Use for production-critical behavior whose health and failure must be observable. Do not require custom telemetry or dashboards for trivial changes. -->
# Observability Contract: `[feature/system]`

- Status: Proposed
- Operational owner: `[team or role]`
- Release/work item: `[link]`

| Signal | User/system symptom represented | Dimensions/fields | Expected baseline | Alert or dashboard | Verification |
| --- | --- | --- | --- | --- | --- |
| `[log/metric/trace/health]` | `[meaning]` | `[bounded fields]` | `[known or Unknown]` | `[actionable destination]` | `[post-release check]` |

## Correlation and privacy

Define correlation identifiers and explicitly list secrets, personal data, tokens, payment data, or other fields that must not be logged. State retention or access constraints only when verified.

## Alert response

For each alert define condition, user/system impact, owner, first diagnostic action, runbook, and recovery/rollback trigger.
