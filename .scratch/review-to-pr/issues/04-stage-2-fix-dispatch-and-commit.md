# 04: Stage 2 — fix dispatch and the fix(review) commit

**What to build:** The blocker-fix procedure — clustering, the dispatch-vs-inline
rule, the worker + fresh verifier contract copied from `subagent-implement`, the
retry budget, one `fix(review):` commit per cluster, and unfixable-blocker
handling — as `references/fix-dispatch.md` driven from a `Stage 2` section in
`SKILL.md`.

**Blocked by:** 03.

**Status:** ready-for-agent

- [ ] `SKILL.md` has a `## Stage 2` section that groups the cycle's blockers
      into clusters, fixes each, lands one commit per cluster, and returns to
      Stage 1.
- [ ] `references/fix-dispatch.md` specifies clustering: related blockers fixed
      together as one cluster; one cluster per coherent fix.
- [ ] It specifies the dispatch-vs-inline rule: a cluster needing a new or
      changed test, or spanning more than one file, is dispatched; a one-file
      cluster with no test change is hand-applied inline, with the affected
      tests and the typecheck run inline as the sanctioned context cost.
- [ ] It specifies the dispatch contract, copied from `subagent-implement` and
      citing it: a worker subagent (`isolation: "worktree"`, never `fork`), a
      worker branch `review-to-pr/<feature-slug>/fix-<n>` cut from integration
      `HEAD`, a self-contained test-first prompt written to
      `.scratch/<slug>/prompts/fix-<n>.md`, then a fresh `Explore` verifier that
      reproduces the would-be-red, runs green + typecheck + the affected tests,
      and returns raw evidence with no verdict.
- [ ] It specifies the retry budget `MAX_FIX_ATTEMPTS = 3`: a verification gap
      resumes the same worker via `SendMessage` with the specific detail; a
      worker crash or timeout counts as one attempt and re-dispatches fresh.
- [ ] It specifies the commit: each cluster lands as exactly one `fix(review):
      <summary>` commit appended to the integration branch (a dispatched fix
      squash-merged from its worker branch), recorded in
      `review-status.md`'s `fix_commits`.
- [ ] It specifies unfixable handling: a cluster that fails three attempts
      leaves its blockers `unfixable` in the ledger, keeps the worktree, and is
      named in the handoff as "not PR-ready"; the orchestrator writes no fix
      code itself beyond an inline one-file cluster.
- [ ] It carries the first-use confirmation checklist (the five items from the
      spec's Further Notes).
- [ ] `evals/evals.json` gains cases: multi-file cluster dispatched; one-file
      no-test cluster inline; missing-test blocker dispatched test-first; three
      failed attempts → `unfixable` + named in handoff; worker crash counts as
      one attempt; one `fix(review):` commit per cluster; orchestrator does not
      hand-code a dispatched cluster.
- [ ] `tests/review-to-pr-contract.test.mjs` asserts the Stage 2 section and
      `fix-dispatch.md` cover clustering, the dispatch rule, `isolation:
      "worktree"` / not-fork, `MAX_FIX_ATTEMPTS = 3`, `SendMessage`, the
      `fix(review):` commit, and the unfixable path.
- [ ] `npm run validate` and `npm test` pass.
