---
name: agy-implement
description: Turn a directory of grill-to-tickets tickets into working code by planning execution waves, dispatching one headless agy worker per ticket across several LLM providers, forcing test-first implementation, verifying every result, integrating one commit per ticket onto a branch, and stopping before review.
disable-model-invocation: true
---

# Agy Implement

Take a directory of `grill-to-tickets` tracer-bullet tickets and drive it to
working code. The main agent — the **orchestrator** — reads the ticket set and
its parent `spec.md`, plans the order of work as dependency **waves**, then
dispatches one headless `agy` **worker** per ticket. Workers build each ticket
test-first; the orchestrator verifies every result itself, assembles the verified
work onto one **integration branch** as one commit per ticket, and stops before
review.

This skill is the multi-provider, parallelizing alternative to the single-context
`/implement` line in the `grill-to-tickets` handoff. It carries its own copy of
the planning, worktree, verification, and TDD machinery so a future
`qwen-implement` or `codex-implement` sibling can diverge from it freely.

```
Stage 0: Plan (read-only)     parse tickets -> dependency DAG -> waves
   |                          estimate touch-sets, pick test seams, emit the Plan
   | (pause: explicit approval, no source mutated)
   v
Stage 1: Execute, wave by wave
   |  dispatch one agy worker per ticket (serial in-tree, parallel in worktrees)
   |  orchestrator verification gate per ticket (reproduce red, green, typecheck)
   |  integration gate per wave (squash-merge in ticket order, full suite)
   v
Stop: handoff message (integration branch, per-provider usage, /code-review + /scrutinize)
```

## Invocation

Explicit invocation only:

- Universal / slash command: `/agy-implement <dir|slug>`
- Codex command: `$agy-implement <dir|slug>`

`<dir|slug>` is a `.scratch/<feature-slug>/` directory, a bare `<feature-slug>`,
or omitted. An explicit directory or slug wins. With no argument, the most
recently modified `.scratch/*/issues/` directory is selected and named back to
the user for confirmation before planning.

Codex policy is declared in `agents/openai.yaml`
(`allow_implicit_invocation: false`). Claude Code installations rely on
`disable-model-invocation: true`. Require explicit human invocation before
starting a run or a sub-command.

## Sub-commands

- `/agy-implement continue [slug]` — resume an interrupted run. Re-checks reality
  against git and the tickets' acceptance state, rewinds the integration branch
  to the last still-good commit when a committed ticket no longer verifies, then
  re-presents the Plan and re-dispatches from the frontier.
- `/agy-implement status [slug]` — report the wave table, each ticket's status,
  and any blockers, read-only.
- `/agy-implement list` — list runs discovered under `.scratch/*/status.md`,
  read-only.

Each sub-command's full behavior is specified alongside the stage it belongs to.

## Feature-scoped storage

Every run artifact lives under the ticket directory's feature slug.

```
.scratch/<feature-slug>/
├── issues/            # input: tracer-bullet tickets (NN-<slug>.md), already published
├── spec.md            # input: the parent specification
├── status.md          # run state: wave table, per-ticket status, cumulative usage
├── prompts/<NN>.md     # one self-contained worker prompt per ticket
├── logs/<NN>.json      # one agy result envelope per worker run
└── worktrees/<NN>/     # one git worktree + worker branch per ticket (gitignored)
```

## Stage 0 — Plan (read-only)

Parse the ticket set into a dependency DAG, compute execution waves, estimate
each ticket's touch-set, select a test seam per ticket, and emit the **Plan**.
Pause for explicit approval; mutate no file outside `.scratch/<feature-slug>/`
before the user approves.

## Stage 1 — Execute (per wave, frontier order)

For each wave, dispatch one `agy` worker per ticket, run the orchestrator's
verification gate on every result, and run the per-wave integration gate. The
orchestrator dispatches every ticket and owns verification, skill routing, and
merge-conflict resolution; it writes code itself only to resolve a purely
mechanical merge conflict. A ticket that no worker can finish within its retry
budget becomes `BLOCKED` and waits for a human.

## Stop — Handoff

When every ticket is done, print the integration branch name, one-commit-per-ticket
confirmation, cumulative per-provider token usage, and the exact `/code-review`
and `/scrutinize` commands to run next in a fresh context. This skill hands off
here — review, `git push`, and pull requests stay the user's explicit decision.

## Constraints

- Keep `grill-to-tickets`, `engineering-workflow`, every `mattpocock/skills`-sourced
  file, and `skills-lock.json` exactly as they are — this skill is standalone by
  design (see `docs/decisions/0004-agy-implement-standalone.md`).
- Workers commit only on their own worker branch; the orchestrator commits only on
  the integration branch. Publishing — `git push`, pull requests, tracker
  mutations — happens only when the user explicitly asks.
- The orchestrator dispatches every ticket to a worker and writes implementation
  code itself only to resolve a mechanical merge conflict.
