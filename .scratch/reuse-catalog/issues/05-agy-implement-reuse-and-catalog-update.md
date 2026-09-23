# 05: agy-implement mirrors the Reuse prompt lines and catalog update

**What to build:** `agy-implement` gets the same catalog-aware behaviour ticket 04
established for `subagent-implement`, adapted to its wave-gated integration: the
Reuse and catalog lines in the worker prompt, the Reuse Plan section rule, and
catalog entries written in each ticket's squash commit during the wave's
serial integration — so parallel wave-mates never write the catalog.

**Blocked by:** 04

**Status:** done

- [x] `references/prompt-scaffold.md` carries the same two "Context you need"
      lines and the Reuse Plan section rule as `subagent-implement`, worded
      identically where the skills share structure.
- [x] `references/worktree-integration.md` integration gate adds the catalog
      update inside each ticket's squash commit, in ascending ticket-number order,
      with the same derive-from-text rules, not-found handling (noted in the
      status file), and no-catalog skip.
- [x] `SKILL.md` points to both.
- [x] `evals/evals.json` gains cases: parallel wave with two tickets reading the
      catalog → only the orchestrator writes it, one entry per ticket commit;
      create-shared owner in wave 0 and its consumer in wave 1 → consumer's prompt
      carries `use`; no catalog → no catalog step.
- [x] `tests/agy-implement-contract.test.mjs` asserts the scaffold lines and the
      integration-gate catalog update.
- [x] Both `agy-implement` human guides describe the catalog behaviour.
- [x] `npm run validate` and `npm test` pass.
