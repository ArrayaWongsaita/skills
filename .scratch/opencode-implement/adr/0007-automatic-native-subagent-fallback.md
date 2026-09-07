# A ticket the local model cannot deliver escalates automatically to a native subagent

The local model has a capability ceiling and a habit of hanging. Rather than let the run
stall on `BLOCKED` every time it hits one, `opencode-implement` escalates that ticket to
a **native subagent fallback**: one native harness subagent (Agent tool,
`isolation: "worktree"`, default agent `general-purpose`, overridable with
`--fallback-agent`), given the same self-contained test-first prompt and verified by the
same orchestrator-run verification gate.

**Escalation is automatic and unattended — no approval pause.** The user's Round 3
decision: call the subagent directly, only for the cases where `opencode` hit a problem
or could not implement. Triggers:

1. A single acceptance-criterion sub-step cannot be split fine enough to fit the context
   budget (`TICKET_TOO_LARGE_FOR_CONTEXT` — adr/0006).
2. The ticket failed the verification gate `MAX_TICKET_ATTEMPTS` (3) times on the local
   model.
3. An `opencode` worker failure (error event, non-zero exit, missing envelope,
   first-event / stall / overall timeout kill) that persisted past `MAX_OPENCODE_RETRIES`
   (3) re-dispatches. The budget is 3 because probing hit several very-long / wedged runs
   whose retries or twins completed normally; probe C sets the final number from the
   observed finish rate.

An `opencode` infra hiccup inside the retry budget is just retried locally — it does not
escalate. `BLOCKED` now has one remaining meaning for a ticket: the **fallback subagent**
also failed verification its full budget of attempts.

## The fallback breaks two of the skill's promises for one ticket — deliberately, and visibly

The skill's purpose (adr/0003) is local, **zero-cost**, and **private** implementation.
The fallback path spends Claude tokens *and* sends that ticket's prompt and code context
to a hosted model. Both breaks are:

- **Opt-out-able.** `--no-fallback` (alias `--strict-local`) suppresses the fallback
  entirely: triggers 1 and 2 produce `BLOCKED (TICKET_TOO_LARGE_FOR_CONTEXT)` /
  `BLOCKED (TICKET_VERIFICATION_FAILED)` as they would without this ADR. It exists for a
  run that must not spend a Claude token or send code off the machine.
- **Predicted before the run.** The Plan marks each ticket `local` or
  `subagent-fallback (predicted)` and pauses for approval; approving authorizes any
  escalation.
- **Disclosed after the fact.** Every actual escalation is recorded in `status.md` and
  called out in the completion handoff — by ticket, naming that it spent Claude tokens
  and left the machine.

## This does not repeat the mistake repo ADR 0005 rejected

Repo ADR 0005 rejected adding a native-subagent *mode* to `agy-implement`, because a
co-equal second mode would have split the skill's reason-for-being in two. Here the
subagent path is a **strictly-worse safety valve**: the skill still *is* local
implementation, the fallback fires only when the local path provably cannot, and both
paths share one control plane — the same planning, criterion-level decomposition,
verification gate, and integration. Only the final dispatch call differs, and only for a
ticket the local model already failed.

Rejected: `BLOCKED` on every local ceiling (the run stalls constantly on a weak model).
Rejected: fallback off by default behind a flag (the user wants it to just work; the
Plan prediction and handoff disclosure cover the visibility concern). Rejected: a
verifier subagent in the fallback path too (adr/0002 — the orchestrator is the
verification authority). Rejected: escalate only the failed sub-step (the subagent does
the whole ticket from clean integration `HEAD` — a subagent picking up a half-built
worktree has to reverse-engineer the partial state; a clean start is simpler and the
subagent has the context budget for the whole ticket).
