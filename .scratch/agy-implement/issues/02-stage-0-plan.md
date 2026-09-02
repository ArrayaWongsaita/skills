# 02: Stage 0 — Plan (read-only)

**What to build:** Running `/agy-implement` against a directory of `grill-to-tickets`
tickets produces a **Plan** — the wave table, each ticket's estimated touch-set and
overlap flags, its parallel/serial proposal, and its test seam — then stops for explicit
approval without writing to any source file. A malformed ticket set (dependency cycle,
missing blocker) is rejected up front, naming the offending ticket.

**Blocked by:** 01

**Status:** done

- [x] `references/planning.md` specifies: parsing the `to-tickets` local ticket format;
      building and validating the dependency DAG (acyclic, blockers resolvable,
      numbering consistent with a topological order); computing waves; estimating
      touch-sets; raising "likely-overlapping — consider serializing" flags including the
      configurable cross-cutting-file list; and selecting each test seam from the parent
      spec's Testing Decisions
- [x] SKILL.md Stage 0 section drives `references/planning.md`, emits the Plan, and
      pauses for explicit approval
- [x] The Plan shows, per ticket: wave, estimated touch-set, parallel/serial proposal +
      reason, overlap flags, test seam, retry budgets — and no model column
- [x] A ticket set with a dependency cycle or a missing blocker halts the run naming the
      specific broken ticket, before any other work
- [x] No file outside `.scratch/<slug>/` is created or modified during Stage 0
- [x] With no argument, the most recently modified `.scratch/*/issues/` directory is
      selected and named back for confirmation before planning
- [x] `evals/evals.json` cases: pure-linear-chain plan; one-parallel-wave plan (edge-free,
      disjoint touch-sets, no flag); overlap-hint (flagged, serialize suggested, still
      parallelizable on approval); cross-cutting-file flag; cyclic-graph rejection;
      no-source-mutation-before-approval
