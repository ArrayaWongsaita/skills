Adapted from mattpocock/skills:skills/engineering/to-tickets/SKILL.md (sha256 folder hash bf5e6ebcb4f1272de0c188d5b3901f265a03d1fa9935a21a7a56938e21e2e761). See [UPSTREAM-LICENSE.md](UPSTREAM-LICENSE.md).

# Ticket Format

Break a shipped `spec.md` into tracer-bullet vertical slices, each declaring the tickets that block it, written to local ticket files under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`.

## Process

### 1. Gather context

Work from `spec.md`, `decisions.md`, `CONTEXT.md`, and any ADRs under `.scratch/<feature-slug>/`.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Ticket titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area being touched.

Look for opportunities to prefactor the code to make the implementation easier: make the change easy, then make the easy change. Prefactoring should be done first.

### 3. Draft vertical slices

Break the work into tracer-bullet tickets.

#### Vertical-slice rules

- Each slice cuts a narrow but complete path through every layer (schema, API, UI, tests): vertical, not a horizontal slice of one layer.
- A completed slice is demoable or verifiable on its own.
- Sizing: each slice is sized to fit in a single fresh context window.
- Any prefactoring should be done first.
- Give each ticket its blocking edges: the other tickets that must complete before it can start. A ticket with no blockers can start immediately. Work the frontier: tickets whose blockers are all complete.

#### Wide refactors: the expand–contract exception

Wide refactors are the exception to vertical slicing. A wide refactor is one mechanical change (rename a column, retype a shared symbol) whose blast radius fans across the whole codebase, so a single edit breaks many call sites at once and no vertical slice can land green alone. Sequence it as expand–contract:
1. **Expand:** add the new form beside the old so existing code continues working.
2. **Migrate:** update call sites in batches sized by blast radius (per package, per directory), each batch its own ticket blocked by the expand ticket, keeping CI green from batch to batch.
3. **Contract:** delete the old form once no caller remains, in a ticket blocked by every migrate batch.

#### Rules for ticket contents and acceptance criteria

- **Acceptance criteria:**
  - Suite, typecheck, and lint runs are already part of every implementer's verification, so they are not acceptance criteria. Every criterion must map to an observable, testable behaviour or outcome.
  - Documentation obligations are written as testable statements (for example, "the guide describes X").
- **No file paths in What to build or criteria:** Avoid specific file paths or code snippets in What to build and the acceptance criteria; they go stale quickly. Context is the one place a ticket names paths. Exception: inlined prototype snippets encoding a decision more precisely than prose can.
- **Reuse:** Every ticket carries a `**Reuse:**` line directly after `**Blocked by:**` with the fixed verbs `use`, `extend`, `create-shared`, `create-candidate`, `promote`, or `none`, following [reuse-pass.md](reuse-pass.md). Keep reuse out of the acceptance criteria.
- **Stories:** Every ticket carries a `**Stories:**` line directly after `**Reuse:**` listing the spec's user-story numbers it delivers, or `none` for a prefactor.
- **Seam:** Every ticket carries a `**Seam:**` line directly after `**Stories:**` naming one test boundary, taken from the spec's Testing Decisions. It must be a single non-empty line.
- **Context:** Every ticket carries a `**Context:**` line directly after `**Seam:**` listing the spec sections and repository files the worker needs. It must be a single line; Context items never wrap. Items are separated by ` · ` and come in six forms:
  - `spec § <ref>` — a spec section. `<ref>` is either a heading's text, or `<ancestor> › … › <heading>` to name a heading whose ancestors include the given ones, in order, not necessarily directly.
  - `<path>` — an existing file the worker reads and does not change (read-only).
  - `(edit) <path>` — an existing file this ticket changes.
  - `(new) <path>` — a file this ticket creates; it must not exist yet.
  - `(from NN) <path>` — a file that does not exist yet, that ticket NN creates, and that this ticket reads.
  - `(edit from NN) <path>` — a file that does not exist yet, that ticket NN creates, and that this ticket changes.
  For both `(from NN)` and `(edit from NN)` forms, ticket NN must carry `(new) <path>` and must be among this ticket's transitive blockers. Paths are relative to the project root and normalised with `path.posix.normalize`. An absolute path, a path that escapes the root, or a directory is an error.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each ticket, show:
- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first
- **Reuse**: the ticket's reuse line
- **Stories**: user-story numbers delivered
- **Seam**: the ticket's one test boundary
- **Context**: the ticket's Read set
- **What it delivers**: the end-to-end behaviour this ticket makes work

Ask the user:
- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct: does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split further?

Iterate until the user approves the breakdown.

### 5. Write local ticket files

Write one file per ticket under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` in dependency order (blockers first).

## Local Ticket Template

```markdown
# <NN>: <Ticket title>

**What to build:** the end-to-end behaviour this ticket makes work, from the user's perspective, not a layer-by-layer implementation list.

**Blocked by:** the numbers of the tickets that gate this one, or "None (can start immediately)".
**Reuse:** use / extend / create-shared / create-candidate / promote (or none)
**Stories:** user-story numbers delivered (or none)
**Seam:** one test boundary from the spec's Testing Decisions
**Context:** spec § <ref> · path/to/file · (edit) path/to/file · (new) path/to/file · (from NN) path/to/file · (edit from NN) path/to/file
**Status:** ready-for-agent

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2
```
