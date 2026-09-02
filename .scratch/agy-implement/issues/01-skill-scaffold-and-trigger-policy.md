# 01: Skill scaffold and trigger policy

**What to build:** `/agy-implement` exists as an explicitly-invoked skill in this repo —
recognized by the runtime, refusing implicit invocation, registered in the skill index,
and passing every repo gate. Running it does nothing useful yet, but it is a valid,
discoverable skill whose trigger behavior is pinned by an eval suite. This is the
"make the change easy" prefactor for tickets 02–06.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `skills/agents/agy-implement/SKILL.md` has frontmatter `name: agy-implement`, a
      one-line description naming the full span (read a ticket directory → plan waves →
      dispatch `agy` workers → verify → integrate → stop before review), and
      `disable-model-invocation: true`
- [ ] `skills/agents/agy-implement/agents/openai.yaml` sets `allow_implicit_invocation:
      false` with a display name and default prompt, mirroring the shape of
      `grill-to-tickets/agents/openai.yaml`
- [ ] The skill is mirrored to `.agents/skills/agy-implement/` in the layout the repo
      uses for its other agent skills
- [ ] A human guide exists at `docs/skills/agents/agy-implement.md` following the repo's
      skill-guide template (stub sections acceptable; completed in ticket 06)
- [ ] SKILL.md documents the invocation surface — `/agy-implement <dir|slug>`,
      `$agy-implement <dir|slug>`, and the `continue` / `status` / `list` sub-commands
      (each sub-command's behavior is specified in later tickets)
- [ ] `evals/trigger-evals.json` asserts `/agy-implement` and `$agy-implement` trigger
      (`should_trigger: true`) and that a generic "implement this", a bare mention of
      tickets, and a mention of a sibling skill do not (`should_trigger: false`)
- [ ] `npm run docs:index`, `npm run validate`, and `npm test` all pass with the new
      skill present
