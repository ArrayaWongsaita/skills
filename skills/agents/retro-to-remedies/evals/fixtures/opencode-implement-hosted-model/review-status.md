# review-to-pr run state — opencode-implement-hosted-model

| field | value |
| --- | --- |
| `review_point` | `84f6b5f39541f4f546f1d3361c378180488bbc8f` (`merge-base main HEAD`) |
| `feature_slug` | `opencode-implement-hosted-model` |
| `integration_branch` | `subagent-implement/opencode-implement-hosted-model` @ `5182fbe` |
| `spec_source` | `spec.md + issues/` |
| `stage` | `5 — handoff` |
| `code_cycles` | `2` |
| `scrutinize_cycles` | `1` |

## Notes

- Invocation arg `git-lab-lesson-integration` resolved as neither a git ref nor
  a `.scratch/<slug>/` directory. User confirmed (via AskUserQuestion): review
  the current branch instead.
- Preflight found a dirty tree — untracked `subagent-implement` run-state
  (`status.md`, `prompts/`, `reports/`) under
  `.scratch/opencode-implement-hosted-model/`. User confirmed: add `.scratch/`
  to `.gitignore`. Committed as `74c0f86` (`chore: gitignore .scratch/
  run-state artifacts`) before pinning the review point, so the review point
  sits on a clean tree.
- Branch shape: no `fix/`/`hotfix/`/`incident/` prefix; commits are a numbered
  `feat`-ticket series (`01`–`06`) plus doc/chore commits — reads as a feature
  ticket series, in scope for v1.

## Cycle 1 — code-review @ 74c0f86

Standards axis: 1 blocker, 4 non-blocking. Spec axis: 0 findings.

## findings

| id | axis | status | cluster |
| --- | --- | --- | --- |
| std-1 | standards | resolved | fix-1 |
| std-2 | standards | open (non-blocking, carried) | — |
| std-3 | standards | open (non-blocking, carried) | — |
| std-4 | standards | open (non-blocking, carried) | — |
| std-5 | standards | open (non-blocking, carried) | — |

- `std-1` — **blocker.** Commit `22384f6` edited `subagent-implement`'s
  `references/dispatch-contract.md` and `references/prompt-scaffold.md` (both
  mirror trees), violating ADR 0007 §3 ("does not modify or depend on ...
  `subagent-implement`"). Verified directly against ADR 0007 and the commit
  diff. Fixed by cluster `fix-1`.
- `std-2` — non-blocking. "Wave gates only the next wave" restated 4x across
  `worktree-integration.md`/`SKILL.md` (Duplication, writing-for-agents
  `SKILL.md` "Pruning"). Consistent, not drifted — carried, not fixed.
- `std-3` — non-blocking. `status-and-resume.md` references this feature's own
  dev ticket numbers ("Tickets 03–04") — will go stale once `issues/` is
  cleaned up. Carried, not fixed.
- `std-4` — non-blocking. `worker-contract.md` shows the same `opencode run`
  command twice (canonical + expanded form) — likely intentional. Carried, not
  fixed.
- `std-5` — non-blocking. `worker-contract.md`:149 names only `--opencode-only`,
  omitting the primary flag name `--no-fallback`. Carried, not fixed.

Spec axis: 0 findings (see cycle 1 report in conversation — every ticket 01–06
maps cleanly to its commit; no scope creep; mirror trees byte-identical).

## fix_commits

| sha | summary | finding_ids |
| --- | --- | --- |
| `5182fbe` | fix(review): revert out-of-scope subagent-implement edit | std-1 |

Re-homed: the reverted fix now lives on branch
`fix/subagent-implement-worktree-base-assumption` (off `main`, commit
`c821a8e`), unpushed — user's to send out as its own PR.

## Cycle 2 — code-review @ HEAD 5182fbe

Standards axis: 0 new findings; `std-1` confirmed resolved (diff touches zero
`subagent-implement` paths). Spec axis: 0 new findings; revert left
`opencode-implement`'s own ticket 01–06 deliverables untouched. No-progress
stop does not apply (this cycle resolved the blocker) — routing to Stage 3
per a clean review.

`std-2`..`std-5` remain `open (non-blocking, carried)` — unchanged this cycle.

## Stage 3 gate judgment

Checklist hits: **on-disk format** (ticket 05 / `status-and-resume.md` changes
the persisted `status.md` resume-state schema — `tokens.{main,fallback}`,
pinned-model field, reconciliation-on-drift); **spans many modules** (39 files
across nearly the entire skill's reference surface — planning, worker
contract, fallback, worktree-integration, status-and-resume, dispatch,
prompt-scaffold, SKILL.md, evals, tests, ADRs, docs guide — reworking the
skill's execution model per ADR 0007's addendum). Ran `scrutinize` inline.

**Verdict: `ship`.** Traced all 6 reference files against SKILL.md; all agree
on model resolve-and-pin, the two-rule retry split, per-ticket integration,
and fallback triggers. Cross-checked against `design-review.md`'s own prior
grill-to-tickets-stage gate (which already caught and fixed a model-pin bug,
an integration-gating bug, and a retry-scoping bug pre-implementation) — all
three fixes confirmed correctly and consistently shipped. One nit found:
`spec.md:412-414` still states the pre-fix `--model` behavior (contradicts
`spec.md:71-84` and the shipped `worker-contract.md`) — a dead passage in a
non-shipped file, no runtime consequence, evaded two prior consistency
sweeps. Non-blocking, carried (`spec-nit-1`). scrutinize_cycles: 1/6.

## Stage 4 — full suite

Fresh `Explore` verifier on `HEAD` `5182fbe`: no typecheck exists in this repo
(no `tsconfig.json`, no `.ts` files, no typecheck script). Full test suite —
`npm test` (`node --test tests/*.test.mjs` + Python unittest for
`agent-instructions-architect`) — **305/305 passed, 0 failed.** Green.
