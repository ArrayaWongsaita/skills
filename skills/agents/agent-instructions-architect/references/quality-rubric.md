# Quality rubric

## Canonical and root quality

- `AGENTS.md` owns shared policy; adapters contain no copied policy prose.
- Root guidance is stable, high-authority, and useful before task selection.
- Every routed file states when it is relevant.
- A 200-line warning is a maintainability heuristic, not a universal runtime
  limit; byte budgets and load behavior remain runtime-specific.

## Scope and context quality

- Rules live at the narrowest valid scope.
- Inventory, startup, import, conditional, shadowed, and unresolved artifacts
  are reported separately.
- Measurements use a declared runtime, working directory, and target paths.
- No unrelated nested `AGENTS.md` is counted as Codex startup context.
- Imports, adapters, and exact duplicate paragraphs do not inflate context
  without being visible in diagnostics.

## Evidence quality

- Commands, paths, ownership, and runtime claims cite repository evidence or a
  dated primary source.
- Static analysis does not claim knowledge of user config, remote content, or
  dynamic file access that it did not inspect.
- Deterministic checks report syntax, links, imports, cycles, globs, shadowing,
  and exact duplicates; semantic conflicts remain an explicit review task.

## Operational and safety quality

- A new agent can identify the next file and validation command quickly.
- Audit and design modes are read-only.
- Direct apply intent and destructive approval are distinguished.
- Deletes, renames, broad replacements, and dirty-worktree risks are visible.
- Validation failures are reported rather than hidden or reclassified.
