# Setup, refactor, and migration playbook

## 1. Inspect

- Snapshot the relevant tree and dirty-worktree state.
- Follow `repository-inspection.md` before writing.
- Inventory root and nested `AGENTS.md`, skills, documentation, runtime adapters,
  CI, and generated artifacts.
- Identify authoritative owners, duplicates, stale paths, and unresolved facts.
- Run the scanner before manually loading a large legacy instruction tree.

## 2. Map responsibilities

Classify every retained item with `instruction-taxonomy.md`. Produce a target
tree and exact file operations. Prefer update, link, and consolidate over
parallel sources of truth.

For a new setup, start with root `AGENTS.md` and add only repository-supported
architecture docs, standards, skills, scoped files, or references. A typical
full-stack repository may justify database-design, database-change,
backend-development, frontend-development, testing, and security-review, but
the category list is not a creation checklist.

## 3. Decide authorization

- Audit and design remain read-only.
- Setup, refactor, migrate, update, rewrite, or implement authorizes scoped,
  non-destructive edits after inspection when paths are clear.
- Ask before deletion, rename, broad whole-file replacement, or changes outside
  the agreed instruction-system paths.
- Never infer permission to change application behavior.
- Design-only database work cannot create schemas, migrations, or code.

## 4. Apply

- Build the root map first, then authoritative documents, minimum skills, and
  only justified nested files.
- Preserve useful project-specific rules from the old system.
- Update incoming links before an approved move.
- Keep native runtime adapters thin.
- Add deterministic enforcement when practical rather than relying on prose.
- Do not weaken an invariant solely to make validation pass.

## 5. Validate

Review the diff, resolve every path and command, run instruction and repository
checks, test skill routing, audit duplication, and measure runtime context
separately for every active runtime and working directory. Compare with the
snapshot and prove that out-of-scope files did not change.
