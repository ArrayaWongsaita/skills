# 01: Catalog template and Stage 0 Reuse survey in grill-to-tickets

**What to build:** A `/grill-to-tickets` run now starts from the project's Reuse
Catalog instead of from nothing. Stage 0 reads `docs/reuse-catalog.md`,
drift-checks every entry, surveys only the gaps (uncovered areas the idea
touches, plus files changed in covered areas since their Coverage date), writes
back what it found about existing code, and bootstraps the catalog — with a
pointer line in the project's instruction file — when none exists. Genuine reuse
choices surface as grilling questions with a recommended answer. The
cross-skill contract is recorded once at repo level.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `references/reuse-catalog-template.md` exists in `grill-to-tickets` and
      defines the catalog: the self-describing header (invariant "lists only code
      that exists now", entry format ``- `symbol` — `path` — use for: <when>``,
      candidate suffix `· from: <feature-slug>`, bare-identifier symbols, the two
      legitimate writers, "only a survey moves a Coverage date", the split-into-a-map
      rule) and the sections Where shared code lives, Rules (phrased positively),
      Shared (seeded categories Formatting, Data access, UI, Validation,
      State/hooks, Test helpers), Candidates, Coverage.
- [x] `references/reuse-pass.md` exists and specifies the Stage 0 Reuse survey:
      read + drift check (correct or remove entries whose symbol is not in its
      file); the gap survey delegated as a read-only fact lookup (full survey of
      uncovered areas the idea touches; for covered areas, only files still
      present in `git log --since=<date> --first-parent --diff-merges=first-parent --name-only --format= -- <area>`);
      what the survey looks for (helpers, UI components, hooks, clients,
      validation schemas, types/constants, test factories/fixtures, house
      patterns); write-back of entries for existing code only and today's
      Coverage date for surveyed areas; bootstrap from the template when the file
      is absent, with a one-line pointer added to `AGENTS.md`, else `CLAUDE.md`,
      else reported as missing; reuse choices as grilling frontier questions.
- [x] `SKILL.md` Stage 0 gains a Reuse survey step between grounding and the
      interview that points to `references/reuse-pass.md`, states that the
      survey's subagent is a fact lookup while the stage stays on the main
      thread, and adds "catalog changes made" to the Stage 0 pause summary.
- [x] `SKILL.md` names `docs/reuse-catalog.md` as the one artifact written
      outside `.scratch/<feature-slug>/`, alongside the instruction-file pointer.
- [x] `docs/decisions/0008-reuse-catalog-cross-skill-contract.md` records the
      catalog path, the invariant, the Reuse Plan section name
      (`### Reuse Plan` under Implementation Decisions), the Reuse field verbs
      (`use`, `extend`, `create-shared`, `create-candidate`, `promote`), and which
      skill writes what (survey vs integration; `review-to-pr` reads).
- [x] `docs/glossary.md` gains Reuse Catalog and Reuse field rows.
- [x] `evals/evals.json` gains cases: no catalog → bootstrap + pointer line;
      catalog with a stale entry → removed by the drift check; covered area →
      only changed files re-read; extend-vs-new choice → asked as a numbered
      grilling question with a recommendation.
- [x] `tests/grill-to-tickets-contract.test.mjs` asserts the survey step, drift
      check, Coverage, bootstrap, pointer, and both new references resolve;
      `tests/grill-to-tickets-evals.test.mjs` replaces its exact-7 count with "at
      least one case per routing branch" so the reuse cases fit.
- [x] `docs/guides/grill-to-tickets.md` and
      `docs/skills/agents/grill-to-tickets.md` describe the Reuse survey and the
      catalog.
- [x] `npm run validate` and `npm test` pass.
