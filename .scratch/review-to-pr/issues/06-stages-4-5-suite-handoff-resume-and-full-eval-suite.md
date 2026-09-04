# 06: Stages 4–5, state & resume, docs, and the full eval suite

**What to build:** The final stages — the full-suite gate and the handoff — plus
the state file and sub-commands as `references/status-and-resume.md`, the
finished bilingual guide and ADR, the design-review record, and the eval suite
brought up to one case per decision branch with the contract test that guards
the count and the branch coverage.

**Blocked by:** 05.

**Status:** ready-for-agent

- [ ] `SKILL.md` has a `## Stage 4` section: a fresh `Explore` verifier runs the
      whole typecheck and the whole test suite on the integration branch `HEAD`;
      a red suite is a new blocker routed to Stage 2, or — if the code ceiling
      is already spent — a stop with the red suite reported as unresolved.
- [ ] `SKILL.md` has a `## Stage 5` section: the handoff prints the integration
      branch, the code-review and scrutinize verdicts, the `fix(review):`
      commits, the green-suite line, and the `/pr-to-dev` command; the run
      performs no `git push`, no `gh`, and no PR step.
- [ ] `references/status-and-resume.md` defines the full `review-status.md`
      field set (`review_point`, `feature_slug`, `integration_branch`,
      `spec_source`, `stage`, `code_cycles`, `scrutinize_cycles`, the `findings`
      ledger, `fix_commits`) and states the file is the whole record with no
      per-turn header.
- [ ] It specifies `/review-to-pr continue`: Reality reconciliation — confirm
      the integration branch and its recorded `fix_commits` exist, re-run
      `code-review` and the full suite, re-open any finding whose fix no longer
      holds — then resume from the recorded stage.
- [ ] It specifies `/review-to-pr status` as read-only: report the cycle history
      and the findings ledger, mutating nothing.
- [ ] It defines the halt / partial report: the unresolved blockers, the stage
      reached, the cycles spent, and the `/review-to-pr continue` command.
- [ ] `docs/skills/agents/review-to-pr.md` is complete and bilingual — purpose,
      use-it-when, do-not-use-it-when (naming `grill-to-tickets`,
      `engineering-workflow`, `subagent-implement`, `agy-implement`), main
      workflow, example prompt, and a Related-files list naming all five
      references — with the install command in both language sections.
- [ ] `docs/decisions/0006-review-to-pr-standalone.md` is complete and bilingual
      across `## Status` / `## Context` / `## Decision` / `## Consequences`, and
      names `engineering-workflow`, the §8–9 split, and the standalone stance.
- [ ] `.scratch/review-to-pr/design-review.md` records the Gate 2 cycle
      (fingerprint, verdict `fix-then-ship`, findings, route).
- [ ] `evals/evals.json` has at least one case per decision branch across all
      stages, every `prompt` carrying `/review-to-pr` or `$review-to-pr`, unique
      ids and names; `evals/trigger-evals.json` has a negative case for a bare
      "review this branch" and for a sibling skill.
- [ ] `tests/review-to-pr-evals.test.mjs` asserts the mirror identity, the
      per-decision-branch coverage map, and that every eval prompt uses an
      explicit invocation; `tests/review-to-pr-contract.test.mjs` asserts the
      Stage 4/5 sections, the `status-and-resume.md` contract, and the handoff's
      no-PR-step stance.
- [ ] `npm run docs:index` is clean, and `npm run validate` and `npm test` pass.
