# Skill Fix Routing

A Skill fix reaches whoever can make it. During Stage 1, the Retro determines the ownership and destination of any Skill fix by inspecting lock files and repository structure.

## Lock Lookup Order

To determine skill ownership, the Retro checks lock files in the following strict order:

1. **Project lock file**: The project's `skills-lock.json` in the current repository root.
2. **Global lock file**: If not found in the project lock file, inspect the global `~/.agents/.skill-lock.json` written by global installs (`--global`).

## The Own-Library Test

A skill belongs to the user's own library if either of the following conditions is met:

- **The own-library test**: A skill belongs to the user's own library when its lock source in `skills-lock.json` (or `~/.agents/.skill-lock.json`) has the same lock source as `retro-to-remedies` itself (or matches `retro-to-remedies`'s own source), or when its `SKILL.md` lives under this repository's `skills/` tree.

## The Three Outcomes

Routing yields exactly one of three outcomes:

1. **Own library**: The skill is the user's own. Its Skill fix carries a ready-to-run `/grill-to-tickets` prompt naming the target repository that holds it (for example, this repository for skills under `skills/`).
2. **Upstream feedback**: The skill comes from any other source (for example, `mattpocock/skills`). Its Skill fix becomes Upstream feedback recorded for that source instead of being applied locally.
3. **Project-local**: A skill with no lock entry in either lock file and no source under this repository's `skills/` tree is treated as project-local.

## Untouched-Copy and Issue-on-Request Rules

- **Installed copies stay untouched**: No installed skill copy is ever edited. Modifying installed skill copies is prohibited because tools like `npx skills update` would silently overwrite local edits.
- **GitHub issue only on explicit request**: A GitHub issue opens only on an explicit request from the user. Nothing is submitted to external trackers or repositories uninvited.
