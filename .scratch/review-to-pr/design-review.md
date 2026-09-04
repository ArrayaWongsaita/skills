# Design Review — review-to-pr spec.md

One stable report, updated per cycle. Gate budget: six cycles. `SHIP` is the
only passing verdict.

## Cycle 1

- **cycle:** 1
- **reviewedSpecRef:** git blob `2cd06c741c691bd0e3d05c16a61ec9e9eab91c42`
  (pre-correction `spec.md`; corrections applied in the same cycle, no re-review
  consumed)
- **verdict:** `FIX_THEN_SHIP`
- **reworkKind:** n/a (not `REWORK`)
- **reworkReasoning:** n/a
- **blockingFindings:**
  - `stall-dead-code` — stall detection on the code loop can never fire before
    the three-cycle ceiling, so it is a no-op rule.
  - `pr-to-dev-contradiction` — "follow `/pr-to-dev` inline" contradicts
    `pr-to-dev`'s hard refusal of any base that is not `dev`; the default review
    point targets `main`.
- **newFindings:** `stall-dead-code`, `pr-to-dev-contradiction`,
  `edge-cases-underspecified` (minor), `adr-0006-gap` (nit)
- **resolvedFindings:** none (cycle 1)
- **repeatedFindings:** none (cycle 1)
- **route:** `FIX_THEN_SHIP` — smallest correct edits made directly to
  `spec.md` and `CONTEXT.md` within Stage 2 of the gate, control stays in the
  design gate. Both blocking findings and the minor edge cases fixed; the nit
  recorded for owner review. Advance to Stage 3 (`to-tickets`).
- **validationCommands:**
  - `git grep -n "stop after the third code cycle" .agents/skills/engineering-workflow/references/feature-flow.md` — confirms §8 sets only a ceiling, no stall rule for code review.
  - re-read `.agents/skills/pr-to-dev/SKILL.md` "When not to use" + hard rule 10 — confirms `pr-to-dev` requires base `dev`.

### Corrections applied (same cycle, no re-review)

| finding | edit |
| --- | --- |
| `stall-dead-code` | code loop ends early on one no-progress cycle; two-consecutive-stall rule kept only on the scrutinize sub-loop (`design-review-gate.md` form). Spec Solution §2/§3, story 9, Impl. Decisions, `CONTEXT.md` Stall + Code budget. |
| `pr-to-dev-contradiction` | run performs no PR step, ever — prints `/pr-to-dev`, runs nothing. Spec Solution §5, story 13, Impl. Decisions Handoff, Out of Scope, `CONTEXT.md` Handoff. |
| `edge-cases-underspecified` | degraded Spec axis (no spec found), Stage 4 red suite with ceiling spent, argument-is-both-ref-and-slug — all pinned in `spec.md`; each becomes an eval case in the ticket set. |
| `adr-0006-gap` | recorded in ADR 0001 + Further Notes; owner-flagged at Gate 2, confirmed. |

**Gate status after cycle 1:** design sound, no `REWORK`, no re-review needed.
Ticket breakdown proceeds against the corrected `spec.md`.
