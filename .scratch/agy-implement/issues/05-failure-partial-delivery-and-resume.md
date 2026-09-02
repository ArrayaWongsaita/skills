# 05: Failure, partial delivery, state and resume

**What to build:** When a ticket becomes BLOCKED, the run finishes the workers already in
flight, integrates everything that passed, halts at the next frontier, and reports which
tickets are blocked and which downstream tickets are therefore not started. All run state
is persisted so a crashed or closed session resumes with `/agy-implement continue`, which
re-checks reality against git and the tickets' acceptance state and rewinds the
integration branch to the last still-good commit if a committed ticket no longer
verifies. `status` and `list` report progress without mutating anything.

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] A BLOCKED ticket halts only its dependency branch: in-flight workers finish,
      passing work is integrated, the run stops at the next frontier
- [ ] The halt report names the blocked tickets, their failure reason, the downstream
      tickets not started, and the `continue` command
- [ ] `.scratch/<slug>/status.md` persists the wave table and per-ticket `{status,
      conversation_id, model, attempts, failover_attempts, worker_branch, commit,
      usage}`, the integration branch ref, and cumulative per-provider usage, updated as
      each ticket transitions
- [ ] `/agy-implement continue` performs Reality reconciliation (git refs, worktrees,
      each committed ticket's acceptance checks) and, when a committed ticket no longer
      verifies, resets the integration branch to the last still-good commit, discards the
      invalidated worktrees, lists the discarded commits at the top of the report, and
      re-dispatches from that point
- [ ] `/agy-implement status` and `/agy-implement list` are read-only
- [ ] `evals/evals.json` cases: blocked-ticket-halts-only-its-branch (independent
      in-flight waves finish and integrate); resume-after-crash rewinds to the last
      still-good commit and lists the discarded commits
