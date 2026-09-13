# 3. Keep the automatic native-subagent fallback tier; reframe its rationale

## Status

Accepted

## Context

`agy-implement`'s execution model is being adopted wholesale
([[adr-0002-whole-ticket-wave-parallel]]), but `agy-implement` itself has no
automatic escalation path: a ticket that exhausts its verification or failover
budget simply becomes `BLOCKED` and waits for a human
(`agy-implement/references/status-and-resume.md`). `opencode-implement`'s
automatic native-subagent fallback tier
(`.scratch/opencode-implement/adr/0007-automatic-native-subagent-fallback.md`,
scratch) was justified specifically by "a 27B local model is weak and slow" —
that framing no longer applies once the resolved model is a hosted model.

## Decision

Keep the fallback tier, mechanism and triggers unchanged:

1. `TICKET_TOO_LARGE_FOR_CONTEXT` — now a rare edge case (a genuinely huge
   ticket against even a large hosted context window) rather than the common
   case it was under a 32k local window, but still a valid trigger.
2. Verification budget exhausted (`MAX_TICKET_ATTEMPTS = 3` on the `opencode`
   path).
3. `opencode` failures exhausted (`MAX_OPENCODE_RETRIES = 3`).

Escalation is still automatic and unattended (no approval pause), still
suppressible by `--opencode-only` (the renamed `--no-fallback` alias, see
[[adr-0001-hosted-only]]), and still cuts a fresh worker branch for the whole
ticket from clean integration `HEAD`.

**Reframe the "why"**: the fallback tier exists because *any* single model —
however capable — has a capability ceiling, and three failed attempts on one
model is a signal to try a structurally different executor (a native Claude
subagent with a different context and toolset) rather than a fourth attempt on
the same model. This keeps `opencode-implement` distinguished from
`agy-implement` (whose answer to the same situation is `BLOCKED`) even though
the two skills now share a planning and dispatch shape.

## Consequences

- `references/fallback.md` is rewritten to drop every "local model is weak/slow"
  justification and replace it with the capability-ceiling framing above; the
  trigger list, dispatch mechanics, and verification-and-budget sections carry
  over largely unchanged.
- Cost and privacy disclosure for the fallback path is unchanged in kind
  (per-ticket handoff note, `tokens.fallback` in `status.md`) but now sits
  alongside disclosure for the main path too
  ([[adr-0004-cost-disclosure-and-no-failover]]) — both paths spend real money
  now, so the asymmetric "only the fallback path costs anything" framing is
  gone.
- Amends, rather than reverses, `.scratch/opencode-implement/adr/0007-automatic-native-subagent-fallback.md`
  (scratch) — left in place as history.

## Rejected alternatives

- **Drop the fallback tier to match `agy-implement` exactly** (`BLOCKED`, no
  auto-escalation). Rejected: this was the more literal reading of "full
  convergence," but the user explicitly chose to keep the safety net — it is
  now `opencode-implement`'s deliberate point of difference from
  `agy-implement`, not a leftover from the local-only design.
