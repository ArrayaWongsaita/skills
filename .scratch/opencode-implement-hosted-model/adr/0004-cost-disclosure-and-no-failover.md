# 4. Disclose cost on the main path too; keep the no-failover, single-model boundary

## Status

Accepted

## Context

Two independent effects of going hosted:

1. `status.md`/Plan/handoff previously disclosed cost only for the fallback
   path (`tokens.fallback`), because the main `opencode` path was always
   `cost: 0` (local, per a confirmed probe). Once the main path runs against a
   hosted model, every ticket on that path spends real money too, and the
   existing disclosure pattern silently stops covering most of the run's actual
   spend.
2. Adopting `agy-implement`'s wave/parallel execution model
   ([[adr-0002-whole-ticket-wave-parallel]]) raises the question of whether
   `opencode-implement` should also adopt `agy-implement`'s `MAX_FAILOVER_ATTEMPTS`
   round-robin-over-a-model-list behavior for provider/infrastructure failures.
   The user never asked for multi-model routing in `opencode-implement` — every
   answer in this feature's interview referred to a single resolved model
   (DeepSeek V4.1 Flash) — and the original design (`.scratch/opencode-implement/adr/0003`,
   now superseded on its local-execution point but not on this one) explicitly
   rejected "a curated multi-model pool with capability tiers" as
   `agy-implement`'s problem to solve, not this skill's.

## Decision

- **Extend the existing disclosure pattern to the main path.** Roll `opencode`
  worker token usage into `status.md` as `tokens.main`, alongside the unchanged
  `tokens.fallback`. Show both in the Plan (predicted) and the completion
  handoff (actual), the same places `tokens.fallback` already appears. No hard
  cost cap / `--max-cost` flag — the user asked only for visibility, not an
  enforced budget.
- **Do not adopt round-robin model-list failover.** `opencode-implement`
  continues to resolve and use exactly **one** model for the entire run
  ([[adr-0001-hosted-only]]). An `opencode`-process failure (crash, timeout,
  malformed envelope) retries against that **same** model, budget
  `MAX_OPENCODE_RETRIES = 3`; exhausting it escalates to the fallback tier
  ([[adr-0003-fallback-tier-retained]]), never to a different model. There is no
  model list, no `--model` array, and no per-provider round-robin anywhere in
  this skill.

## Consequences

- `references/worktree-integration.md`'s Plan/status.md fields gain `tokens.main`
  next to `tokens.fallback`; the handoff message template gains a main-path
  spend line.
- The "no cross-provider failover, no model list" language in the original
  `.scratch/opencode-implement/adr/0003-local-execution-is-the-purpose.md`
  survives this feature intact — it is re-recorded here so it isn't lost when
  that ADR is otherwise superseded by [[adr-0001-hosted-only]].
- This is what keeps `opencode-implement` a distinct skill from `agy-implement`
  even after [[adr-0002-whole-ticket-wave-parallel]] makes their planning and
  dispatch shape nearly identical: `agy-implement`'s reason to exist is
  provider *distribution*; `opencode-implement`'s is a single deliberately
  chosen model run through the `opencode` CLI, with its own fallback safety net.

## Rejected alternatives

- **Add a hard `--max-cost` budget cap.** Rejected for this feature: the user
  asked to extend visibility, not add an enforcement mechanism; a cap can be
  added later as its own decision if spend visibility shows it's needed.
- **Adopt `agy-implement`'s model-list + round-robin failover wholesale**, since
  "full convergence" was chosen for the execution model. Rejected: convergence
  was scoped to wave/parallel dispatch mechanics in the interview, not to
  multi-provider routing, and the user's own model choice (one specific hosted
  model) doesn't call for a list.
