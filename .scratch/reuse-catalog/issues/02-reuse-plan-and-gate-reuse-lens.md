# 02: Reuse Plan in the spec and the reuse lens in the Design Review Gate

**What to build:** The spec `grill-to-tickets` writes now states its reuse
decisions explicitly, and the Design Review Gate checks them. Stage 1 adds a
`### Reuse Plan` under Implementation Decisions (use / extend / create shared /
create candidate / promote / kept separate on purpose). Stage 2 runs
`scrutinize` with the Reuse Plan and the catalog in context and routes reuse
findings through the existing verdicts.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `references/reuse-pass.md` specifies the Reuse Plan: the six categories;
      names by symbol, never by path; create-shared carries interface
      (signature, invariants, error modes), named consumers, and use-when;
      create-candidate carries a feature-agnostic interface, the plausible second
      use, and use-when; kept-separate carries the look-alike pair and why.
- [ ] It specifies the create-shared bar: two or more stories in this spec, or one
      existing caller plus one story, or a user-confirmed named upcoming feature —
      otherwise the module is a candidate (design for extraction).
- [ ] `SKILL.md` Stage 1 points to the Reuse Plan section of
      `references/reuse-pass.md`.
- [ ] `references/design-review-gate.md` gains a reuse lens: `scrutinize` runs
      with the Reuse Plan and the catalog as context; findings use stable ids
      `reuse-duplicate-<symbol>`, `reuse-unowned-<shape>`,
      `reuse-speculative-<symbol>`; a spec re-creating a catalogued module, shared
      logic with no create-shared, or a create-shared with fewer than two
      consumers routes to `FIX_THEN_SHIP`; an undecided extend-vs-new trade-off
      routes to decision-level `REWORK`. Budget, stall, and verdict vocabulary are
      unchanged.
- [ ] `SKILL.md` Stage 2 mentions the reuse lens and points to it.
- [ ] `evals/evals.json` gains cases: spec plans a new date formatter while the
      catalog lists one → `FIX_THEN_SHIP`, Reuse Plan edited to `use`;
      create-shared with one consumer → `FIX_THEN_SHIP`, downgraded to
      create-candidate; extend-vs-new never decided → decision-level `REWORK`.
- [ ] `tests/grill-to-tickets-contract.test.mjs` asserts the Reuse Plan
      categories, the create-shared bar, the three finding ids, and both routes.
- [ ] Both human guides describe the Reuse Plan and the reuse lens.
- [ ] `npm run validate` and `npm test` pass.
