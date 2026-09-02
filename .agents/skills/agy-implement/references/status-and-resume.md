# State, failure, and resume

## Failure and partial delivery

A ticket becomes `BLOCKED` when it fails verification `MAX_TICKET_ATTEMPTS = 3`
times (`TICKET_VERIFICATION_FAILED`), exhausts `MAX_FAILOVER_ATTEMPTS = 3`
(`TICKET_PROVIDER_FAILED`), or its integration conflict encodes a design
decision.

A `BLOCKED` ticket **halts only its own dependency branch**:

1. The workers already in flight for the current wave are allowed to finish and
   be verified.
2. Everything that passed verification is integrated through the normal
   integration gate.
3. The run then stops at the **next frontier** — it starts no wave that contains
   a ticket transitively blocked by the `BLOCKED` one. Independent later waves
   with no dependency on the blocked ticket are reported as an available partial
   path but not started automatically.

### Halt report

Print:

- each `BLOCKED` ticket, its status token, and its recorded failure reason
- the downstream tickets that are therefore not started
- the independent tickets/waves that could still run
- the resume command: `/agy-implement continue <feature-slug>`

## Run state — `.scratch/<feature-slug>/status.md`

One markdown file, updated as each ticket transitions (dispatched → returned →
verifying → verified → integrated, or → BLOCKED). It holds:

- the **wave table**: each wave, its tickets, and each ticket's serial/parallel
  disposition
- per ticket: `status`, `conversation_id`, `model`, `attempts`,
  `failover_attempts`, `worker_branch`, `commit`, and `usage`
- the **integration branch ref** (name and current commit)
- **cumulative per-provider usage** — input / output / thinking / cache-read /
  total tokens summed per provider across the run

There is no per-turn state-header block. `status.md` is the whole record; a crash
or a closed session loses nothing.

## `/agy-implement status [slug]` and `/agy-implement list`

Both are **read-only** — they parse `status.md` (and, for `list`, every
`.scratch/*/status.md`) and report, mutating nothing.

- `status [slug]` — the wave table, each ticket's status and blockers, cumulative
  per-provider usage, and any possibly-stalled worker.
- `list` — one line per discovered run: slug, integration branch, tickets
  done / total, and whether it is running, blocked, or complete.

## `/agy-implement continue [slug]` — resume with Reality reconciliation

Before trusting `status.md`, reconcile it against reality:

1. **Git refs.** Confirm the integration branch exists and its commit matches
   `status.md`. Confirm each recorded worker branch and worktree still exists.
2. **Acceptance checks.** For each ticket `status.md` records as integrated,
   re-run its verification (reproduce red where the worktree still exists,
   re-run the tests green, typecheck).
3. **Rewind on drift.** When a committed ticket no longer verifies — the user
   hand-edited the tree, or a later change broke it:
   - reset the integration branch to the **last commit whose ticket still
     verifies**
   - discard the worktrees for the invalidated tickets
   - list every **discarded commit** at the top of the report, so the blast
     radius is visible
   - re-dispatch from that point

Then re-present the Plan (reconciled against current reality) and resume
execution from the frontier.
