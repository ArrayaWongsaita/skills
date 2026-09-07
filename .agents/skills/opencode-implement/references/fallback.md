# Automatic native-subagent fallback

A ticket the local model cannot deliver escalates to one native harness subagent
for the **whole ticket**. Escalation is automatic and unattended — no approval
pause (adr/0007). Suppressed by `--no-fallback` / `--strict-local`.

## Triggers

1. **`TICKET_TOO_LARGE_FOR_CONTEXT`** — a single acceptance-criterion sub-step
   cannot be split fine enough to get under the context budget, at planning or at
   runtime (see [decomposition.md](decomposition.md)).
2. **Verification budget exhausted** — the ticket failed the verification gate
   `MAX_TICKET_ATTEMPTS = 3` times on the local model.
3. **`opencode` failures exhausted** — `opencode` failed (error event, non-zero
   exit, missing envelope, first-event / stall / overall timeout kill) past
   `MAX_OPENCODE_RETRIES = 3` re-dispatches.

An `opencode` hiccup *within* the retry budget is retried locally, not escalated.

Under `--no-fallback` these instead produce
`BLOCKED (TICKET_TOO_LARGE_FOR_CONTEXT)` / `BLOCKED (TICKET_VERIFICATION_FAILED)`.

## Dispatch

Discard the ticket's partial local worktree and delete its worker branch, then
cut a fresh worker branch `opencode-implement/<slug>/<NN>` from the current
integration `HEAD` — the subagent does the whole ticket from clean, with no
half-built state to reverse-engineer.

```
Agent(
  subagent_type: <--fallback-agent value, default "general-purpose">,
  description:   "fallback: implement ticket <NN> <slug>",
  prompt:        <the whole-ticket test-first prompt>,
  isolation:     "worktree",
)
```

- `subagent_type` is the `--fallback-agent` value (default `general-purpose`;
  fall back to `claude` if `general-purpose` is not among the environment's
  types). Never `fork` — a fork would inherit the orchestrator's context.
- The prompt is the [prompt-scaffold.md](prompt-scaffold.md) template for the
  **whole ticket**: all acceptance criteria, no progress note, no "sub-step of
  M". A subagent has a large context window, so there is no decomposition.
- The worker branch is cut from integration `HEAD` and the subagent commits on
  it, the same as a local worker branch.

## Verification and budget

The fallback result runs through the **same orchestrator-run verification gate**
as a local worker (see [worktree-integration.md](worktree-integration.md)) — the
orchestrator is the verification authority (adr/0002); there is no verifier
subagent.

- A verification failure resumes the same subagent:
  `SendMessage({ to: <subagent id/name>, message: "<the specific failure>" })`,
  up to `MAX_TICKET_ATTEMPTS = 3` for the fallback attempt.
- A subagent crash or lost session re-dispatches a fresh subagent against the
  same worker branch and counts as one attempt.
- The **third** fallback verification failure yields
  `BLOCKED (TICKET_VERIFICATION_FAILED)` — this is now the only way a ticket
  reaches that state with the fallback on.

## Cost and privacy — recorded and disclosed

The fallback spends Claude tokens and sends the ticket's prompt and code context
to a hosted model — both breaks from the skill's local / zero-cost / private
purpose (adr/0003). So:

- **Plan** — the ticket is marked `subagent-fallback (predicted)`; approving the
  Plan authorizes any escalation.
- **`status.md`** — every actual escalation is recorded with its trigger and its
  token usage under `tokens.fallback`.
- **Handoff** — each ticket that took the fallback is named in the completion
  handoff: "ticket `<NN>`: subagent fallback — Claude tokens spent, code left the
  machine".

## Points to confirm on first real use

| assumption | how to confirm |
|---|---|
| a non-fork subagent dispatched in the background re-invokes the orchestrator on completion | dispatch one trivial fallback, observe the re-invocation |
| `isolation: "worktree"` keeps a worktree with commits, recoverable by the orchestrator | dispatch a subagent that commits, then locate the worktree and branch |
| `SendMessage` resumes a backgrounded subagent with its context intact | resume one with a follow-up, confirm it still has the ticket context |
| the subagent result carries token usage | inspect one completed result; roll it into `status.md` `tokens.fallback` |
