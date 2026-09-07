---
name: opencode-implement
description: Turn a directory of grill-to-tickets tickets into working code on a local, zero-cost, private model — plan the dependency order, decompose every ticket into criterion-level sub-steps that fit the model's context window, dispatch one headless `opencode run` worker per sub-step test-first, verify every result, automatically fall back to a native subagent for any ticket the local model cannot deliver, integrate one commit per ticket onto a branch, and stop before review.
disable-model-invocation: true
---

# opencode Implement

Take a directory of `grill-to-tickets` / `to-tickets` tracer-bullet tickets and
drive it to working code **on a local model, at zero API cost, without the code
leaving the machine**. The main agent — the **orchestrator** — reads the ticket
set and its parent `spec.md`, plans the dependency order, and decomposes every
ticket into an ordered chain of **sub-steps** — one acceptance criterion each by
default — sized to fit the local model's context window. It dispatches one
headless `opencode run` **worker** per sub-step, built test-first; verifies every
finished ticket itself; and, for any ticket the local model cannot deliver,
**automatically falls back** to a native harness subagent for the whole ticket.
Verified work is assembled onto one **integration branch** as one commit per
ticket, and the run **stops before review**.

This is the local-first, context-fitting sibling of `agy-implement` (which
spreads spend across hosted providers) and `subagent-implement` (which keeps the
main agent's context lean). It carries its own copy of the planning,
decomposition, worker-contract, fallback, verification, and state machinery so it
can diverge from them freely (see
`docs/decisions/0007-opencode-implement-standalone.md`).

It is a **slow background tool.** Serial local inference on a 27B model takes
minutes per sub-step, so a real feature's ticket set is an hours-long run you
start and walk away from — resumable if it is interrupted.

```
Stage 0: Plan (read-only)   parse tickets -> dependency DAG -> dependency order
   |                        build a criterion-level step plan per ticket, predict
   |                        each ticket's path, emit the Plan
   | (pause: explicit approval, no source mutated)
   v
Stage 1: Execute, one ticket at a time in dependency order
   |  local path: one opencode run worker per sub-step, test-first, progress note
   |              + checkpoint check between sub-steps
   |  verification gate (orchestrator): reproduce red, green, typecheck, coverage
   |  automatic fallback: a native subagent for the whole ticket when local cannot
   |  integrate: squash-merge one commit per ticket, full suite
   v
Stop: handoff (integration branch, per-path usage, /code-review + /scrutinize)
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

- `--model provider/model` — the `opencode` model for every worker. Default
  `ollama/qwen3.8:27b-mlx-32k`. Any `opencode` provider works; this is a manual
  override, not a routing strategy — there is no model list and no cross-provider
  failover.
- `--fallback-agent <name>` — the `subagent_type` for the fallback path. Default
  `general-purpose`.
- `--no-fallback` (alias `--strict-local`) — suppress the subagent fallback
  entirely, so the run spends zero Claude tokens and no code leaves the machine.
  A ticket the local model cannot deliver becomes `BLOCKED` instead of escalating.

Editable run parameters shown at Plan approval: `FIRST_EVENT_TIMEOUT`,
`STALL_INTERVAL`, `WORKER_TIMEOUT`, `MAX_TICKET_ATTEMPTS`, `MAX_OPENCODE_RETRIES`,
and the context budget. Their defaults are provisional pending a local-latency
calibration probe.

## Sub-commands

- `/opencode-implement continue [slug]` — resume an interrupted run: reconcile
  against reality, discard any half-built worktree, rewind the integration branch
  if a committed ticket no longer verifies, then re-present the Plan and
  re-dispatch from the frontier.
- `/opencode-implement status [slug]` — the ticket table, per-ticket status and
  path, and blockers, read-only.
- `/opencode-implement list` — one line per run under `.scratch/*/status.md`,
  read-only.

## Feature-scoped storage

```
.scratch/<feature-slug>/
├── issues/               # input: tracer-bullet tickets (NN-<slug>.md), already published
├── spec.md               # input: the parent specification
├── status.md             # run state: ticket table, per-ticket status, integration ref
├── prompts/<NN>/<K>.md   # one self-contained sub-step prompt (with progress note)
├── logs/<NN>-<K>.jsonl   # opencode event stream per sub-step run
├── logs/<NN>-<K>.err     # opencode stderr per sub-step run
└── worktrees/<NN>/       # one git worktree per ticket (gitignored), created one at a time
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
4. **Compute the dependency order** — ascending ticket number where the numbering
   is valid — and the frontier. No waves (adr/0005).
5. **Select a test seam per ticket** from the parent spec's Testing Decisions
   where they constrain it, otherwise the narrowest public boundary that
   exercises the ticket's acceptance criteria. A ticket no isolated test can
   exercise returns to planning rather than shipping without a test.
6. **Build a criterion-level step plan** for every ticket — an ordered chain of
   sub-steps, one acceptance criterion each by default, split finer (by file or
   layer) where a single criterion is estimated over the context budget, biased
   toward over-splitting. Record each sub-step's file scope.
7. **Predict each ticket's path** — `local`, or `subagent-fallback` where a
   criterion cannot be split fine enough to fit (flagged for
   `BLOCKED (TICKET_TOO_LARGE_FOR_CONTEXT)` under `--no-fallback`).
8. **Emit the Plan** — the dependency-ordered ticket table plus, per ticket: its
   blockers, test seam, step plan (the ordered sub-steps and their file scopes),
   predicted path, and retry budgets; and the editable run parameters. Pause for
   explicit approval, and mutate no file outside `.scratch/<feature-slug>/` until
   the user approves.

## Stage 1 — Execute (serial, dependency order)

Once the Plan is approved, work each ticket in dependency order, one at a time.
No parallelism — one local model instance serializes inference regardless
(adr/0005).

### Preflight (once)

- The target repo has no uncommitted changes — a dirty tree stops the run and
  asks; the run stashes nothing.
- Create or switch to the integration branch `opencode-implement/<feature-slug>`,
  cut from the current `HEAD`.
- Add `.scratch/<feature-slug>/worktrees/` to `.gitignore`.
- Confirm `opencode` is on `PATH`, `opencode models` lists the run's model, and
  Ollama is reachable.
- **Smoke test** — one trivial `opencode run` with nothing else using the local
  model, per [references/worker-contract.md](references/worker-contract.md). A
  slow, stuck, or failed smoke test stops the run before a multi-hour attempt.

### Run the ticket's step plan

Follow [references/worktree-integration.md](references/worktree-integration.md)
for the worktree, [references/decomposition.md](references/decomposition.md) for
the sub-step loop, [references/worker-contract.md](references/worker-contract.md)
for the `opencode run` invocation and the event-stream parse, and
[references/prompt-scaffold.md](references/prompt-scaffold.md) for the prompt.

Cut the ticket's worktree `.scratch/<slug>/worktrees/<NN>` and worker branch
`opencode-implement/<slug>/<NN>` from integration `HEAD`. Then, for each sub-step
in the step plan, in order: write the self-contained prompt (including the
**progress note**) to `.scratch/<slug>/prompts/<NN>/<K>.md`, dispatch one
background `opencode run` worker, have the worker commit on the worker branch, run
the **checkpoint check**, and write the next progress note. A sub-step that
overflows at runtime is **re-split** and the re-split recorded in `status.md`.

An `opencode` failure re-dispatches a fresh worker with a progress note, up to
`MAX_OPENCODE_RETRIES = 3`. A checkpoint failure re-dispatches the sub-step, up to
`MAX_TICKET_ATTEMPTS = 3`.

### Verification gate (orchestrator, per ticket)

After the ticket's whole chain passes its checkpoints, the orchestrator — not a
worker — runs the gate in the worktree, per
[references/worktree-integration.md](references/worktree-integration.md):

1. Every sub-step's return is well-formed.
2. **Reproduce the whole ticket's red state** — on a scratch checkout at the
   pre-ticket integration `HEAD`, apply only the ticket's test files, run them,
   confirm they fail for missing behaviour, not a compile error.
3. Every acceptance criterion maps to a new, non-vacuous test.
4. **Green** — the new/changed tests pass; the typecheck passes.

Any failure re-dispatches the failing sub-step with the specific failure, up to
`MAX_TICKET_ATTEMPTS = 3`. Exhausting that escalates the ticket to the fallback,
or `BLOCKED (TICKET_VERIFICATION_FAILED)` under `--no-fallback`.

### Automatic fallback to a native subagent

Follow [references/fallback.md](references/fallback.md). When the local path
cannot deliver a ticket — a criterion that cannot be split fine enough
(`TICKET_TOO_LARGE_FOR_CONTEXT`), the verification gate failed
`MAX_TICKET_ATTEMPTS` times, or `opencode` failed past `MAX_OPENCODE_RETRIES` —
the orchestrator discards the ticket's partial worktree and worker branch and
dispatches **one native subagent** (Agent tool, `subagent_type` = the
`--fallback-agent` value, `isolation: "worktree"`) for the whole ticket from
clean integration `HEAD`, then runs the same verification gate. **No approval
pause.** The fallback spends Claude tokens and sends the ticket off the machine,
so it is predicted in the Plan and named in the handoff. `--no-fallback` /
`--strict-local` suppresses it and `BLOCKED`s the ticket instead.
`BLOCKED (TICKET_VERIFICATION_FAILED)` now means the fallback subagent also
failed its full attempt budget.

### Integration (orchestrator, per ticket)

Squash-merge the verified worker branch onto `opencode-implement/<feature-slug>`
as exactly one commit in ascending ticket-number order, ticking the ticket file's
checkboxes and setting its `Status:`. A mechanical conflict the orchestrator
resolves; a design-encoding conflict halts with
`BLOCKED (INTEGRATION_DESIGN_CONFLICT)` and is surfaced. Run the full typecheck
and suite on the integrated result, then `git worktree remove` and advance.

## Constraints

- The orchestrator dispatches every ticket to a worker (local sub-steps, or the
  fallback subagent). It writes implementation code itself only to resolve a
  purely mechanical merge conflict; a design-encoding conflict is surfaced, not
  resolved. A ticket no path can complete becomes `BLOCKED` and waits for a human.
- Workers and the fallback subagent commit only on their own worker branch; the
  orchestrator commits only on the integration branch. `git push`, pull requests,
  `/code-review`, `/scrutinize`, and tracker updates happen only when the user
  explicitly asks — this run does none of them.
- Execution is serial and parallelism is a non-goal — one local model instance
  serializes inference regardless. If a run needs parallelism, that means a
  hosted provider; use `agy-implement`.
- Keep `grill-to-tickets`, `agy-implement`, `subagent-implement`,
  `engineering-workflow`, every `mattpocock/skills`-sourced file, and
  `skills-lock.json` exactly as they are — this skill is standalone by design.
