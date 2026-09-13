# 01: Stage 0 — Plan, with wave computation and touch-set/overlap estimation

**What to build:** Replace `opencode-implement`'s dependency-order + criterion-level
step-plan procedure with `agy-implement`'s wave-computation and touch-set/overlap-
estimation procedure. Running `/opencode-implement` against a ticket directory now
produces a **Plan** — a wave table plus, per ticket, its blockers, test seam,
estimated touch-set, serial/parallel proposal with overlap flags, and retry
budgets — with no step-plan and no context-budget math anywhere. A malformed
ticket set is still rejected up front exactly as before.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `references/planning.md` retains target resolution (explicit dir/slug wins;
      no arg → most recently modified `.scratch/*/issues/`, named back for
      confirmation) and `to-tickets` local-format parsing unchanged
- [x] `references/planning.md` retains dependency-DAG validation unchanged
      (acyclic → else `BLOCKED (TICKET_SET_CYCLIC)`; blockers resolvable → else
      `BLOCKED (TICKET_SET_MISSING_BLOCKER)`; numbering consistent with a
      topological order → else `BLOCKED (TICKET_SET_NUMBERING)`), each naming
      the specific broken ticket and halting before any other work
- [x] `references/planning.md` specifies **computing execution waves** (wave 0 =
      every ticket with no blockers; wave K = every ticket whose blockers all
      landed in waves `< K`), replacing the old "dependency order and frontier,
      no waves" language
- [x] `references/planning.md` specifies **touch-set estimation** per ticket as
      an advisory hint (never a scheduling gate), and raises a
      `likely-overlapping — consider serializing` flag on an independent
      same-wave pair whose estimated touch-sets intersect or either of which
      touches a cross-cutting file (router, DI container, root schema,
      migrations directory, `package.json`/lockfiles, CI config, shared
      config) — mirroring `agy-implement/references/planning.md` §5
- [x] `references/planning.md` retains test-seam selection from the parent
      spec's Testing Decisions unchanged
- [x] `references/planning.md` no longer mentions step plans, sub-steps, or a
      context budget anywhere
- [x] `references/decomposition.md` is deleted
- [x] SKILL.md's Stage 0 section and ASCII diagram describe emitting a **wave
      table** (wave, tickets, touch-set estimate, serial/parallel proposal,
      overlap flags, test seam, retry budgets `MAX_TICKET_ATTEMPTS` /
      `MAX_OPENCODE_RETRIES`) instead of the old per-ticket step-plan table,
      with no step-plan column, and adds the **concurrency cap** (default 4)
      to the editable run parameters shown at Plan approval
- [x] No file outside `.scratch/<feature-slug>/` is created or modified during
      Stage 0
- [x] `evals/evals.json`: wave computation from a DAG with independent
      branches assigns the right wave to each ticket; a same-wave
      overlapping-touch-set pair is flagged `likely-overlapping`; cyclic /
      missing-blocker / bad-numbering rejections still pass unchanged;
      no-source-mutation-before-approval still passes; every removed
      step-plan / sub-step eval case is deleted
- [x] `npm run validate` and `npm test` pass
