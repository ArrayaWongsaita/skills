# 04: Parallel waves and integration gate

**What to build:** A wave with multiple independent tickets runs them as concurrent `agy`
workers, each in its own worktree, capped at a configurable concurrency and drawing
models round-robin by dispatch order; when the wave completes the orchestrator merges
every worker branch into the integration branch in ticket-number order, resolving
mechanical conflicts itself and stopping to surface any conflict that encodes a design
decision, then runs the full suite before advancing.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] `references/worktree-integration.md` gains the parallel portion: per-wave worktree
      creation, background dispatch, concurrency cap (default 4, editable in the Plan)
      with a queue, and re-entry when each background worker finishes
- [ ] Models are assigned at dispatch time by round-robin over dispatch order, not
      ticket number; with no model list every worker uses `agy`'s default; assignments
      are recorded in `status.md`
- [ ] The integration gate squash-merges each verified worker branch in ascending
      ticket-number order; a mechanical conflict is resolved by the orchestrator; a
      conflict that encodes a design decision (module ownership, contract shape) halts
      the run and surfaces the decision, returning the affected tickets to Stage 0
- [ ] After each wave the full typecheck and test suite run on the integrated result;
      green advances and removes the wave's worktrees, red routes the culprit ticket to
      retry or BLOCKED
- [ ] A worker that produces no output for a configurable interval is flagged as
      possibly stalled in `status`
- [ ] `evals/evals.json` cases: one-parallel-wave dispatched together; model round-robin
      by dispatch order (list vs no list); design-encoding conflict → orchestrator stops
      and surfaces
