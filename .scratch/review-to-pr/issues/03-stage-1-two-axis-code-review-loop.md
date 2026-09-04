# 03: Stage 1 — the two-axis code-review loop

**What to build:** The bounded code-review loop — running `code-review` inline
against the pinned review point, normalizing findings to blocking or
non-blocking, keeping the findings ledger, and enforcing the three-cycle ceiling
with a no-progress early stop — as `references/review-loop.md` driven from a
`Stage 1` section in `SKILL.md`.

**Blocked by:** 02.

**Status:** ready-for-agent

- [ ] `SKILL.md` has a `## Stage 1` section that runs `code-review` inline
      against the review point pinned in Stage 0 and routes on the result:
      blockers → Stage 2, none → Stage 3.
- [ ] `references/review-loop.md` specifies the inline `code-review` call — two
      axes (Standards, Spec) as parallel sub-agents, reported side by side, not
      reranked or merged.
- [ ] It specifies blocking vs non-blocking normalization using the `gates.md`
      "Code normalization" rule: a finding blocks on a spec mismatch, missing or
      wrong behaviour, regression risk with no covering test, or a documented-
      standard violation with a concrete consequence; a style preference or a
      consequence-free smell is non-blocking and is carried, not fixed.
- [ ] It defines the findings ledger in `review-status.md`: per finding
      `{id, axis, status: open | resolved | stalled | unfixable, cluster}`.
- [ ] It specifies the code budget: three completed two-axis reviews is the
      ceiling; editing between reviews consumes no cycle; a cycle that resolves
      no blocker and turns up nothing new ends the loop early with a report.
- [ ] It specifies cycle bookkeeping: `code_cycles` incremented per completed
      review, the per-cycle new/resolved/still-open findings recorded.
- [ ] `evals/evals.json` gains cases: blockers found → Stage 2; clean review →
      Stage 3; non-blocking smell carried not fixed; third cycle is the ceiling;
      no-progress cycle ends the loop before the ceiling; Standards-only vs
      Spec-only blockers both route to Stage 2.
- [ ] `tests/review-to-pr-contract.test.mjs` asserts the Stage 1 section and
      `review-loop.md` cover the inline two-axis call, the blocking rule, the
      ledger, the ceiling, and the no-progress stop.
- [ ] `npm run validate` and `npm test` pass.
