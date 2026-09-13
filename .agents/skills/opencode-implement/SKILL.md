---
name: opencode-implement
description: Turn a directory of grill-to-tickets tickets into working code on a resolved, pinned hosted opencode model by planning execution waves, dispatching one headless opencode run worker per ticket in parallel within each wave up to a concurrency cap, forcing test-first implementation, verifying every result, automatically routing to a native-subagent fallback for any ticket the resolved model cannot deliver, integrating one commit per ticket onto a branch, and stopping before review.
disable-model-invocation: true
---

# opencode Implement

Take a directory of `grill-to-tickets` / `to-tickets` tracer-bullet tickets and
drive it to working code on one **resolved, pinned hosted** `opencode` model.
The main agent — the **orchestrator** — reads the ticket set and its parent
`spec.md`, plans the dependency order into **execution waves**, and estimates
each ticket's touch-set to flag likely-overlapping same-wave pairs. Once the
Plan is approved, it resolves the run's model exactly once — the user's
`--model`, or whatever `opencode run` itself resolves — and pins that value
for every worker for the rest of the run. It dispatches one headless
`opencode run` **worker** per ticket, built test-first, whole in one dispatch;
independent tickets in a wave run **concurrently**, one worktree each, up to a
**concurrency cap**. The orchestrator verifies every finished ticket itself;
and, for any ticket the resolved model cannot deliver, **automatically falls
back** to a native harness subagent for the whole ticket. Verified work is
assembled onto one **integration branch** as one commit per ticket, as soon as
that ticket clears — independent of its wave-mates — and the run **stops
before review**.

This is the fallback-carrying, single-hosted-model sibling of `agy-implement`
(which spreads spend and dispatch across several providers) and
`subagent-implement` (which keeps the main agent's context lean). It carries
its own copy of the planning, worker-contract, fallback, verification, and
state machinery so it can diverge from them freely (see
`docs/decisions/0007-opencode-implement-standalone.md`).

```
Stage 0: Plan (read-only)     parse tickets -> dependency DAG -> execution waves
   |                          estimate touch-sets + overlap flags -> test seams ->
   |                          emit the wave-table Plan (concurrency cap, retry budgets)
   | (pause: explicit approval, no source mutated)
   v
Stage 1: Execute, wave by wave, frontier order
   |  resolve the run's one model before wave 0, then pin it
   |  dispatch one opencode run worker per ticket, whole ticket, test-first —
   |    serial across a dependency edge or a serialized pair, parallel otherwise,
   |    up to the concurrency cap, the rest queued
   |  verification gate (orchestrator): reproduce red, green, typecheck, coverage
   |  automatic fallback: a native subagent for the whole ticket when opencode cannot
   |  integrate per ticket, as soon as it clears — the wave gates only the next wave
   v
Stop: handoff (integration branch, pinned model, per-path token usage, /code-review + /scrutinize)
```

## Invocation

Explicit invocation only:

- Universal / slash command: `/opencode-implement <dir|slug>`
- Codex command: `$opencode-implement <dir|slug>`

`<dir|slug>` is a `.scratch/<feature-slug>/` directory, a bare `<feature-slug>`,
or omitted. An explicit argument wins.
With no argument, the most recently modified `.scratch/*/issues/` directory is
used and named back to the user for confirmation.

Codex policy is declared in `agents/openai.yaml`
(`allow_implicit_invocation: false`). Claude Code installations rely on
`disable-model-invocation: true`. A run or a sub-command starts only on explicit
human invocation.

### Run options

Set once at invocation:

- `--model provider/model` — the `opencode` model for the whole run. **No
  skill-level default.** When omitted, the orchestrator resolves the model
  once, before wave 0, from whatever `opencode run` itself resolves (its
  config, the last model it used, or its internal default), then pins that
  captured value as an explicit `--model` flag on every worker for the rest of
  the run — including a later worker dispatched with no `--model` given at
  invocation.
- `--fallback-agent <name>` — the `subagent_type` for the fallback path.
  Default `general-purpose`.
- `--no-fallback` — suppresses the subagent fallback entirely; a ticket the
  resolved model cannot deliver becomes `BLOCKED` instead of escalating.
  `--no-fallback` remains the primary flag name; `--opencode-only` is its
  current alias, named for what it actually guarantees now that the main
  path runs on a resolved hosted model. `--strict-local` is a deprecated
  alias, kept working for one release.

Editable at Plan approval: the **concurrency cap** (default 4), and the retry
and timeout budgets `FIRST_EVENT_TIMEOUT`, `STALL_INTERVAL`, `WORKER_TIMEOUT`,
`MAX_TICKET_ATTEMPTS`, and `MAX_OPENCODE_RETRIES`. All are provisional pending
a fresh calibration probe against the resolved hosted model.

## Sub-commands

Detailed in [references/status-and-resume.md](references/status-and-resume.md).

- `/opencode-implement continue [slug]` — resume an interrupted run: reconcile
  against reality, discard any half-built worktree, rewind the integration branch
  if a committed ticket no longer verifies, then re-present the Plan and
  re-dispatch from the frontier.
- `/opencode-implement status [slug]` — the wave table, each ticket's status
  and blockers, cumulative usage per path, the pinned resolved model, and any
  worker flagged `possibly stalled`, read-only.
- `/opencode-implement list` — one line per run under `.scratch/*/status.md`,
  read-only.

## Feature-scoped storage

```
.scratch/<feature-slug>/
├── issues/            # input: tracer-bullet tickets (NN-<slug>.md), already published
├── spec.md            # input: the parent specification
├── status.md          # run state: wave table, per-ticket status, cumulative usage
├── prompts/<NN>.md    # one self-contained whole-ticket worker prompt
├── logs/<NN>.jsonl    # opencode event stream per ticket run
├── logs/<NN>.err      # opencode stderr per ticket run
└── worktrees/<NN>/    # one git worktree + worker branch per ticket (gitignored)
```

## Stage 0 — Plan (read-only)

Follow [references/planning.md](references/planning.md). In short:

1. **Resolve the target** and load every ticket, the parent `spec.md`, the
   feature `CONTEXT.md` / `adr/`, and the repo's own decisions.
2. **Parse** every ticket in the `to-tickets` local format.
3. **Build and validate the dependency DAG** — acyclic, every blocker resolvable,
   numbering consistent with a topological order. A cycle, a missing blocker, or
   inconsistent numbering **halts the run before any other work**
   (`BLOCKED (TICKET_SET_CYCLIC / TICKET_SET_MISSING_BLOCKER / TICKET_SET_NUMBERING)`),
   naming the specific broken ticket.
4. **Compute execution waves** — wave 0 is every ticket with no blockers; wave
   K is every ticket whose blockers all landed in an earlier wave. Two tickets
   in the same wave with no blocking edge between them are independent
   candidates for running at the same time.
5. **Estimate each ticket's touch-set** as an advisory hint, and raise a
   `likely-overlapping — consider serializing` flag on an independent
   same-wave pair whose estimated touch-sets intersect or either of which
   touches a cross-cutting file (router, DI container, root schema,
   migrations, `package.json`/lockfiles, CI config, shared config). The
   integration gate, not this heuristic, is the correctness guarantee.
6. **Select a test seam per ticket** from the parent spec's Testing Decisions
   where they constrain it, otherwise the narrowest public boundary that
   exercises the ticket's acceptance criteria. A ticket no isolated test can
   exercise returns to planning rather than shipping without a test.
7. **Emit the Plan** — the wave table plus, per ticket: its blockers,
   estimated touch-set, serial/parallel proposal with overlap flags, test
   seam, and retry budgets (`MAX_TICKET_ATTEMPTS`, `MAX_OPENCODE_RETRIES`);
   and the editable run parameters, including the **concurrency cap** (default
   4). There is no model column — one resolved model, captured once before
   wave 0 and pinned for the rest of the run, serves every worker. Pause for
   explicit approval, and mutate no file outside `.scratch/<feature-slug>/`
   until the user approves.

## Stage 1 — Execute (wave by wave, frontier order)

Once the Plan is approved, work each wave in frontier order. Serial tickets
(a dependency edge, or a flagged pair the user chose to serialize) reuse one
worktree slot at a time, in ticket-number order; a wave approved for parallel
execution dispatches one background worker per independent ticket at once, up
to the **concurrency cap**, with the rest queued.

### Preflight (once)

- The target repo has no uncommitted changes — a dirty tree stops the run and
  asks; the run stashes nothing.
- Create or switch to the integration branch `opencode-implement/<feature-slug>`,
  cut from the current `HEAD`.
- Add `.scratch/<feature-slug>/worktrees/` to `.gitignore`.
- Confirm `opencode` is on `PATH` and `opencode models` lists the resolved,
  pinned model.

### Resolve and pin the run's model

Before wave 0, resolve the run's model exactly once — the user's `--model`
value, or whatever `opencode run` itself resolves when none is given — record
it in the Plan and `status.md`, and pin it: every worker for the rest of the
run, in every later wave, is dispatched with that same captured value as an
explicit `--model` flag. See
[references/worker-contract.md](references/worker-contract.md).

### Dispatch the ticket, whole, in one worker call

Follow [references/worktree-integration.md](references/worktree-integration.md)
for the worktree and the serial/parallel dispatch within a wave,
[references/worker-contract.md](references/worker-contract.md) for the
`opencode run` invocation and the event-stream parse, and
[references/prompt-scaffold.md](references/prompt-scaffold.md) for the prompt.

Cut the ticket's worktree `.scratch/<slug>/worktrees/<NN>` and worker branch
`opencode-implement/<slug>/<NN>` from integration `HEAD`. Write the
self-contained whole-ticket prompt to `.scratch/<slug>/prompts/<NN>.md`, and
dispatch one `opencode run` worker for the whole ticket, test-first — no
per-criterion chain, no sub-step dispatch.

An `opencode`-process failure (crash, timeout, stall kill, or malformed
envelope) re-dispatches a fresh worker on the same pinned model, from the same
clean prompt, up to `MAX_OPENCODE_RETRIES = 3`.

### Verification gate (orchestrator, per ticket)

After the worker's single whole-ticket dispatch returns, the orchestrator —
not the worker — runs the gate in the worktree, per
[references/worktree-integration.md](references/worktree-integration.md):

1. The worker's return is well-formed.
2. **Reproduce the whole ticket's red state** — on a scratch checkout at the
   pre-ticket integration `HEAD`, apply only the ticket's test files, run them,
   confirm they fail for missing behaviour, not a compile error.
3. Every acceptance criterion maps to a new, non-vacuous test.
4. **Green** — the new/changed tests pass; the typecheck passes.

A verification failure **resumes the same `opencode` session** with the
specific failure as the next turn, up to `MAX_TICKET_ATTEMPTS = 3`. Exhausting
that escalates the ticket to the fallback, or `BLOCKED
(TICKET_VERIFICATION_FAILED)` under `--no-fallback` / `--opencode-only`.

### Automatic fallback to a native subagent

Follow [references/fallback.md](references/fallback.md). When the resolved
model cannot deliver a ticket — the verification gate failed
`MAX_TICKET_ATTEMPTS` times, `opencode` failed past `MAX_OPENCODE_RETRIES`
fresh re-dispatches, or (rarely, and only discovered at runtime) the ticket is
genuinely too large even for the resolved model's window
(`TICKET_TOO_LARGE_FOR_CONTEXT`) — the orchestrator discards the ticket's
partial worktree and worker branch and dispatches **one native subagent**
(Agent tool, `subagent_type` = the `--fallback-agent` value, `isolation:
"worktree"`) for the whole ticket from clean integration `HEAD`, then runs the
same verification gate. **No approval pause.** The fallback spends Claude
tokens and sends the ticket's code context off the machine, so it is predicted
in the Plan and named in the handoff. `--no-fallback` (alias `--opencode-only`;
`--strict-local` is a deprecated alias) suppresses it and `BLOCKED`s the
ticket instead.
`BLOCKED (TICKET_VERIFICATION_FAILED)` now means the fallback subagent also
failed its full attempt budget.

### Integration (orchestrator, per ticket, not gated on the whole wave)

Squash-merge the verified worker branch onto `opencode-implement/<feature-slug>`
as exactly one commit in ascending ticket-number order, ticking the ticket file's
checkboxes and setting its `Status:`, **as soon as that ticket clears** —
independent of whether its wave-mates are done. A mechanical conflict the
orchestrator resolves; a design-encoding conflict halts with
`BLOCKED (INTEGRATION_DESIGN_CONFLICT)` and is surfaced. Run the full typecheck
and suite on the integrated result, then `git worktree remove` and advance.

A ticket that escalates to fallback integrates the same way once
fallback-verified, cut from whatever `HEAD` exists by then — it does not hold
up its wave-mates' integration. The wave boundary gates only the **next**
wave's start: the run does not begin wave K+1 until every ticket in wave K has
reached a terminal state (integrated or `BLOCKED`).

## State, failure, and resume

Follow [references/status-and-resume.md](references/status-and-resume.md). Run
state lives in `.scratch/<feature-slug>/status.md` — the wave table, each
ticket's `{status, session_id, attempts, opencode_retries, worker_branch,
commit, usage}`, the integration branch ref, the pinned resolved model, and
cumulative usage split by path (`tokens.main`, `tokens.fallback`) — updated as
each ticket transitions.

A `BLOCKED` ticket halts only its own dependency branch: everything that
already passed is integrated, and the run stops at the next frontier with a
report naming the blocked tickets, their reasons, the downstream tickets not
started, the independent tickets/waves that could still run as an available
partial path, and the `/opencode-implement continue` command.

`/opencode-implement continue` reconciles `status.md` against reality first —
git refs, worker branches, worktrees, and each committed ticket's acceptance
checks — discards any half-built worker branch and worktree and re-dispatches
that ticket from clean, and, when a committed ticket no longer verifies,
rewinds the integration branch to the last still-verifying commit and lists
the discarded commits before re-dispatching. `status` and `list` are
read-only.

## Stop — Handoff

When every ticket is integrated and the last ticket's suite is green, print a
handoff and stop:

```text
All <N> tickets integrated onto opencode-implement/<feature-slug> — one commit
per ticket, in dependency order.

Resolved model: <provider/model>

Token usage by path:
  tokens.main      in <…>  out <…>  total <…>   (real spend against <provider/model>)
  tokens.fallback  in <…>  out <…>  total <…>
    ticket <NN>: subagent fallback — Claude tokens spent, code left the machine
    ...

Review is a separate pass. In a fresh context, from this branch:
/code-review since <merge-base with main>
/scrutinize
```

This run stops here — it runs no review, no `git push`, and opens no pull
request.

## Constraints

- The orchestrator dispatches every ticket to a worker (the main `opencode`
  path, or the fallback subagent). It writes implementation code itself only
  to resolve a purely mechanical merge conflict; a design-encoding conflict is
  surfaced, not resolved. A ticket no path can complete becomes `BLOCKED` and
  waits for a human.
- Workers and the fallback subagent commit only on their own worker branch; the
  orchestrator commits only on the integration branch. `git push`, pull requests,
  `/code-review`, `/scrutinize`, and tracker updates happen only when the user
  explicitly asks — this run does none of them.
- The run resolves and pins exactly one model before wave 0; there is no
  cross-provider failover, no model list, and no per-ticket model reasoning —
  switching models is something the user does in `opencode`, not a flag this
  skill remembers on their behalf.
- Keep `grill-to-tickets`, `agy-implement`, `subagent-implement`,
  `engineering-workflow`, every `mattpocock/skills`-sourced file, and
  `skills-lock.json` exactly as they are — this skill is standalone by design
  (see `docs/decisions/0007-opencode-implement-standalone.md`).
