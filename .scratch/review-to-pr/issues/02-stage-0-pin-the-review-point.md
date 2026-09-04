# 02: Stage 0 — pin the review point

**What to build:** The read-only Stage 0 procedure — preflight, review-point
resolution, feature-slug and spec resolution, the initial `review-status.md`,
and the approval pause — as `references/review-point.md` driven from a `Stage 0`
section in `SKILL.md`.

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] `SKILL.md` has a `## Stage 0` section that drives
      `references/review-point.md` and states Stage 0 mutates nothing outside
      `.scratch/<feature-slug>/`.
- [ ] `references/review-point.md` specifies the preflight: a clean working tree
      on the integration branch (a dirty tree stops and asks, stashing nothing),
      and `main` resolves.
- [ ] It specifies review-point resolution: an argument that `git rev-parse
      --verify` resolves is the review point; otherwise `git merge-base main
      HEAD`. An unresolvable ref or an empty `git diff <review-point>...HEAD`
      halts Stage 0 with the reason named.
- [ ] It specifies feature-slug resolution in order: an explicit `<slug>`
      argument; else the integration-branch name stem (`subagent-implement/foo`
      → `foo`); else the most recently modified `.scratch/*/` directory, named
      back to the user for confirmation.
- [ ] It specifies that `spec.md` and `issues/` are loaded for the Spec axis
      when present, and that with neither the Spec axis runs against the commit
      messages alone and the handoff records the degraded mode.
- [ ] It specifies that an argument resolvable as both a git ref and a
      `.scratch/<slug>/` directory is taken as the review-point override, with
      the slug falling back to the branch stem.
- [ ] It defines the initial `review-status.md`: `review_point`, `feature_slug`,
      `integration_branch`, `spec_source`, `stage`.
- [ ] It specifies the Stage 0 pause: present the review point, the commit and
      file counts, and the spec source, then wait for explicit approval before
      Stage 1.
- [ ] `evals/evals.json` gains cases: default merge-base review point; explicit
      `<ref>` override; explicit `<slug>`; branch-stem slug; most-recent
      `.scratch/*/` named back; no spec found → degraded Spec axis; unresolvable
      ref halts; empty diff halts; dirty tree stops and asks.
- [ ] `tests/review-to-pr-contract.test.mjs` asserts the Stage 0 section and
      `review-point.md` cover preflight, both resolution paths, the halt
      conditions, and the pause.
- [ ] `npm run validate` and `npm test` pass.
