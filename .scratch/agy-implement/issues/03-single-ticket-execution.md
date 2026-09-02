# 03: Single-ticket execution — dispatch, verify, commit

**What to build:** With an approved Plan, `/agy-implement` takes one ticket, dispatches
an `agy` worker against an isolated worktree with a self-contained test-first prompt,
then the orchestrator verifies the result itself — reproducing the failing test,
re-running it green, typechecking, and checking test quality — retries with feedback up
to three times, and on success squash-merges the worker's branch into the integration
branch as exactly one commit that also ticks the ticket's checkboxes. A ticket set with a
single ticket runs end to end.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `references/agy-contract.md` documents the `agy` invocation (`-p`, `--add-dir`,
      `--output-format json`, `--print-timeout`, `--disable-slash-commands`, permission
      mode) and the result envelope, with the failure/timeout `status` tokens marked
      provisional pending validation probe 1
- [ ] `references/prompt-scaffold.md` defines the per-ticket worker prompt: working
      directory; verbatim "What to build" and acceptance criteria; relevant parent-spec
      sections / ADRs / glossary; the assigned test seam; the full red-green-refactor
      protocol inline; the constraints (touch only what's needed; commit on the worker
      branch but never push or open a PR; no package installs; no repo scan; stop and
      report a missing decision); and the required structured return (red output, green
      output, changed files, test→criterion table)
- [ ] `references/worktree-integration.md` (serial portion) specifies one worktree +
      worker branch per ticket cut from integration HEAD, dependency reuse by symlink,
      the ban on worker package installs, and the squash-merge to one commit in
      ticket-number order that ticks checkboxes and sets `Status:`
- [ ] SKILL.md Stage 1 serial path and Verification gate sections drive the above
- [ ] The verification gate reproduces the red state on a scratch checkout with only the
      ticket's test files applied; a test that passes without the implementation, only
      fails to compile, is vacuous/tautological, or leaves an acceptance criterion
      uncovered is a verification failure
- [ ] A verification failure resumes the same worker via `--conversation` with the
      specific failure; the third failure yields `BLOCKED (TICKET_VERIFICATION_FAILED)`
      with the output recorded and the worktree kept
- [ ] Provider/infra failure triggers Failover to the next model (or same default) under
      a separate budget, not counted against the verification attempts
- [ ] The orchestrator never writes ticket implementation code itself
- [ ] `evals/evals.json` cases: verification-failure ×3 → BLOCKED; vacuous-test
      rejection; fabricated / not-actually-red rejection; failover-does-not-consume-
      verification-budget; orchestrator-never-implements
