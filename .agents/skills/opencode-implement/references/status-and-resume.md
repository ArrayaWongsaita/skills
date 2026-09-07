# State, failure, and resume

## Failure and partial delivery

A ticket becomes `BLOCKED` when:

- its final path exhausts `MAX_TICKET_ATTEMPTS = 3` verification failures
  (`TICKET_VERIFICATION_FAILED` — the fallback subagent with the fallback on, the
  local path under `--no-fallback`);
- a criterion cannot be split fine enough and `--no-fallback` is set
  (`TICKET_TOO_LARGE_FOR_CONTEXT`);
- its integration conflict encodes a design decision
  (`INTEGRATION_DESIGN_CONFLICT`).

A `BLOCKED` ticket **halts only its own dependency branch**:

1. The ticket currently in flight finishes and is verified; anything already
   integrated stays integrated.
2. The run then stops at the **next frontier** — it starts no ticket that is
   transitively blocked by the `BLOCKED` one.
3. Tickets with no dependency on the blocked one are reported as an available
   partial path, not started automatically.

### Halt report

Print:

- each `BLOCKED` ticket, its `BLOCKED (...)` reason, and its recorded failure output
- the downstream tickets that are therefore not started
- the independent tickets that could still run
- the resume command: `/opencode-implement continue <feature-slug>`

## Run state — `.scratch/<feature-slug>/status.md`

One markdown file, updated as each ticket transitions (dispatched → sub-step K →
verifying → verified → integrated, or → fallback, or → BLOCKED). It holds:

- the **ticket table**: every ticket in dependency order, its blockers, its
  predicted and actual `path`, and its current status
- per ticket: `status`, `path`, `sub_step` (the current sub-step and any runtime
  re-splits), `session_ids` (every `opencode` session, for debugging),
  `subagent_id` (when it took the fallback), `attempts` (verification),
  `opencode_retries`, `worker_branch`, `commit`, and `tokens: {local, fallback}`
- the **integration branch ref** (name and current commit)
- **cumulative per-path token totals** — local (`cost: 0`) and fallback (Claude
  tokens)

There is no per-turn state-header block; `status.md` is the whole record, and a
crash or a closed session loses nothing.

## `/opencode-implement status [slug]` and `/opencode-implement list`

Both are **read-only** — they parse `status.md` (and, for `list`, every
`.scratch/*/status.md`) and report, mutating nothing.

- `status [slug]` — the ticket table, each ticket's status, path, and blockers,
  cumulative per-path token totals, and any worker flagged `possibly stalled`.
- `list` — one line per discovered run: slug, integration branch, tickets
  done / total, and whether it is running, blocked, or complete.

## `/opencode-implement continue [slug]` — resume with Reality reconciliation

Before trusting `status.md`, reconcile it against reality:

1. **Git refs.** Confirm the integration branch exists and its commit matches
   `status.md`. Confirm each recorded worker branch and worktree still exists.
2. **Half-built tickets.** For any ticket `status.md` records as mid-run
   (dispatched, at a sub-step, verifying, or escalating), discard its worker
   branch and worktree — a killed `opencode` worker or a lost subagent can leave
   the worktree in an odd git state — and re-dispatch that ticket from clean
   integration `HEAD`.
3. **Committed tickets.** For each ticket `status.md` records as integrated,
   re-run its verification (reproduce red where a worktree still exists, re-run
   the tests green, typecheck).
4. **Rewind on drift.** When a committed ticket no longer verifies — the user
   hand-edited the tree, or a later change broke it:
   - reset the integration branch to the last still-verifying commit
   - discard the worktrees for the invalidated tickets
   - list the **discarded commits** at the top of the report, so the blast
     radius is visible
   - re-dispatch from that point

Then re-present the Plan (reconciled against current reality) and resume
execution from the frontier.
