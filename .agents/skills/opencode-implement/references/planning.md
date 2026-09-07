# Stage 0 — Planning procedure

The orchestrator follows this procedure by reading and reasoning. There is no
script. Every step is read-only: nothing outside `.scratch/<feature-slug>/` is
created or modified until the user approves the Plan.

## 1. Resolve the target

- An explicit directory argument (`.scratch/<feature-slug>/` or
  `.scratch/<feature-slug>/issues/`) wins.
- A bare `<feature-slug>` resolves to `.scratch/<feature-slug>/issues/`.
- With no argument, pick the most recently modified `.scratch/*/issues/`
  directory, name it back to the user, and wait for confirmation before parsing.

Load, from the resolved feature directory:

- every `issues/<NN>-<slug>.md` ticket file
- the parent `spec.md` — Implementation Decisions, Testing Decisions, seams
- `CONTEXT.md` (domain glossary) and `adr/` in the feature directory
- the repository's root `CONTEXT.md` and `docs/decisions/` (or `docs/adr/`) if present

Reading these once, here, is the orchestrator's one deliberate context cost: it
is what lets every worker prompt be self-contained. Implementation reading
happens inside workers.

## 2. Parse the ticket format

Each ticket is in the `to-tickets` local format:

```
# <NN>: <title>

**What to build:** <end-to-end behaviour>

**Blocked by:** <numbers/titles>, or "None (can start immediately)"

**Status:** ready-for-agent

- [ ] <acceptance criterion>
```

Record per ticket: number `NN`, slug, title, the verbatim "What to build", the
verbatim acceptance checkboxes, and the `Blocked by` list parsed into a set of
ticket numbers. "None (can start immediately)" parses to the empty set. A blocker
written as a title rather than a number resolves by matching the title.

## 3. Build and validate the dependency DAG

Nodes are tickets; a directed edge `A -> B` means "A is blocked by B" (B must
land first). Validate, and on any failure **halt the run before any other work**,
naming the specific broken ticket:

- **Acyclic.** A cycle (`03` blocked by `05`, `05` blocked by `03`) halts with
  `BLOCKED (TICKET_SET_CYCLIC)`, naming and reporting the tickets in the cycle.
- **Blockers resolvable.** A `Blocked by` entry that matches no existing ticket
  number or title halts with `BLOCKED (TICKET_SET_MISSING_BLOCKER)`, naming the
  ticket and the dangling reference.
- **Numbering consistent with a topological order.** `to-tickets` numbers tickets
  from `01` in dependency order, so every ticket's blockers should have lower
  numbers. A ticket blocked by a higher-numbered ticket halts with
  `BLOCKED (TICKET_SET_NUMBERING)` naming both.

## 4. Compute the dependency order

- The **frontier** is every ticket whose `Blocked by` set is fully satisfied by
  tickets already integrated (at the start, every ticket with no blockers).
- The **dependency order** is a topological ordering of the whole set. Where the
  ticket numbering is valid (step 3), ascending ticket number *is* a valid
  dependency order; use it, so "one commit per ticket in dependency order" and
  "ascending ticket number" mean the same thing.

The run works one ticket at a time in this order. Tickets with no edge between
them are still worked one after another — execution is serial and parallelism is
a non-goal, because one local model instance serializes inference regardless
(adr/0005). There is no wave computation, no touch-set estimation, and no model
column: those exist in `agy-implement` only to schedule and de-risk concurrency
across providers.

## 5. Select a test seam per ticket

The orchestrator selects each ticket's test seam at planning, using the parent
spec's **Testing Decisions** as the primary input wherever they constrain it.
Where the Testing Decisions name a seam for the ticket's area, use it verbatim.
Where they only give module-level guidance, choose the narrowest public boundary
that exercises the ticket's acceptance criteria and record it. Every seam is
shown in the Plan; the worker is handed its seam and tests there rather than
inventing one. A ticket whose acceptance criteria cannot be exercised by an
isolated test at any seam is a decomposition problem — it returns to planning
rather than being implemented without a test.

## 6. Build a criterion-level step plan per ticket

Every ticket gets a **step plan** — an ordered chain of **sub-steps** — because a
tracer-bullet ticket does not fit the local model's 32k-token window (adr/0006).

- **Default fault line: one acceptance criterion per sub-step.** A ticket with a
  single criterion is a one-sub-step chain (behaves like running the ticket
  whole). A ticket with four criteria is a four-sub-step chain.
- Order the sub-steps so each builds on the last — a criterion that establishes a
  seam or a data shape another criterion needs comes first.
- **Estimate each sub-step's content** against the **context budget**:
  provisionally ~13k tokens of sub-step-specific content
  (`micro-prompt + named spec sections + ADRs + files the sub-step must read +
  expected edits + reasoning headroom`), derived as `32k window − ~11k input
  floor − ~4k headroom − ~4k reasoning reserve`. The exact number is pinned by
  validation probe C.
- **A sub-step over budget is split finer** along the next natural line — a file,
  a layer (schema / logic / interface). The **bias is to over-split**: an extra
  ~3-minute sub-step is cheap; a sub-step that overflows and hangs is not.
- Record each sub-step's **file scope** — the files it reads and the files it may
  write — so the worker prompt can be tight and the checkpoint check knows what
  to look at.

## 7. Predict each ticket's path

- `local` — the whole step plan is expected to run on `opencode` workers.
- `subagent-fallback` — the ticket has a single criterion that cannot be split
  fine enough to get under the context budget. Under `--no-fallback` this is
  instead flagged for `BLOCKED (TICKET_TOO_LARGE_FOR_CONTEXT)`.

The prediction is information for the Plan; the actual path is decided at runtime
(a `local` ticket still escalates if it fails verification or `opencode` keeps
failing — see [fallback.md](fallback.md)).

## 8. Emit the Plan and pause

Present the **Plan**: the ticket table in dependency order plus, per ticket:

| field | source |
|---|---|
| ticket number and title | step 2 |
| blockers | step 2 |
| test seam | step 5 |
| step plan — the ordered sub-steps and each one's file scope | step 6 |
| predicted path (`local` / `subagent-fallback`) | step 7 |
| retry budgets — `MAX_TICKET_ATTEMPTS`, `MAX_OPENCODE_RETRIES` (both 3) | step 8 |

Also show the editable run parameters, every one adjustable at approval:
`--model` (default `ollama/qwen3.8:27b-mlx-32k`), `--fallback-agent` (default
`general-purpose`), `--no-fallback`, `FIRST_EVENT_TIMEOUT`, `STALL_INTERVAL`,
`WORKER_TIMEOUT`, `MAX_TICKET_ATTEMPTS`, `MAX_OPENCODE_RETRIES`, and the context
budget — the timeouts and the budget provisional pending validation probe C.

The Plan has **no model column** — every worker uses the one `--model` value.

Then pause for explicit approval. Adjust the Plan on request — the step plans,
the fault line for a ticket, the run parameters. Mutate no file outside
`.scratch/<feature-slug>/` before approval.

`continue` re-runs this procedure against current reality and re-presents the
Plan before resuming execution.
