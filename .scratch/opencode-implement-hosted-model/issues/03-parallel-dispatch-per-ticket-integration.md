# 03: Parallel dispatch, concurrency cap, and per-ticket verification/integration gate

**What to build:** Adopt `agy-implement`'s worktree lifecycle and
serial-vs-parallel dispatch within a wave (concurrency cap, queue,
possibly-stalled flag). Verification and integration happen **per ticket**, as
each one clears — a ticket escalating to the fallback tier does not block its
wave-mates from integrating first, and only the *next* wave's start waits for
every ticket in the current wave to reach a terminal state. Convert the
worker prompt from a per-sub-step scaffold (with a progress-note section) to a
whole-ticket scaffold.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] `references/worktree-integration.md` specifies preflight unchanged minus
      the Ollama-reachability check: target repo clean (dirty tree stops and
      asks, never stashes); create/switch to the integration branch
      `opencode-implement/<feature-slug>` from `HEAD`; add
      `.scratch/<feature-slug>/worktrees/` to `.gitignore`; confirm `opencode`
      on `PATH` and the pinned model listed by `opencode models`
- [ ] `references/worktree-integration.md` specifies one worktree + worker
      branch per ticket, cut from the current integration `HEAD`, dependency
      reuse via symlink/reflink, and "a worker needing a new dependency stops
      and returns to Stage 0 planning" — unchanged from today
- [ ] `references/worktree-integration.md` specifies serial-vs-parallel
      dispatch within a wave mirroring `agy-implement`: serial tickets (a
      dependency edge, or a flagged pair the user chose to serialize) reuse
      one worktree slot at a time; a wave approved for parallel execution
      dispatches one background worker per independent ticket at once, each
      writing its own log file, up to the **concurrency cap** (default 4,
      editable in the Plan) — tickets past the cap queue and start as slots
      free; a worker that writes no new output for a configurable interval
      (default 10 minutes) is flagged **possibly stalled** in status without
      blocking its wave-mates
- [ ] `references/worktree-integration.md` retains the per-ticket verification
      gate unchanged (reproduce the ticket's red state at the pre-ticket
      integration `HEAD`; coverage and non-vacuity of every acceptance
      criterion; green + typecheck)
- [ ] `references/worktree-integration.md` specifies **per-ticket
      integration**: a ticket squash-merges as one commit as soon as it
      passes verification (in ticket-number order relative to what's already
      integrated), with the full suite run on that result, independent of
      whether its wave-mates are done; a ticket that exhausts its main-path
      budget escalates to the fallback tier instead of integrating there, then
      integrates the same way once the fallback subagent's result passes the
      same verification gate, cut from whatever integration `HEAD` exists by
      then (which may already include former wave-mates' work)
- [ ] `references/worktree-integration.md` specifies that the **wave
      boundary** gates only the start of the *next* wave — every ticket in
      the current wave must reach a terminal state (integrated, or `BLOCKED`)
      first — and never gates any individual ticket's own integration
- [ ] `references/worktree-integration.md` retains conflict routing unchanged:
      a mechanical conflict is resolved by the orchestrator on the main
      thread; a conflict encoding a design decision halts with
      `BLOCKED (INTEGRATION_DESIGN_CONFLICT)` and returns the affected ticket
      to Stage 0 rather than being resolved silently
- [ ] `references/prompt-scaffold.md` is rewritten for a whole-ticket prompt —
      absolute paths, the full "What to build" text and every acceptance
      criterion verbatim, the relevant parent-spec sections and ADRs, the
      domain glossary, the assigned test seam, and the full
      red-green-refactor protocol — with the progress-note section removed,
      mirroring `agy-implement/references/prompt-scaffold.md`'s shape
- [ ] `evals/evals.json`: parallel dispatch of an approved wave respects the
      concurrency cap and queues the remainder; a possibly-stalled worker is
      flagged without blocking its wave-mates; a ticket escalating to
      fallback integrates on its own without blocking already-passed
      wave-mates from integrating first; the next wave still waits until
      every ticket in the current wave reaches a terminal state; a
      design-encoding merge conflict still surfaces rather than resolving
      silently
- [ ] `npm run validate` and `npm test` pass
