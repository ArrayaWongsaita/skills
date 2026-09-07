# 06: Failure, partial delivery, state, and resume

**What to build:** When a ticket becomes `BLOCKED`, the run halts only that ticket's
dependency branch — everything that passed is integrated, and the run stops at the next
frontier and reports which tickets are blocked, why, which downstream tickets are
therefore not started, and which independent tickets could still run. All run state is
persisted so a crashed or closed session resumes with `/opencode-implement continue`,
which re-checks reality against git and the tickets' acceptance state, discards any
half-built worktree for a ticket that was mid-run, and rewinds the integration branch to
the last still-good commit if a *committed* ticket no longer verifies. `status` and
`list` report progress without mutating anything.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] `references/status-and-resume.md` specifies `.scratch/<feature-slug>/status.md`:
      the dependency-ordered ticket table; per ticket `{status, path, sub_step,
      session_ids, subagent_id, attempts, opencode_retries, worker_branch, commit,
      tokens:{local,fallback}}`; the integration branch ref; cumulative per-path token
      usage — updated as each ticket transitions; no per-turn state-header block
- [ ] A `BLOCKED` ticket halts only its dependency branch: passing work stays
      integrated, tickets transitively blocked are held, the run stops at the next
      frontier; the halt report names the blocked tickets + their `BLOCKED (...)` reason,
      the downstream tickets not started, the independent tickets that could still run,
      and the `/opencode-implement continue <slug>` command
- [ ] `references/status-and-resume.md` specifies `continue`'s Reality reconciliation:
      confirm the integration branch and its commit, each recorded worker branch and
      worktree; discard the worker branch + worktree of any ticket recorded mid-run and
      re-dispatch it from clean; for each ticket recorded `integrated`, re-run its
      verification, and on drift reset the integration branch to the last still-verifying
      commit, discard the invalidated worktrees, list every discarded commit at the top
      of the report, and re-dispatch from that point; then re-present the Plan
- [ ] `/opencode-implement status [slug]` and `/opencode-implement list` are read-only —
      they parse `status.md` (and every `.scratch/*/status.md` for `list`) and mutate
      nothing
- [ ] SKILL.md "State, failure, and resume" and "Sub-commands" sections drive the above
- [ ] `evals/evals.json` cases: blocked ticket halts only its branch, independent tickets
      reported as an available partial path; `status.md` schema updated as tickets
      transition; resume after a crash mid-run — half-built worktree discarded and the
      ticket re-dispatched; resume after drift — integration branch rewound to the last
      still-good commit with discarded commits listed; `status` / `list` mutate nothing
- [ ] `npm run validate` and `npm test` pass
