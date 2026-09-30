---
name: implement-tickets
description: Plan and implement a grill-to-tickets feature directory with native subagents, deterministic dependency and touch-set waves, explicit approval before execution, verification, and a handoff before review.
disable-model-invocation: true
---

# Implement Tickets

Turn a published `.scratch/<feature-slug>/issues/` ticket set into working
code. The orchestrator reads and plans the whole set, then dispatches one
worker per ticket to build test-first. The default backend is native harness
subagents; each ticket runs in a deterministic wave after its blockers and
touch-set conflicts are handled. A fresh verifier checks each worker's
evidence, and the orchestrator integrates verified work behind a gate.

## Invocation

This skill starts only on explicit invocation:

- Slash command: `/implement-tickets <dir|slug>`
- Codex command: `$implement-tickets <dir|slug>`

The directory may be the feature root, its `issues/` directory, or a bare
feature slug under `.scratch/`. Claude Code invocation is disabled by
`disable-model-invocation: true`; Codex invocation is disabled implicitly in
`agents/openai.yaml`. Do not start this workflow from an inferred request.

Options are set once for the run:

- `--with <backend>` selects an adapter skill; without it, use native harness
  subagents.
- `--agent <name>` pins the native worker agent for the run.
- `--model <id>` passes a model value to the selected backend.
- `--concurrency N` sets the shared worker and verifier cap; default `4`.
- `--serial` puts one ticket in each wave.

## Stage 0 — Plan, then pause

Follow [references/planning.md](references/planning.md). Resolve and read the
feature's tickets and planning context, validate the dependency order, and run
`scripts/waves.mjs` on the feature's `issues/` directory. The script reads each
ticket's `Blocked by` and `Context` fields and returns blockers, touch sets,
warnings, waves, concurrency, and the parallel-validation state.

Present a Plan that lists every ticket with its wave, blockers, touch set, test
seam, matched agent, and retry budget. The Plan also names the backend, the
concurrency cap, and every warning. When the marker is not validated, print the
standalone line `parallel not yet validated`.

Pause for explicit approval. No file outside the feature directory changes
until approval. Do not dispatch workers or write run state before approval.

## Stage 1 — Execute approved waves

After approval, follow [references/dispatch-contract.md](references/dispatch-contract.md),
[references/prompt-scaffold.md](references/prompt-scaffold.md), and
[references/verification.md](references/verification.md). Run waves in order.
Tickets in one wave have satisfied blockers and non-overlapping known touch
sets. A ticket with an unknown touch set runs alone. `--serial` is the
one-ticket-per-wave mode; `--concurrency N` sets the in-flight cap but does not
change computed waves.

Every worker prompt starts with a sync command that checks out its worker
branch at the wave's integration SHA and asserts that `HEAD` equals that SHA.
A mismatch returns `failed_infra` without spending a ticket attempt. Workers
and verifiers run in the background. The default cap is four active workers
and verifiers combined; pending verifiers start before new workers. As soon as
a worker returns, start its fresh native `Explore` verifier without waiting
for the rest of the wave. If the report is too shallow to judge, dispatch a
fresh read-only `general-purpose` verifier. Verifiers return raw evidence and
no verdict; the orchestrator judges the reports and integrates verified work
in ticket order.

Arm one background wait per dispatch: 2700 seconds for a worker and 900 seconds
for a verifier. If a wait ends first, stop that subagent with `TaskStop` and
record `failed_infra`, without counting an attempt. A crash or lost subagent is
also `failed_infra`. Allow two infrastructure retries per ticket; after two
infra retries, mark it `BLOCKED (TICKET_PROVIDER_FAILED)`. A harness rejection
with `Concurrent subagent limit reached` waits for a free slot and retries the
spawn without using an infra retry.

Stop before review, push, or a pull request; hand off the integration branch
and review commands for a later pass.

## Constraints

- Treat malformed tickets, unresolved blockers, cycles, and invalid numbering
  as planning errors. Do not dispatch from an invalid ticket set.
- Keep a worker inside its declared touch set. An unknown touch set is a
  warning and receives an exclusive wave.
- Keep the Plan read-only until the user explicitly approves it.
- The orchestrator writes no implementation code except a mechanical merge
  conflict resolution.
