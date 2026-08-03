---
name: agent-instructions-architect
description: Audit, design, migrate, and validate repository agent-instruction systems with AGENTS.md as the canonical source and runtime-aware adapters for Codex, Claude Code, GitHub Copilot CLI, and OpenCode. Use for AGENTS.md or AGENTS.override.md hierarchy, CLAUDE.md adapters, Copilot custom instructions, OpenCode rules, scoped instructions, context budgets, precedence or duplication conflicts, broken references, and safe instruction migrations. Do not use for generic prompt writing, custom-agent architecture, or unrelated documentation edits.
---

# Agent Instructions Architect

Give agents the smallest useful instruction context at the correct scope. Keep
`AGENTS.md` canonical and treat native runtime files as adapters or selectors.

## Operating contract

- Inspect the repository before recommending content.
- Preserve unrelated dirty-worktree changes and do not change application code.
- Separate repository evidence, sourced runtime facts, recommendations,
  assumptions, and unresolved state.
- Never describe inventory size as loaded context.
- Keep adapters thin and avoid copied policy prose.

## Select a mode

- **Audit**: inventory and assess the current system. Remain read-only.
- **Design**: propose a canonical tree, scopes, and adapters. Remain read-only.
- **Migrate**: apply a direct, explicit update request within inspected paths.
- **Validate**: run deterministic checks and semantic review. Remain read-only
  unless the user also requests fixes.

If the mode or runtime is ambiguous, audit first and state the missing decision.

## Workflow

1. Run `scripts/scan-instruction-tree.py` before reading a large instruction
   tree. Declare `--runtime`, `--cwd`, and relevant `--target` paths.
2. Read `references/instruction-taxonomy.md`. For design or migration, also
   read `references/repository-layout.md` and
   `references/migration-playbook.md`.
3. Read `references/runtime-compatibility.md` before making any runtime load,
   precedence, adapter, or budget claim.
4. Classify each rule, identify its canonical owner, and distinguish inventory,
   startup, import, conditional, shadowed, and unresolved artifacts.
5. Measure each selected runtime separately with
   `scripts/measure-context-budget.py`; never merge `--runtime all` results.
6. Produce exact findings or a patch plan. Cite files for repository evidence
   and primary sources for changeable runtime behavior.
7. Apply only authorized changes, then run unit tests when scripts changed,
   `scripts/validate-instruction-tree.py`, context measurement, and the
   checklist in `references/quality-rubric.md`.

## Authorization gate

- Treat audit and design requests as read-only.
- Treat a direct request to apply, migrate, update, or rewrite as authorization
  for a scoped, non-destructive patch after inspection.
- Request approval naming each exact path and action before deleting, renaming,
  broadly replacing a whole file, or leaving agreed instruction paths.

## Root and adapter rules

- Keep root `AGENTS.md` stable and useful before task selection.
- Route task-specific details with an explicit read condition.
- Use nested `AGENTS.md` only after checking runtime activation semantics.
- Use `AGENTS.override.md` for an intentional Codex-specific replacement, not
  as a portable scoping mechanism.
- Do not assume a Markdown link is automatically loaded.
- Put mandatory enforcement in CI, hooks, permissions, or sandboxes rather
  than prompt text alone.

## Report by mode

- **Audit**: `Mode`, `Inventory`, `Findings`, `Context`, `Recommendations`.
- **Design**: add `Proposed layout`, `File operations`, and `Open decisions`.
- **Migrate**: add `Changed files`, `Checks run`, and `Remaining risks`.
- **Validate**: report command, runtime/cwd/targets, diagnostics, and verdict.

Omit empty sections. Always distinguish deterministic diagnostics from semantic
review findings.

## Bundled resources

- `references/runtime-compatibility.md`: sourced runtime load semantics.
- `references/instruction-taxonomy.md`: scope, ownership, and enforcement.
- `references/repository-layout.md`: canonical tree and adapter locations.
- `references/migration-playbook.md`: authorization and migration sequence.
- `references/quality-rubric.md`: final semantic review.
- `references/examples-*.md`: small, monorepo, and cross-runtime patterns.
- `scripts/instruction_model.py`: shared repository-local resolver.
- `scripts/scan-instruction-tree.py`: runtime-aware inventory.
- `scripts/validate-instruction-tree.py`: deterministic diagnostics.
- `scripts/measure-context-budget.py`: resolved context measurement.
