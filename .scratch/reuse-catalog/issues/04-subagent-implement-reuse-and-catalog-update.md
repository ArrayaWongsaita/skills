# 04: subagent-implement carries Reuse to the worker and updates the catalog at integration

**What to build:** `subagent-implement` becomes catalog-aware. The worker prompt
carries the ticket's Reuse line verbatim, a read-only pointer to the catalog for
any unplanned helper, and — when the Reuse line has any verb other than `use` —
the spec's Reuse Plan among its named sections. At integration, the orchestrator
writes the ticket's catalog entries in the ticket's own squash commit, derived
from text it already holds. With no catalog in the project, the run behaves
exactly as before. This ticket establishes the wording `agy-implement` and
`opencode-implement` mirror.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `references/prompt-scaffold.md` "Context you need" gains
      `- Reuse: <the ticket's Reuse line, verbatim>` and, only when the file
      exists, `- Reuse Catalog: <abs path> — read-only for you; before creating
      any helper, component, or test factory not named in Reuse, search it for an
      existing one`. The Return contract is unchanged.
- [ ] The orchestrator notes in `prompt-scaffold.md` add the Reuse Plan to the
      worker's named spec sections whenever the Reuse line has a verb other than
      `use`.
- [ ] `references/verification-and-integration.md` integration step specifies,
      inside the ticket's squash commit, for each `create-shared`,
      `create-candidate`, `promote`, `extend` verb: grep the symbol in the
      worker's reported changed files to get its path (not found → no entry, a
      note in `status.md`); take use-when from the spec's Reuse Plan; add or
      update the line under Shared or Candidates, `promote` moving it from
      Candidates to Shared; Coverage dates untouched; no catalog file → skip.
- [ ] It states the orchestrator is the catalog's only writer during a run and
      reads no code to write an entry.
- [ ] `SKILL.md` mentions the catalog-aware prompt and integration step with
      pointers to both references.
- [ ] `evals/evals.json` gains cases: owner ticket with create-shared → entry
      added in the ticket's commit; promote → entry moved to Shared; symbol not
      found in changed files → no entry, noted; project with no catalog → no
      catalog step; worker prompt for a `use`-only ticket omits the Reuse Plan
      section.
- [ ] `tests/subagent-implement-contract.test.mjs` asserts the two scaffold
      lines, the Reuse Plan section rule, and the integration-step catalog update.
- [ ] `docs/guides/subagent-implement.md` and
      `docs/skills/agents/subagent-implement.md` describe the catalog behaviour.
- [ ] `npm run validate` and `npm test` pass.
