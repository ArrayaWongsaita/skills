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
- `--parallel` opts in to parallel mode: waves built from blockers and touch
  sets. Without it the run is serial and each ticket has its own wave.
- `--concurrency N` sets the shared worker and verifier cap in parallel mode
  and implies `--parallel`; the cap is `4` by default.
- `--serial` is an alias of the default serial mode. Combining `--serial` with
  `--parallel` or `--concurrency` is rejected before the Plan is presented.

Pass `--serial` to `scripts/waves.mjs` unless parallel mode is selected.

Before presenting any Plan, run
[`scripts/preflight.mjs`](scripts/preflight.mjs) for every backend, including
native. It requires a Git repository with a clean working tree. If preflight
fails, stop before presenting the Plan and report the error.
Pass the run's `--with`, `--agent`, and `--model` options to preflight so it
selects the requested adapter and rejects `--agent` combined with `--with`.

When `--with <name>` is supplied, preflight also searches the project agent-skill
directory, project Claude-skill directory, user agent-skill directory, and user
Claude-skill directory in that order. The selected adapter
name is the Plan's backend. If the adapter is missing, stop before presenting
the Plan and print the install line from the `implement-tickets` lock entry,
checking the project lock before the user lock. If neither has the entry, print the
`<source of implement-tickets>` placeholder and tell the person to use the
source that installed the core. Pass `--model` to the adapter as its raw value.

The adapter input, resume, failover, worktree ownership, and envelope are
defined in [references/adapter-contract.md](references/adapter-contract.md).
The core creates each adapter worker branch and worktree under the feature's
`worktrees/` directory, passes the worktree path to the adapter, and removes the
worktree after integration. Native runs keep harness-managed isolation.

Existing runs can be inspected or resumed with:

- `/implement-tickets status [slug]` to read one run's `status.md`;
- `/implement-tickets list` to list saved runs; or
- `/implement-tickets continue [slug]` to reconcile a run with Git, re-present
  its Plan, and resume from the frontier in the recorded run mode. When only
  extras were accepted, it resumes without a new approval.

`status` and `list` are read-only. A valid run record starts with
`skill: implement-tickets`; see
[references/status-and-resume.md](references/status-and-resume.md).

## Stage 0 — Plan, then pause

Follow [references/planning.md](references/planning.md). Resolve and read the
feature's tickets and planning context, validate the dependency order, and run
`scripts/waves.mjs` on the feature's `issues/` directory. The script reads each
ticket's `Blocked by` and `Context` fields and returns blockers, touch sets,
warnings, waves, concurrency, and the parallel-validation state.

Present a Plan that lists every ticket with its wave, blockers, touch set, test
seam, matched agent, and retry budget. The Plan also names the backend, the run
mode, and every warning. In parallel mode it names the concurrency cap, and when
the marker is not validated it prints the standalone line
`parallel not yet validated`. In serial mode it shows no concurrency cap and
omits that line.

Pause for explicit approval. The approval covers the run mode, waves,
blockers, ticket set, budget, backend, and concurrency. No file outside the feature directory changes
until approval. Do not dispatch workers or write run state before approval.

## Stage 1 — Execute approved waves

After approval, execute the approved waves using the
[dispatch contract](references/dispatch-contract.md),
[worker prompt scaffold](references/prompt-scaffold.md),
[verification contract](references/verification.md),
[integration gate](references/integration-gate.md), and
[run status and resume contract](references/status-and-resume.md). Follow the
[parallel validation procedure](references/parallel-validation.md) when that
marker applies. These references own worker synchronization, dispatch and
verification mechanics, recovery, and run-state details.

When all tickets are integrated and the gate passes, hand off the integration
branch and review commands. Stop before review, push, or a pull request.

## Constraints

- Treat malformed tickets, unresolved blockers, cycles, and invalid numbering
  as planning errors. Do not dispatch from an invalid ticket set.
- The declared touch set is a planning baseline, not an approval boundary.
  Extras are measured and accepted: an extra file that is not on the
  deny-list, is within the cap, and conflicts with no sibling ticket is
  accepted without asking, and the ticket integrates. An unknown touch set is
  a warning and receives an exclusive wave.
- Plan approval covers the run mode, waves, blockers, ticket set, budget,
  backend, and concurrency. A change to any of them asks for approval before
  continuing; accepted extras alone never do.
- Keep the Plan read-only until the user explicitly approves it.
- The orchestrator writes no implementation code except a mechanical merge
  conflict resolution. That allowance stays for conflicts outside drift; for a
  drift conflict, deferral takes precedence and the ticket goes to a drain round
  (see the [integration gate](references/integration-gate.md)).
