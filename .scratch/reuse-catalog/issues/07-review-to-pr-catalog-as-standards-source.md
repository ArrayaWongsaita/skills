# 07: review-to-pr reviews against the Reuse Catalog

**What to build:** `review-to-pr` catches duplication that slipped past planning.
When `docs/reuse-catalog.md` exists, its inline `code-review` call names the
catalog as a documented standards source, so a new module duplicating a
catalogued one, or code bypassing a catalog Rule, is a documented-standard
violation on the Standards axis — a blocker when it has a concrete consequence.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `references/review-loop.md` "The inline `code-review` call" names
      `docs/reuse-catalog.md` (when present) among the standards sources passed to
      the Standards axis, with the brief: a new module duplicating a catalogued
      one, or code bypassing a catalog Rule, is a documented-standard violation —
      cite the catalog line; `code-review` itself is unchanged.
- [ ] The normalization section states that such a finding is a blocker when it
      has a concrete consequence (two implementations that can diverge, a Rule's
      guarantee lost), non-blocking otherwise.
- [ ] `evals/evals.json` gains cases: diff adds a second currency formatter while
      the catalog lists `formatCurrency` → Standards-axis blocker citing the
      catalog; no catalog → review unchanged.
- [ ] `tests/review-to-pr-contract.test.mjs` asserts the standards-source line.
- [ ] Both `review-to-pr` human guides mention the catalog check.
- [ ] `npm run validate` and `npm test` pass.
