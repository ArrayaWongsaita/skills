# Parallel validation / การตรวจสอบ parallel

status: not validated

This is a human-run check. The marker stays `status: not validated` until every
check below has passed and the outcome is recorded in
`docs/decisions/0020-implement-tickets-core.md`. Automated contract tests do not
perform this validation.

## Procedure

1. Create a disposable scratch repository outside the project being tested and
   initialize it with Git. Use the normal harness configuration and make the
   `implement-tickets` skill available to that harness.
2. Publish a minimal spec and two independent tickets in
   `.scratch/parallel-smoke/`, using the current valid ticket format. Give each
   ticket a different `(new)` path and no blocking edge.
3. Run `/implement-tickets --parallel .scratch/parallel-smoke/`; serial is the
   default mode, so the flag is required. Before approving the
   Plan, confirm it places both tickets in the same two-wide wave. If it does
   not, stop and record the failed observation in the ADR.
4. Approve the Plan. Observe both background workers start while the main
   session remains available. Record evidence that both sessions were active
   at the same time.
5. While both disposable workers are active, issue `TaskStop` for exactly one
   worker. Confirm that the selected worker stops and the sibling remains
   unaffected. If the run needs a clean completion after this interruption,
   repeat it from a fresh scratch repository; do not infer the stop behavior
   from a completed session.
6. In a scratch-only worker step, use the harness's normal permission mechanism
   to trigger a harmless approval prompt. Confirm that permission prompts are
   presented to the main session. Do not approve access outside the disposable
   repository.
   If no prompt can be raised or its destination is unclear, record that check
   as unverified rather than marking the run successful.
7. Record the date, harness setup, and observed result for each check in the
   **Parallel validation record** section of
   `docs/decisions/0020-implement-tickets-core.md`. Mark the result PASS only
   when the two-wide wave, background execution, single-worker `TaskStop`, and
   main-session permission routing are all confirmed. Record failures or
   unverified checks without claiming readiness; the marker remains
   `status: not validated`.
8. After a successful run is recorded, change this file's marker to
   `status: validated YYYY-MM-DD`, using the run date. The wave script reads
   this line and sets `parallelValidated` in its JSON output; while the marker
   is not validated, the Plan in parallel mode prints `parallel not yet validated`.
