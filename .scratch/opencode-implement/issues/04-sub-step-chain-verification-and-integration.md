# 04: The sub-step chain, the verification gate, and integration

**What to build:** With an approved Plan, `/opencode-implement` takes one ticket, runs
its whole step plan as an ordered chain of `opencode` sub-step workers against one
worktree (progress note + checkpoint check between sub-steps, runtime re-split of a
sub-step that overflows), then the orchestrator verifies the finished ticket itself —
reproducing the whole ticket's red state, re-running the new tests green, typechecking,
and checking coverage and vacuity — retries the failing sub-step with feedback up to
`MAX_TICKET_ATTEMPTS`, and on success squash-merges the worker branch onto the
integration branch as exactly one commit that also ticks the ticket's checkboxes. A
single-ticket set (one or several criteria) runs end to end.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] `references/decomposition.md` specifies running the step plan: for each sub-step in
      order, write `prompts/<NN>/<K>.md`, dispatch a fresh `opencode` worker, have the
      worker commit on the worker branch `opencode-implement/<slug>/<NN>`, run the
      **checkpoint check** (worktree still typechecks; the criterion test just written is
      red / just implemented is green, per the step plan), and write the next progress
      note; a sub-step that overflows at runtime (checkpoint fail, truncated edits,
      ignored late instructions) is re-split and the re-split recorded in `status.md`
- [ ] `references/worktree-integration.md` specifies one worktree +
      `opencode-implement/<slug>/<NN>` worker branch per ticket cut from integration
      `HEAD`, installed-dependency reuse by symlink, the ban on worker package installs,
      and the squash-merge onto `opencode-implement/<feature-slug>` as one commit in
      ascending ticket-number order that ticks the ticket file's checkboxes and sets
      `Status:`; a mechanical conflict is resolved by the orchestrator, a design-encoding
      conflict halts with `BLOCKED (INTEGRATION_DESIGN_CONFLICT)` and is surfaced; the
      full typecheck + suite runs on the integrated result before advancing; the
      worktree is removed
- [ ] SKILL.md Stage 1 "Local path", "Verification gate", and "Integration" sections
      drive the above
- [ ] The verification gate (orchestrator, in the worktree) reproduces the whole
      ticket's red state on a scratch checkout at the pre-ticket integration `HEAD` with
      only the ticket's test files applied; a test that passes without the
      implementation, only fails to compile, is vacuous/tautological, or leaves an
      acceptance criterion uncovered is a verification failure
- [ ] A verification failure re-dispatches the failing sub-step (fresh `opencode`
      session + a progress note naming the specific failure); `MAX_TICKET_ATTEMPTS = 3`
- [ ] The orchestrator never writes ticket implementation code itself (adr/0002); it
      resolves only mechanical merge conflicts
- [ ] `evals/evals.json` cases: one-criterion ticket end to end; multi-criterion chain
      with progress-note carry-over (never `opencode -s` resume); checkpoint check per
      sub-step + full gate at ticket completion; runtime re-split recorded, ticket not
      failed for the estimate; fabricated / not-actually-red test → verification failure;
      vacuous test → verification failure; missing test→criterion coverage → verification
      failure; design-encoding conflict → surfaced, not resolved
- [ ] `npm run validate` and `npm test` pass
