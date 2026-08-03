# Migration playbook

## Inspect

1. Snapshot the instruction tree or record checksums.
2. Scan known instruction locations before reading a large tree.
3. Record unrelated dirty-worktree state.
4. Identify the canonical source, active runtimes, working directory, target
   paths, adapters, imports, duplicates, conflicts, and stale references.
5. Separate repository evidence from assumptions and unresolved runtime state.

## Decide authorization

- Audit and design requests are read-only.
- A direct instruction to apply, migrate, update, or rewrite authorizes a
  scoped, non-destructive patch after inspection when exact paths are clear.
- Request approval naming every path and action before a delete, rename,
  broad whole-file replacement, or change outside the agreed instruction
  paths.
- Never infer authorization to change application source or unrelated files.

## Propose when required

Show the current and target trees, exact file operations, canonical owner,
runtime adapters, resolved context impact, validation commands, and unresolved
state. Do not apply a proposal produced for an audit-only request.

## Apply

- Patch only authorized paths and preserve unrelated changes.
- Update incoming references before an approved move or delete.
- Keep adapters thin; do not duplicate canonical paragraphs.
- Do not weaken a rule merely to make validation pass.

## Verify

Run unit tests when scripts changed, then scan, validate, and measure for every
selected runtime and working directory. Compare with the snapshot, report
failures, and prove that no out-of-scope path changed.
