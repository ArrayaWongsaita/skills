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
- the repository's root `CONTEXT.md` / `docs/adr/` (or `docs/decisions/`) if present

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
- **Blockers resolvable.** An unresolvable blocker — a `Blocked by` entry that
  matches no existing ticket number or title — halts with
  `BLOCKED (TICKET_SET_MISSING_BLOCKER)` (a missing blocker), naming the ticket
  and the dangling reference.
- **Numbering consistent with a topological order.** `grill-to-tickets` numbers
  tickets from `01` in dependency order, so every ticket's blockers should have
  lower numbers. A ticket blocked by a higher-numbered ticket halts with
  `BLOCKED (TICKET_SET_NUMBERING)` naming both.

## 4. Compute execution waves

- **Wave 0** = every ticket whose `Blocked by` set is empty.
- **Wave K** = every ticket whose blockers all landed in waves `< K`.

Within a wave, two tickets with no `Blocked by` edge between them are
**independent tickets** — the candidates for running at the same time.

## 5. Estimate each ticket's touch-set (advisory hint)

For each ticket, estimate the files and directories it will create or modify,
from the "What to build" text, the parent spec, and a look at the current
codebase. This is an **advisory hint shown in the Plan, not a gate** — a
pre-implementation guess is not reliable enough to gate concurrency on, and the
integration gate catches the same collisions deterministically.

Raise a **`likely-overlapping — consider serializing`** flag on a pair of
independent same-wave tickets when either:

- their estimated touch-sets intersect, or
- either ticket touches a **cross-cutting file**.

The cross-cutting-file list is configurable; the defaults are:

- the router / route table
- the DI container
- the root ORM schema
- the migrations directory
- `package.json` and lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`)
- CI configuration
- shared env / config modules

The default suggestion for a flagged pair is to serialize it within the wave. The
user decides at Plan approval which flagged tickets to serialize and which to run
in parallel anyway — the integration gate, not this heuristic, is what guarantees
correctness.

A ticket that `grill-to-tickets` sequenced as a **wide-refactor expand–contract
batch** runs as ordered serial steps on the integration branch —
`grill-to-tickets` stratifies expand | migrate batches | contract into successive
waves, and the integration gate runs the full suite at each wave boundary, so the
batch stays green step to step. It gets no wide-refactor-specific handling beyond
honoring the order.

## 6. Select a test seam per ticket

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

## 7. Emit the Plan and pause

Present the **Plan**: a wave table plus, per ticket:

| field | source |
|---|---|
| wave | step 4 |
| estimated touch-set | step 5 (advisory) |
| serial / parallel proposal + reason | step 4 + step 5 flags |
| overlap flags | step 5 |
| test seam | step 6 |
| retry budgets | `MAX_TICKET_ATTEMPTS = 3`, `MAX_OPENCODE_RETRIES = 3` |

The Plan has **no model column** — one resolved model, captured once before
wave 0 and pinned for the rest of the run, serves every worker (see
[worker-contract.md](worker-contract.md)); model is not assigned per ticket or
per dispatch.

Also show the editable run parameters: the concurrency cap (default 4),
`FIRST_EVENT_TIMEOUT`, `STALL_INTERVAL`, `WORKER_TIMEOUT`,
`MAX_TICKET_ATTEMPTS`, and `MAX_OPENCODE_RETRIES`.

Then pause for explicit approval. Adjust the Plan on request — which flagged
tickets serialize, which waves run in parallel, the concurrency cap, or the
timeouts and retry budgets. Mutate no file outside `.scratch/<feature-slug>/`
before approval.

`continue` re-runs this procedure against current reality and re-presents the
Plan before resuming execution.
