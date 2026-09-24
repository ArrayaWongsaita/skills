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

Each ticket is in the `grill-to-tickets` ticket format:

```
# <NN>: <title>

**What to build:** <end-to-end behaviour>

**Blocked by:** <numbers/titles>, or "None (can start immediately)"
**Reuse:** <catalog verbs and symbols>, or "none"
**Stories:** <story numbers>
**Seam:** <one test boundary>
**Context:** <spec section refs and files>
**Budget:** read ~<N>k tokens · <C> criteria · <M> modules
**Status:** ready-for-agent

- [ ] <acceptance criterion>
```

Record per ticket: number `NN`, slug, title, the verbatim "What to build", the
verbatim acceptance checkboxes, the `Blocked by` list parsed into a set of
ticket numbers, and the verbatim `**Seam:**` line when the ticket has one.
"None (can start immediately)" parses to the empty set. A blocker
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
- **Numbering consistent with a topological order.** `grill-to-tickets` numbers
  tickets from `01` in dependency order, so every ticket's blockers should have
  lower numbers. A ticket blocked by a higher-numbered ticket halts with
  `BLOCKED (TICKET_SET_NUMBERING)` naming both.

## 4. Compute the dependency order

- The **frontier** is every ticket whose `Blocked by` set is fully satisfied by
  tickets already integrated (at the start, every ticket with no blockers).
- The **dependency order** is a topological ordering of the whole set. Where the
  ticket numbering is valid (step 3), ascending ticket number *is* a valid
  dependency order; use it, so "one commit per ticket in dependency order" and
  "ascending ticket number" mean the same thing.

v1 runs one ticket at a time in this order. Tickets with no edge between them are
still run one after another — the parallelism that would exploit their
independence is a deferred follow-up. No wave computation, and no touch-set
estimation: those exist in `agy-implement` only to schedule and de-risk
concurrency.

## 5. Select a test seam per ticket

A ticket's `**Seam:**` line, when present, is its test seam — use it verbatim.

For a ticket without one, the orchestrator selects the seam at planning, using
the parent spec's **Testing Decisions** as the primary input wherever they
constrain it. Where the Testing Decisions name a seam for the ticket's area, use
it verbatim. Where they only give module-level guidance, choose the narrowest
public boundary that exercises the ticket's acceptance criteria and record it.
Every seam is shown in the Plan; the worker is handed its seam and tests there
rather than inventing one. A ticket whose acceptance criteria cannot be exercised
by an isolated test at any seam is a decomposition problem — it returns to
planning rather than being implemented without a test.

## 6. Match an agent per ticket

Follow
[dispatch-contract.md](dispatch-contract.md) §"Resolving the worker agent". In
short: a run-level `--agent <name>` pins every ticket to that subagent type;
otherwise the orchestrator reads the subagent types available in its environment
and picks an implementation-shaped one when the name or description clearly
covers building software, falling back to `general-purpose`. The match is by
wording, never by reasoning about which ticket suits which agent — that judgement
is the part that goes wrong.

Record the matched agent per ticket for the Plan and for `status.md`.

## 7. Emit the Plan and pause

Present the **Plan**: the ticket table in dependency order plus, per ticket:

| field | source |
|---|---|
| ticket number and title | step 2 |
| blockers | step 2 |
| test seam | step 5 |
| matched agent | step 6 |
| retry budget | `MAX_TICKET_ATTEMPTS = 3` |

Also show the editable run parameters: the `--agent` pin (if any) and the
`--model` pass-through (if any).

The Plan has **no model column** — model is not reasoned about per ticket. A
worker inherits the orchestrator's model unless the run set `--model`, and a
matched custom agent uses its own configured model.

Then pause for explicit approval. Adjust the Plan on request — the agent pin, the
model pass-through, a seam. Mutate no file outside `.scratch/<feature-slug>/`
before approval.

`continue` re-runs this procedure against current reality and re-presents the
Plan before resuming execution.
