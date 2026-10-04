---
name: implement-tickets
description: Plan and implement a grill-to-tickets feature directory serially with native subagents, risk-based verification, and a handoff before review.
disable-model-invocation: true
---

# Implement Tickets

Turn a published `.scratch/<feature-slug>/issues/` ticket set into working
code. The orchestrator reads and plans the whole set, then takes the tickets in
ascending number, one at a time: a worker builds the ticket test-first in an
isolated worktree, a fresh verifier checks the risky ones, and the verified work
is squash-merged onto `implement-tickets/<slug>` behind a green gate.

## Invocation

This skill starts only on explicit invocation:

- Slash command: `/implement-tickets <dir|slug>`
- Codex command: `$implement-tickets <dir|slug>`
- Resume: `/implement-tickets continue [slug]`

The directory may be the feature root, its `issues/` directory, or a bare
feature slug under `.scratch/`. Only an explicit request starts a run.

Before presenting the Plan, require a Git repository with a clean working
tree: `git status --porcelain --untracked-files=all` prints nothing. On failure,
stop and report why.

## Stage 0 — Plan

Follow [references/planning.md](references/planning.md): read the tickets,
validate them with `scripts/plan.mjs`, and print the Plan. The run starts right
after the Plan is printed.

A malformed ticket, unresolved blocker, cycle, or invalid numbering is a
planning error: stop before any dispatch.

## Stage 1 — Build each ticket

For each ticket in order, until every ticket is integrated:

1. Dispatch a worker with the [dispatch contract](references/dispatch-contract.md)
   and [prompt scaffold](references/prompt-scaffold.md).
2. Measure the extras and decide on a verifier with the
   [verification contract](references/verification.md).
3. Squash-merge and run the gate with the
   [integration gate](references/integration-gate.md).
4. Record the ticket in `status.md`, and any problem in `report.md`, per
   [status and resume](references/status-and-resume.md).
5. Clean up the ticket's Worker worktrees and branches with
   [Cleanup](references/integration-gate.md#cleanup), then start the next ticket.

A ticket that exhausts its attempts is `BLOCKED`; it and its dependants wait for
`continue`, and independent tickets keep going.

Orchestrator code is limited to mechanical merge-conflict resolution; the
worker writes the implementation.

## Handoff

When all tickets are integrated and the gate is green, print the handoff from
the [integration gate](references/integration-gate.md#handoff). Stop before
review, push, or a pull request.
