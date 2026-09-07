# 02: Stage 0 — Plan, with criterion-level step plans

**What to build:** Running `/opencode-implement` against a directory of
`grill-to-tickets` tickets produces a **Plan** — the dependency-ordered ticket table
plus, per ticket: its blockers, test seam, its **step plan** (the ordered sub-steps, one
acceptance criterion each by default, split finer where a single criterion is estimated
over the context budget), its predicted **path** (`local` or `subagent-fallback`), and
the retry budgets — then stops for explicit approval without writing to any source file.
A malformed ticket set (dependency cycle, missing blocker, numbering inconsistent with a
topological order) is rejected up front, naming the offending ticket.

**Blocked by:** 01

**Status:** done

- [x] `references/planning.md` specifies: resolving the target (explicit dir/slug wins;
      no arg → most recently modified `.scratch/*/issues/`, named back for confirmation);
      parsing the `to-tickets` local ticket format; building and validating the
      dependency DAG (acyclic → else `BLOCKED (TICKET_SET_CYCLIC)`; blockers resolvable →
      else `BLOCKED (TICKET_SET_MISSING_BLOCKER)`; numbering consistent with a
      topological order → else `BLOCKED (TICKET_SET_NUMBERING)`), each naming the
      specific broken ticket and halting before any other work
- [x] `references/planning.md` specifies computing the dependency order and the frontier
      (no waves — adr/0005), and selecting each ticket's test seam from the parent
      spec's Testing Decisions where they constrain it, else the narrowest public
      boundary
- [x] `references/planning.md` specifies **step-plan construction** (adr/0006): every
      ticket gets an ordered chain of sub-steps, one acceptance criterion per sub-step by
      default; for each sub-step estimate its content (`micro-prompt + named spec
      sections + ADRs + files it must read + expected edits + reasoning headroom`)
      against the **context budget** (~13k tokens of sub-step content, provisional,
      derived as `32k − ~11k floor − ~4k headroom − ~4k reasoning reserve`); a sub-step
      over budget is split finer by file or layer; the bias is to over-split; each
      sub-step's file scope is recorded
- [x] `references/planning.md` specifies **path prediction**: a ticket with a criterion
      that cannot be split fine enough to fit is predicted `subagent-fallback` (or
      flagged for `BLOCKED (TICKET_TOO_LARGE_FOR_CONTEXT)` under `--no-fallback`); every
      other ticket is `local`. A ticket whose acceptance criteria cannot be exercised by
      an isolated test at any seam returns to planning rather than shipping without a
      test
- [x] SKILL.md Stage 0 section drives `references/planning.md`, emits the Plan (ticket
      table + per-ticket blockers, test seam, step plan with sub-step file scopes,
      predicted path, retry budgets, and the editable run parameters), and pauses for
      explicit approval
- [x] No file outside `.scratch/<slug>/` is created or modified during Stage 0
- [x] `evals/evals.json` cases: pure-linear-chain plan (dependency order, one commit per
      ticket, no wave table); one-criterion ticket → one-sub-step chain; four-criterion
      ticket → four-sub-step chain; single criterion over budget → split finer, shown in
      the step plan; cyclic / missing-blocker / bad-numbering rejections each naming the
      ticket; no-source-mutation-before-approval; no-arg → most-recent `issues/` named
      back
- [x] `npm run validate` and `npm test` pass
