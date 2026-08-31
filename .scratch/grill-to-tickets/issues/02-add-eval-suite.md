# 02: Add eval suite for `grill-to-tickets`

**What to build:** An eval suite for `grill-to-tickets`, shaped like `engineering-workflow/evals/` and runnable through `skill-creator`'s existing eval tooling, so the loop's routing logic and trigger behavior are pinned to explicit, benchmarkable cases rather than living only in prose (the suite is run on demand, not in CI):

- **`evals/trigger-evals.json`**: query/`should_trigger` pairs. Confirms `/grill-to-tickets` and `$grill-to-tickets` trigger (`should_trigger: true`), and that natural-language mentions of adjacent skills or generic feature requests do **not** trigger it (`should_trigger: false`), consistent with `disable-model-invocation: true`.
- **`evals/evals.json`**: prompt/`expected_output`/`expectations` cases, one per Design Review Gate routing branch:
  1. First-pass `SHIP` — straight through Stage 0 → 1 → 2 → 3, no rework.
  2. `FIX_THEN_SHIP` — edits `spec.md` directly, re-reviews, does not leave Stage 2.
  3. Spec-level `REWORK` — re-runs `to-spec`, stays inside the gate.
  4. Decision-level `REWORK` — returns to Stage 0, cycle counter carries over (not reset).
  5. `REJECT` — halts and reports to the user; does not auto-resume grilling.
  6. Stall — same blocking finding twice running halts before cycle 6.
  7. Budget exhaustion — cycle 6 without `SHIP` halts and requires human authorization for a fresh budget.

**Blocked by:** 01 (needs the finished `SKILL.md` to write accurate expected outputs against)

**Status:** ready-for-agent

- [ ] `trigger-evals.json` includes both `should_trigger: true` and `should_trigger: false` cases
- [ ] `evals.json` has one case per routing branch listed above (7 cases), each with a checkable `expected_output` and an `expectations` list
- [ ] Suite runs through `skill-creator`'s existing eval scripts without modification to those scripts
