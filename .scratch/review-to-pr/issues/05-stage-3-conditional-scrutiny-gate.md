# 05: Stage 3 — the conditional system-scrutinize gate

**What to build:** The system gate — the cross-cutting/risky judgment, the inline
`scrutinize` pass, verdict normalization, and the repeated-code-review sub-loop
on its own independent budget — as `references/scrutiny-gate.md` driven from a
`Stage 3` section in `SKILL.md`.

**Blocked by:** 04.

**Status:** ready-for-agent

- [ ] `SKILL.md` has a `## Stage 3` section that judges whether the integrated
      change is cross-cutting or risky, runs `scrutinize` inline only then, and
      otherwise skips to Stage 4 with a note.
- [ ] `references/scrutiny-gate.md` specifies the cross-cutting / risky
      checklist from ADR 0003: the diff touches routing, a DI container, a root
      schema, a migrations directory, shared config, auth, concurrency or
      locking, or an on-wire / on-disk format; or it spans many modules; or the
      code-review loop surfaced a structural finding.
- [ ] It specifies the inline `scrutinize` pass end-to-end over `git diff
      <review-point>...HEAD`, and normalizes the closing one-liner to exactly
      `ship` / `fix-then-ship` / `rework` / `reject` with no paraphrasing.
- [ ] It specifies the routing: `ship` → Stage 4; `fix-then-ship` and `rework` →
      the sub-loop; `reject` → stop and report the single biggest reason (a
      human decision, no auto-loop).
- [ ] It specifies the sub-loop `scrutinize → fix → tests or typecheck →
      code-review → scrutinize`, with the `code-review` step always run, and
      states the intra-sub-loop `code-review` consumes a scrutinize cycle, not a
      code cycle.
- [ ] It specifies the budget: six scrutinize cycles is the ceiling, independent
      of the code budget; the same blocking findings surviving two consecutive
      cycles end it early; cycle 7 needs explicit human authorization.
- [ ] It specifies that the handoff always records whether the system gate ran
      and why (which checklist item, or "self-contained — skipped").
- [ ] `evals/evals.json` gains cases: self-contained change → gate skipped, noted
      in handoff; cross-cutting change → gate runs; `ship` → Stage 4;
      `fix-then-ship` → sub-loop with code-review re-run; `reject` → stop;
      two-consecutive-stall ends the sub-loop early; scrutinize budget is
      independent of the code budget.
- [ ] `tests/review-to-pr-contract.test.mjs` asserts the Stage 3 section and
      `scrutiny-gate.md` cover the checklist, the inline pass, verdict
      normalization, the sub-loop with the never-skipped code-review, and the
      independent six-cycle budget.
- [ ] `npm run validate` and `npm test` pass.
