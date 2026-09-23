# Automatic native-subagent fallback

Any single resolved model — however capable — has a **capability ceiling**. A
third failed attempt on that model is a signal to try a **structurally
different executor** — not a fourth attempt on the same one: a ticket the
resolved model cannot deliver escalates to one native harness subagent (a
structurally different executor, with a different context and toolset) for the
**whole ticket**. Escalation is automatic and unattended — no approval pause.
Suppressed by `--no-fallback` (alias `--opencode-only`; `--strict-local` is a
deprecated alias for one release, see below).

## Triggers

1. **`TICKET_TOO_LARGE_FOR_CONTEXT`** — the ticket is genuinely too large even
   for the resolved model's context window. With no planning-time
   context-budget estimate to predict this in advance, it now surfaces only at
   runtime, and is a **rare edge case** rather than the common case it once
   was.
2. **Verification budget exhausted** — the ticket failed the verification gate
   `MAX_TICKET_ATTEMPTS = 3` times on the main `opencode` path.
3. **`opencode` failures exhausted** — `opencode` failed (error event, non-zero
   exit, missing envelope, first-event / stall / overall timeout kill) past
   `MAX_OPENCODE_RETRIES = 3` fresh re-dispatches on the same pinned model (see
   Rule 2 in [worker-contract.md](worker-contract.md)).

An `opencode` hiccup *within* the retry budget is retried locally, not escalated
(see [worker-contract.md](worker-contract.md)).

Under `--no-fallback` / `--opencode-only` these instead produce
`BLOCKED (TICKET_TOO_LARGE_FOR_CONTEXT)` / `BLOCKED (TICKET_VERIFICATION_FAILED)`.

## Dispatch

Discard the ticket's partial worktree and delete its worker branch, then cut a
fresh worker branch `opencode-implement/<slug>/<NN>` from the **current**
integration `HEAD` (per [worktree-integration.md](worktree-integration.md),
this may already include former wave-mates' work) — the subagent does the
whole ticket from clean, with no half-built state to reverse-engineer.

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
  M". A subagent has a different context and toolset from the resolved model,
  so there is no decomposition.
- Because it is the same template, the fallback subagent receives the ticket's
  Reuse line, the read-only Reuse Catalog line, and — for a verb other than
  `use` — the spec's Reuse Plan exactly as the main-path worker did; nothing
  about reuse changes on escalation.
- The worker branch is cut from integration `HEAD` and the subagent commits on
  it, the same as a main-path worker branch.

## Verification and budget

The fallback result runs through the **same orchestrator-run verification gate**
as a main-path worker (see [worktree-integration.md](worktree-integration.md))
— the orchestrator is the verification authority; there is no verifier
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

The main `opencode` path now spends real money too (`tokens.main`, see
[worker-contract.md](worker-contract.md)) — cost disclosure is no longer
asymmetric between the two paths. The fallback path remains distinct in kind:
it spends Claude tokens **and** sends the ticket's prompt and code context to a
hosted subagent, so it is the only path whose spend leaves the machine. So:

- **Plan** — the ticket is marked `subagent-fallback (predicted)`; approving the
  Plan authorizes any escalation.
- **`status.md`** — every actual escalation is recorded with its trigger and its
  token usage under `tokens.fallback`, alongside the main path's cumulative
  `tokens.main`.
- **Handoff** — each ticket that took the fallback is named in the completion
  handoff: "ticket `<NN>`: subagent fallback — Claude tokens spent, code left the
  machine".

## Suppression flag — `--opencode-only` (alias), `--strict-local` (deprecated)

`--no-fallback` remains the primary flag name, unchanged. `--opencode-only` is
its current alias: the guarantee it names — stay inside `opencode`, spend no
Claude tokens, send no code off the machine via fallback — no longer has
anything to do with "local" now that the main path runs on a resolved hosted
model, so the alias is named for what it actually guarantees. `--strict-local`
is kept working as a **deprecated alias** for one release rather than removed
outright.

## Points to confirm on first real use

| assumption | how to confirm |
|---|---|
| a non-fork subagent dispatched in the background re-invokes the orchestrator on completion | dispatch one trivial fallback, observe the re-invocation |
| `isolation: "worktree"` keeps a worktree with commits, recoverable by the orchestrator | dispatch a subagent that commits, then locate the worktree and branch |
| `SendMessage` resumes a backgrounded subagent with its context intact | resume one with a follow-up, confirm it still has the ticket context |
| the subagent result carries token usage | inspect one completed result; roll it into `status.md` `tokens.fallback` |
