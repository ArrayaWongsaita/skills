# State, failure, and resume

## Failure and partial delivery

A ticket becomes `BLOCKED` when:

- its final path exhausts `MAX_TICKET_ATTEMPTS = 3` verification failures
  (`TICKET_VERIFICATION_FAILED` — the fallback subagent's own budget with the
  fallback tier on; the main `opencode` path's budget directly under
  `--opencode-only` / `--no-fallback`);
- the ticket is genuinely too large even for the resolved model's context
  window and `--opencode-only` / `--no-fallback` is set
  (`TICKET_TOO_LARGE_FOR_CONTEXT` — a rare runtime edge case, not a
  planning-time prediction, now that there is no context-budget estimate at
  Stage 0);
- its integration conflict encodes a design decision
  (`INTEGRATION_DESIGN_CONFLICT`).

These are unchanged in kind from before this feature — only the mechanism that
feeds them (whole-ticket dispatch, waves, per-ticket integration) is new.

A `BLOCKED` ticket **halts only its own dependency branch**:

1. Every other ticket already in flight — in the blocked ticket's wave or an
   earlier one — is allowed to finish, be verified, and integrate. Because
   integration is **per-ticket, not gated on the whole wave** (Tickets
   03–04), nothing about a blocked ticket holds up a wave-mate that already
   cleared verification: **everything that passed is integrated**, exactly
   the same precedent this skill applies when nothing is blocked.
2. The run then stops at the **next frontier** — it starts no wave, and no
   ticket within a partially-started wave, that is transitively blocked by
   the `BLOCKED` one.
3. **Independent later waves** — and independent tickets within a
   partially-blocked wave — with no dependency on the blocked ticket are
   reported as an **available partial path**, not started automatically. The
   orchestrator names them in the halt report but waits for `continue` rather
   than dispatching them on its own.

### Halt report

Print:

- each `BLOCKED` ticket, its `BLOCKED (...)` reason, and its recorded failure
  output
- the downstream tickets that are therefore not started (transitively
  blocked)
- the independent tickets/waves that could still run — the available partial
  path
- the resume command: `/opencode-implement continue <feature-slug>`

## Run state — `.scratch/<feature-slug>/status.md`

One markdown file, updated as each ticket transitions (dispatched → verifying
→ verified → integrated, or → fallback → verifying → verified → integrated,
or → `BLOCKED`). It holds:

- the **wave table**: each wave, its tickets, and each ticket's serial /
  parallel disposition — carried over from the Plan and updated as
  dispositions are confirmed or adjusted at approval
- the **pinned resolved model** name — resolved exactly once, before wave 0,
  and from that point on passed as an explicit `--model` flag to every worker
  for the rest of the run (see [worker-contract.md](worker-contract.md))
- per ticket: `status`, `session_id` (the current or most recent `opencode`
  session while on the main path, or the fallback subagent's id once
  escalated — `sessionID`s are recorded either way, for debugging),
  `attempts` (verification-failure retries against whichever path currently
  holds the ticket), `opencode_retries` (`opencode`-process-failure retries
  on the main path), `worker_branch`, `commit`, and `usage` (that ticket's
  token usage on whichever path built it)
- the **integration branch ref** (name and current commit)
- **cumulative usage split by path** — `tokens.main` (the `opencode` path,
  real spend against the resolved model) and `tokens.fallback` (the native
  subagent path, Claude tokens) — replacing the old per-sub-step `{path,
  sub_step, session_ids[], subagent_id, tokens: {local, fallback}}` shape,
  since a worker now builds the whole ticket in one dispatch rather than a
  chain of sub-steps, and the main path spends real money instead of running
  at `cost: 0`

There is no per-turn state-header block. `status.md` is the whole record; a
crash or a closed session loses nothing.

## `/opencode-implement status [slug]` and `/opencode-implement list`

Both are **read-only** — they parse `status.md` (and, for `list`, every
`.scratch/*/status.md`) and report, mutating nothing.

- `status [slug]` — the wave table, each ticket's status and blockers,
  cumulative usage per path (`tokens.main`, `tokens.fallback`), the pinned
  resolved model, and any worker flagged `possibly stalled`.
- `list` — unchanged: one line per discovered run — slug, integration branch,
  tickets done / total, and whether it is running, blocked, or complete.

## `/opencode-implement continue [slug]` — resume with reality reconciliation

Before trusting `status.md`, reconcile it against reality — the same
mechanism as before this feature, restated against the wave / per-ticket-
integration model:

1. **Git refs.** Confirm the integration branch exists and its commit matches
   `status.md`. Confirm each recorded worker branch and worktree still
   exists.
2. **Mid-run tickets.** For any ticket `status.md` records as mid-run
   (dispatched, verifying, or escalating into the fallback tier — anything
   short of integrated or `BLOCKED`), discard its worker branch and worktree
   — a killed `opencode` worker or a lost fallback subagent can leave the
   worktree in an odd git state — and re-dispatch that ticket from clean
   integration `HEAD`.
3. **Integrated tickets.** For each ticket `status.md` records as integrated,
   re-run its verification (reproduce red where a worktree still exists,
   re-run the tests green, typecheck) — this is per ticket, following
   Tickets 03–04's per-ticket integration, not a single check for the whole
   wave.
4. **Rewind on drift.** When a committed ticket no longer verifies — the user
   hand-edited the tree, or a later change broke it:
   - reset the integration branch to the **last still-verifying commit**
   - discard the worktrees for the invalidated tickets
   - list the **discarded commits** at the top of the report, so the blast
     radius is visible
   - re-dispatch from that point

Then re-present the Plan (reconciled against current reality, including the
wave table and the pinned resolved model) and resume execution from the
frontier.
