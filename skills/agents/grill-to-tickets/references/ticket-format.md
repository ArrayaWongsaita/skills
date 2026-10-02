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
- Sizing: each slice is sized to fit in a single fresh context window; its `**Budget:**` line records the measurement.
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
  - Ticket acceptance criteria derive from the scenarios of the stories the ticket delivers. The checker does not compare criteria with scenarios.
  - Documentation obligations are written as testable statements (for example, "the guide describes X").
- **No file paths in What to build or criteria:** Avoid specific file paths or code snippets in What to build and the acceptance criteria; they go stale quickly. Context is the one place a ticket names paths. Exception: inlined prototype snippets encoding a decision more precisely than prose can.
- **Stories:** Every ticket carries a `**Stories:**` line directly after `**Blocked by:**` listing the spec's user-story numbers it delivers, or `none` for a prefactor.
- **Seam:** Every ticket carries a `**Seam:**` line directly after `**Stories:**` naming one test boundary, taken from the spec's Testing Decisions. It must be a single non-empty line.
- **Context:** Every ticket carries a `**Context:**` line directly after `**Seam:**` listing the spec sections and repository files the worker needs. It must be a single line; Context items never wrap. Items are separated by ` · ` and come in six forms:
  - `spec § <ref>` — a spec section. `<ref>` is either a heading's text, or `<ancestor> › … › <heading>` to name a heading whose ancestors include the given ones, in order, not necessarily directly.
  - `<path>` — an existing file the worker reads and does not change (read-only).
  - `(edit) <path>` — an existing file this ticket changes.
  - `(new) <path>` — a file this ticket creates; it must not exist yet.
  - `(from NN) <path>` — a file that does not exist yet, that ticket NN creates, and that this ticket reads.
  - `(edit from NN) <path>` — a file that does not exist yet, that ticket NN creates, and that this ticket changes.
  For both `(from NN)` and `(edit from NN)` forms, ticket NN must carry `(new) <path>` and must be among this ticket's transitive blockers. Paths are relative to the project root and normalised with `path.posix.normalize`. An absolute path, a path that escapes the root, or a directory is an error.
- **Budget:** Every ticket carries a `**Budget:**` line directly after `**Context:**` recording the checker's measurement of its Read set. It must be a single non-empty line, shaped `read ~<N>k tokens · <C> criteria · <M> modules`:
  - read tokens = ⌈ASCII code points ÷ 4⌉ + non-ASCII code points, counted over all of these sources together: the ticket file with its `**Budget:**` line removed, each section its `spec §` refs name, and each read-only and `(edit)` file — plus 2000 for each `(new)`, `(from NN)`, or `(edit from NN)` file;
  - `N` is `Math.round(read tokens ÷ 1000)`;
  - `C` counts the ticket's lines matching `^\s*- \[[ xX]\] `;
  - `M` counts the distinct parent directories of its `(edit)`, `(new)`, and `(edit from NN)` files.
  Run `scripts/check-tickets.mjs` to check the line; `--write-budget` writes it from the measurement. Without Node, write `**Budget:** unmeasured` and apply the checks by hand.
- **Risk:** Optional. A single-line `**Risk:**` directly after `**Budget:**`, either `**Risk:** low` or `**Risk:** high — <reason>`. The value is lower-case `low`, or lower-case `high` followed by ` — ` (an em dash with spaces) and a non-empty reason; anything else is a checker error. A missing field means `low`, so old tickets stay valid. The Risk line is left out of the Budget measurement, so adding it by hand does not make the Budget line stale.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each ticket, show:
- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first
- **Stories**: user-story numbers delivered
- **Seam**: the ticket's one test boundary
- **Context**: the ticket's Read set
- **Budget**: the ticket's measured Budget line
- **Review**: place each `ASK` question alongside that ticket's Seam, Context, and Budget; show a `READY` verdict for each ready ticket
- **What it delivers**: the end-to-end behaviour this ticket makes work

The quiz also shows the checker's story-coverage table, budget table, DAG summary (with the recommended implementer), and every warning. Log each warning under `## Ticket warnings` in `decisions.md` as acknowledged or fixed, and re-run the checker with `--write-budget` after each change.

For each ticket that matches the risk rule, propose `Risk: high` with its reason: it blocks three or more tickets; it changes a shared public interface or contract another ticket uses; it touches migration, auth, security, payment, or concurrency code; or it has an external or irreversible side effect. The person confirms or rejects each proposed high. Only a confirmed high is written to its ticket file as `**Risk:** high — <reason>`; every other ticket is written without a Risk field.

For each `ASK`, the person decides whether to fix or acknowledge the question.
The main thread waits until the person has seen and decided on the question
before applying a fix, and fixes a ticket only when the person chooses fix.
After each fix, re-run the checker with
`--write-budget`; a second review starts only when the person asks. `ASK` lines
name tickets as numbered at review time. When the quiz removes a
ticket, give its `ASK` line the `— acknowledged` suffix. The review set closes
at review time. Tickets the quiz creates join a review only after the person
asks for another review.

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
**Stories:** user-story numbers delivered (or none)
**Seam:** one test boundary from the spec's Testing Decisions
**Context:** spec § <ref> · path/to/file · (edit) path/to/file · (new) path/to/file · (from NN) path/to/file · (edit from NN) path/to/file
**Budget:** read ~<N>k tokens · <C> criteria · <M> modules
**Risk:** low | high — <reason> (optional; a missing field means low)
**Status:** ready-for-agent

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2
```
