# 05: State, resume, and cost/model disclosure

**What to build:** `status.md` adopts `agy-implement`'s wave-table shape,
tracks `tokens: {main, fallback}` in place of `tokens: {local, fallback}`
(the main path now spends real money), and records the pinned resolved model.
`continue`'s reality-reconciliation logic carries over unchanged in mechanism,
restated against the wave / per-ticket-integration model from Tickets 01–04.

**Blocked by:** 01, 02, 03, 04

**Status:** ready-for-agent

- [ ] `references/status-and-resume.md` specifies `status.md` holding: the
      **wave table** (each wave, its tickets, each ticket's serial/parallel
      disposition); the **pinned resolved model** name; per ticket `{status,
      session_id, attempts, opencode_retries, worker_branch, commit, usage}`;
      the integration branch ref; and **cumulative usage split by path** —
      `tokens.main` and `tokens.fallback` — replacing the old per-sub-step
      `{path, sub_step, session_ids[], subagent_id, tokens:{local,fallback}}`
      shape
- [ ] `references/status-and-resume.md` specifies `BLOCKED` conditions
      unchanged in kind (`TICKET_VERIFICATION_FAILED`,
      `TICKET_TOO_LARGE_FOR_CONTEXT`, `INTEGRATION_DESIGN_CONFLICT`) and that
      a `BLOCKED` ticket halts only its own dependency branch — everything
      that already passed is integrated (per Ticket 03's per-ticket
      integration, not held for the whole wave) and independent later waves
      with no dependency on the blocked ticket are reported as an available
      partial path, not started automatically
- [ ] `references/status-and-resume.md` specifies the halt report naming each
      `BLOCKED` ticket, its reason, the downstream tickets therefore not
      started, the independent tickets/waves that could still run, and the
      `/opencode-implement continue <slug>` resume command
- [ ] `references/status-and-resume.md` specifies `/opencode-implement status
      [slug]` reporting the wave table, each ticket's status and blockers,
      cumulative usage per path, the pinned model, and any possibly-stalled
      worker — read-only; `/opencode-implement list` unchanged (one line per
      run: slug, integration branch, tickets done/total, running/blocked/
      complete)
- [ ] `references/status-and-resume.md` specifies `/opencode-implement
      continue`'s reconciliation unchanged in mechanism: confirm git refs and
      that each recorded worker branch/worktree exists; discard and
      re-dispatch from clean `HEAD` any ticket `status.md` records as
      mid-run; re-verify each ticket recorded as integrated; on drift (a
      committed ticket no longer verifies), reset the integration branch to
      the last still-verifying commit, discard invalidated worktrees, list
      the discarded commits at the top of the report, and re-dispatch from
      that point; then re-present the Plan and resume from the frontier
- [ ] `evals/evals.json`: `tokens.main` accumulates across main-path tickets
      and is shown in `status.md`/Plan/handoff alongside `tokens.fallback`;
      the pinned resolved model is recorded in `status.md`; resume after a
      crash mid-run still reconciles and rewinds on drift, restated against
      the new per-ticket-integration/wave-table shape
- [ ] `npm run validate` and `npm test` pass
