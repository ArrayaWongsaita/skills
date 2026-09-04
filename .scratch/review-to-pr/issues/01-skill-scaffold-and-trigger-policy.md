# 01: Skill scaffold, invocation surface, and trigger policy

**What to build:** The `review-to-pr` skill as a walking skeleton — it exists in
the canonical location, the byte-identical mirror, and the symlink, with valid
frontmatter and an explicit-only trigger policy, a `SKILL.md` that documents the
whole invocation surface and the six-stage overview, and the docs/tests
scaffolding that every later ticket extends. The five `references/` files may be
one-paragraph stubs at this stage; ticket 02–06 fill them.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `skills/agents/review-to-pr/SKILL.md` has frontmatter `name: review-to-pr`,
      `disable-model-invocation: true`, and a `description` ≥ 80 characters that
      names the span (review / blocker / scrutinize / suite / handoff).
- [ ] `.agents/skills/review-to-pr/` is a byte-identical copy of
      `skills/agents/review-to-pr/`, and `.claude/skills/review-to-pr` is a
      symlink to `../../.agents/skills/review-to-pr`.
- [ ] `agents/openai.yaml` (both copies) has `display_name`,
      `short_description`, a `default_prompt` invoking `$review-to-pr`, and
      `allow_implicit_invocation: false`.
- [ ] `SKILL.md` documents: `/review-to-pr [<ref>|<slug>]`, `$review-to-pr`, the
      `--agent <name>` and `--model <id>` options, the sub-commands `continue`
      and `status`, the six-stage flow diagram (Stage 0–5), and states that a
      run starts only on explicit human invocation.
- [ ] `SKILL.md` links all five reference files —
      `references/{review-point,review-loop,fix-dispatch,scrutiny-gate,status-and-resume}.md`
      — and names `docs/decisions/0006-review-to-pr-standalone.md`.
- [ ] `SKILL.md` body steers positively — it contains no `Never` and no `Do not`.
- [ ] `docs/skills/agents/review-to-pr.md` exists with a `## ภาษาไทย / Thai`
      section, a `## English / ภาษาอังกฤษ` section, and the command
      `npx skills add ArrayaWongsaita/skills --skill review-to-pr`.
- [ ] `docs/decisions/0006-review-to-pr-standalone.md` exists, bilingual, with
      `# ADR 0006:`, `## Status`, `## Context`, `## Decision`, `## Consequences`.
- [ ] `evals/trigger-evals.json` (both copies, byte-identical) has positive
      cases for `/review-to-pr` and `$review-to-pr` and at least three negative
      cases, none of which use an explicit `review-to-pr` invocation.
- [ ] `evals/evals.json` (both copies, byte-identical) has `skill_name:
      "review-to-pr"` and a non-empty `evals` array with unique integer ids and
      unique names.
- [ ] `tests/review-to-pr-contract.test.mjs` and
      `tests/review-to-pr-evals.test.mjs` exist and assert the scaffold facts
      above (frontmatter, mirror identity, symlink, openai.yaml, positive
      steering, guide sections, ADR sections, reference-set links).
- [ ] `npm run docs:index` regenerates `docs/skills/README.md` with the new row,
      and `npm run validate` and `npm test` pass.
