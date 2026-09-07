# 07: Preflight, completion handoff, docs, ADR, full eval suite

**What to build:** A run refuses to start against a dirty target repository, sets up (or
reuses) the integration branch, gitignores the worktree directory, confirms Ollama and
`opencode` are reachable, and runs the preflight smoke test; on completing every ticket
it prints a handoff with the integration branch name, one-commit-per-ticket
confirmation, per-path token usage (local = `cost: 0`; each `subagent-fallback` ticket
named with its Claude token spend and a note that its code context left the machine), and
the exact `/code-review` + `/scrutinize` commands to run next — without pushing or
opening a PR. The skill ships with a complete human guide, its repo-wide ADR, and the
full behavioral eval suite, with every repo gate green.

**Blocked by:** 02, 03, 04, 05, 06

**Status:** done

- [x] Preflight (`references/worktree-integration.md` + SKILL.md) halts a run when the
      target repo has uncommitted changes (asks, never auto-stashes), creates or
      switches to `opencode-implement/<feature-slug>` from `HEAD`, adds
      `.scratch/<slug>/worktrees/` to `.gitignore`, confirms `opencode` on `PATH` +
      `opencode models` lists the model + Ollama reachable, and runs the smoke test from
      ticket 03
- [x] On completion the skill prints the integration branch name, one-commit-per-ticket
      confirmation, per-path token usage with each fallback ticket named (Claude tokens
      spent, code left the machine), and `/code-review since <merge-base with main>` then
      `/scrutinize` to run in a fresh context; it never pushes or opens a PR
- [x] `docs/skills/agents/opencode-implement.md` is a complete bilingual human guide per
      the repo's skill-guide template — what it is, when to use it (and when to use
      `/implement`, `/agy-implement`, `/subagent-implement` instead), that it is a
      slow background/overnight tool, the `--model` / `--fallback-agent` / `--no-fallback`
      options, and the local-model reliability caveat
- [x] `docs/decisions/0007-opencode-implement-standalone.md` records the standalone
      local-first stance in the bilingual format of `docs/decisions/0005`–`0006` (a
      draft exists in the feature directory work — finalize and place it, verify the
      number is still free)
- [x] `evals/evals.json` contains every behavioral case from the spec's Testing
      Decisions (~30), each with `id`, unique `name`, `prompt`, `expected_output`, a
      non-empty `expectations` array, and a `files` array — runnable through
      `skill-creator`'s existing eval tooling with no change to that tooling
- [x] SKILL.md's `references/` links all resolve and stay inside the skill directory;
      `skills/agents/opencode-implement/` and `.agents/skills/opencode-implement/` are
      byte-identical
- [x] `npm run docs:index`, `npm run validate`, and `npm test` all pass
