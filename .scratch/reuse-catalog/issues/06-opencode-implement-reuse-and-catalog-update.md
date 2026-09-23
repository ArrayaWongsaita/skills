# 06: opencode-implement mirrors the Reuse prompt lines and catalog update

**What to build:** `opencode-implement` gets the same catalog-aware behaviour
ticket 04 established, adapted to its per-ticket integration: the Reuse and
catalog lines in the whole-ticket scaffold (which the fallback subagent tier
receives unchanged), the Reuse Plan section rule, and catalog entries written in
each ticket's squash commit as it integrates.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `references/prompt-scaffold.md` carries the same two "Context you need"
      lines and the Reuse Plan section rule, worded identically where the skills
      share structure.
- [ ] `references/fallback.md` confirms the fallback subagent receives the same
      scaffold, so the Reuse lines reach it with no separate change.
- [ ] `references/worktree-integration.md` per-ticket integration adds the
      catalog update inside the ticket's squash commit, with the same
      derive-from-text rules, not-found handling, and no-catalog skip — including
      a ticket integrating after fallback escalation.
- [ ] `SKILL.md` points to both.
- [ ] `evals/evals.json` gains cases: ticket integrated via the fallback tier →
      catalog entry still written; per-ticket integration of two wave-mates →
      entries written serially, no conflict; no catalog → no catalog step.
- [ ] `tests/opencode-implement-contract.test.mjs` asserts the scaffold lines,
      the fallback inheritance, and the integration catalog update.
- [ ] Both `opencode-implement` human guides describe the catalog behaviour.
- [ ] `npm run validate` and `npm test` pass.
