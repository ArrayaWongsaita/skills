# 06: Preflight, completion handoff, docs, ADR, full eval suite

**What to build:** A run refuses to start against a dirty target repository and sets up
(or reuses) the integration branch and gitignores the worktree directory; on completing
every ticket it prints a handoff with the integration branch name, per-provider token
usage, and the exact `/code-review` and `/scrutinize` commands to run next, without
pushing or opening a PR. The skill ships with a complete human guide, a repo-wide ADR
recording its standalone stance, and the full behavioral eval suite, with every repo
gate green.

**Blocked by:** 02, 03, 04, 05

**Status:** ready-for-agent

- [ ] Preflight halts a run when the target repo has uncommitted changes (asks, never
      auto-stashes), creates or switches to the integration branch
      `agy-implement/<feature-slug>`, and adds `.scratch/<slug>/worktrees/` to
      `.gitignore`
- [ ] On completion the skill prints the integration branch name, one-commit-per-ticket
      confirmation, cumulative per-provider token usage, and the `/code-review` +
      `/scrutinize` commands to run in a fresh context; it never pushes or opens a PR
- [ ] `docs/skills/agents/agy-implement.md` is a complete human guide per the repo's
      skill-guide template
- [ ] `docs/decisions/0004-agy-implement-standalone.md` records that `agy-implement` is a
      standalone skill that does not modify or depend on `grill-to-tickets` or
      `engineering-workflow` and owns its own copy of the machinery, in the bilingual
      format of `docs/decisions/0003-*`
- [ ] `evals/evals.json` contains all 20 behavioral cases from the spec's Testing
      Decisions, runnable through `skill-creator`'s existing eval tooling with no change
      to that tooling
- [ ] `npm run docs:index`, `npm run validate`, and `npm test` all pass
