# State, failure, and resume

## Failure and partial delivery

A ticket becomes `BLOCKED` when it fails the orchestrator's judgment
`MAX_TICKET_ATTEMPTS = 3` times (`TICKET_VERIFICATION_FAILED`) or its integration
conflict encodes a design decision.

A `BLOCKED` ticket **halts only its own dependency branch**:

1. The ticket currently in flight finishes and is judged; anything already
   verified stays integrated.
2. The run then stops at the **next frontier** — it starts no ticket that is
   transitively blocked by the `BLOCKED` one.
3. Tickets with no dependency on the blocked one are reported as an available
   partial path, not started automatically.

### Halt report

Print:

- each `BLOCKED` ticket, its status token, and its recorded failure reason
- the downstream tickets that are therefore not started
- the independent tickets that could still run
- the resume command: `/subagent-implement continue <feature-slug>`

## Run state — `.scratch/<feature-slug>/status.md`

One markdown file, updated as each ticket transitions (dispatched → returned →
verifying → verified → integrated, or → BLOCKED). It holds:

- the **ticket table**: every ticket in dependency order, its blockers, and its
  current status
- per ticket: `status`, `subagent_id`, `agent_type`, `model`, `attempts`,
  `worker_branch`, `commit`
- the **integration branch ref** (name and current commit)

There is no per-provider usage roll-up — there is no external provider. There is
no per-turn state-header block; `status.md` is the whole record, and a crash or a
closed session loses nothing. If a worker's final report turns out to carry token
usage, a cumulative total may be recorded as a bonus, but it gates nothing.

## `/subagent-implement status [slug]` and `/subagent-implement list`

Both are **read-only** — they parse `status.md` (and, for `list`, every
`.scratch/*/status.md`) and report, mutating nothing.

- `status [slug]` — the ticket table, each ticket's status and blockers, and any
  worker that has been running without a result for an unusually long time.
- `list` — one line per discovered run: slug, integration branch, tickets
  done / total, and whether it is running, blocked, or complete.

## `/subagent-implement continue [slug]` — resume with Reality reconciliation

Before trusting `status.md`, reconcile it against reality:

1. **Git refs.** Confirm the integration branch exists and its commit matches
   `status.md`. Confirm each recorded worker branch still exists.
2. **Acceptance checks.** For each ticket `status.md` records as integrated,
   dispatch a fresh verifier to re-run its tests green and the typecheck. Where
   the worker branch still exists, also reproduce red.
3. **Rewind on drift.** When a committed ticket no longer verifies — the user
   hand-edited the tree, or a later change broke it:
   - reset the integration branch to the last still-good commit (the last commit
     whose ticket still verifies)
   - discard the worktrees for the invalidated tickets
   - list the **discarded commits** at the top of the report, so the blast
     radius is visible
   - re-dispatch from that point

Then re-present the Plan (reconciled against current reality) and resume
execution from the frontier.
