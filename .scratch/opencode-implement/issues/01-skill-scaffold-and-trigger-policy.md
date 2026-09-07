# 01: Skill scaffold and trigger policy

**What to build:** `/opencode-implement` exists as an explicitly-invoked skill in this
repo — recognized by the runtime, refusing implicit invocation, registered in the skill
index, and passing every repo gate. Running it does nothing useful yet, but it is a
valid, discoverable skill whose trigger and invocation-option parsing are pinned by an
eval suite. This is the "make the change easy" prefactor for tickets 02–07.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `skills/agents/opencode-implement/SKILL.md` has frontmatter `name:
      opencode-implement`, a description (≥ 80 chars) naming the full span (read a ticket
      directory → plan → criterion-level decompose → dispatch local `opencode` workers →
      verify → auto-fallback to a native subagent when the local model cannot deliver →
      integrate one commit per ticket → stop before review), and
      `disable-model-invocation: true`
- [x] `skills/agents/opencode-implement/agents/openai.yaml` sets
      `allow_implicit_invocation: false` with a display name and a `default_prompt` that
      invokes `$opencode-implement`, mirroring the shape of
      `skills/agents/agy-implement/agents/openai.yaml`
- [x] The skill is mirrored byte-identical to `.agents/skills/opencode-implement/`, and
      the symlink `.claude/skills/opencode-implement → ../../.agents/skills/opencode-implement`
      exists (matching the other agent skills)
- [x] A human guide exists at `docs/skills/agents/opencode-implement.md` following the
      repo's skill-guide template — `## ภาษาไทย / Thai` and `## English / ภาษาอังกฤษ`
      sections and the `npx skills add ArrayaWongsaita/skills --skill opencode-implement`
      line (stub sections acceptable; completed in ticket 07)
- [x] SKILL.md documents the invocation surface — `/opencode-implement <dir|slug>`,
      `$opencode-implement <dir|slug>`, the `continue` / `status` / `list` sub-commands,
      and the run options `--model provider/model` (default `ollama/qwen3.8:27b-mlx-32k`),
      `--fallback-agent <name>` (default `general-purpose`), `--no-fallback` /
      `--strict-local` (each behavior specified in later tickets)
- [x] `skills/agents/opencode-implement/evals/trigger-evals.json` asserts
      `/opencode-implement`, `$opencode-implement`, and the sub-command / option forms
      trigger (`should_trigger: true`), and that a generic "implement this", a bare
      mention of tickets, of `opencode` or Ollama, and a mention of a sibling skill
      (`agy-implement`, `subagent-implement`) do not (`should_trigger: false`) — with at
      least one positive and one negative case
- [x] `npm run docs:index`, `npm run validate`, and `npm test` all pass with the new
      skill present
