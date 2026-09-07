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
or omitted. An explicit argument wins. With no argument, the most recently
modified `.scratch/*/issues/` directory is used and named back to the user for
confirmation.

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
