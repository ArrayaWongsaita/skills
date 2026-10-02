# Worker verification contract

The verifier is a fresh native subagent for each returned worker that
[risk-based verification](#risk-based-verification) sends to one: every worker
in a strict run, and risky tickets otherwise. It is never
the orchestrator and never the worker session. Dispatch it as soon as a worker
returns, without waiting for the rest of the wave. A verifier has the ticket's
acceptance criteria, the worker report, its changed test-file list, the
pre-ticket integration SHA, and the worker branch.

Start with the `Explore` subagent:

```
Agent(
  subagent_type: Explore,
  description:   "verify ticket <NN> <slug>",
  prompt:        <verification request with ticket inputs and evidence rules>,
  run_in_background: true,
)
```

If the first `Explore` report is too shallow to judge the evidence, the
orchestrator dispatches a new `general-purpose` verifier with explicit
read-only instructions. The replacement is a fresh subagent; it must not edit
files, create commits, or decide whether to accept the ticket.

The verifier returns raw evidence and no verdict:

1. In a scratch checkout at the pre-ticket integration SHA, apply only the
   worker's test files and run them. Record whether they fail for the missing
   behavior rather than a compile or import error.
2. Check out the worker branch and run the ticket's new or changed tests, the
   project's configured typecheck, and the full test suite. Record each command
   and its output. If no typecheck is configured, record that fact.
3. Summarize the test diff: changed test files, number of cases, and the
   acceptance criteria each case exercises.
4. Return the red output, green output, typecheck result, suite result, and
   diff summary as evidence only. Include no pass/fail verdict or recommendation.

The orchestrator reads the evidence and makes the judgment. It checks that every
acceptance criterion has test coverage, the red run failed for missing behavior,
and the green, typecheck, and suite runs passed.

Verifiers run in the background under the same worker-and-verifier concurrency
cap. Arm one background wait per verifier dispatch for 900 seconds (15 minutes).
If the verifier returns first, collect its evidence and cancel or ignore its
wait. If the wait ends first, stop the verifier with `TaskStop` and record
`failed_infra`; do not count a ticket attempt. A verifier crash or lost
subagent is the same infrastructure failure and is retried under the ticket's
infrastructure retry limit in
[dispatch-contract.md](dispatch-contract.md).

## Touch-set extras before verification

The orchestrator measures the touch-set extras before the verifier is
dispatched, as defined in
[dispatch-contract.md](dispatch-contract.md#measuring-touch-set-extras). The
verifier receives that measured list with the worker report and treats the
worker's own list as advisory.

## Approved parked branch

When the person approves a ticket parked as `BLOCKED (TOUCH_SET_APPROVAL)`, its
branch was never verified. Dispatch a fresh verifier on that branch, with the
approved extras in the measured list, before the ticket merges in a release
pass. A rejected ticket gets a fresh worker dispatch instead and is verified as
usual.

## Risk-based verification

Whether a returned worker gets a fresh verifier depends on strictness. The
decision is made after the touch-set extras are measured and before a verifier
would be dispatched. A run without `--strict` is in default strictness.

- A strict run verifies every ticket, including one marked `Risk: low`, with a
  fresh verifier before it is integrated.
- In default strictness a ticket is verified only when it is risky: it is
  marked `Risk: high`, or it shows a risk signal when its worker returns. A
  risky ticket gets a fresh verifier before it is integrated.
- A ticket with no `Risk: high`, no risk signal, and complete evidence is not
  verified. The orchestrator judges it from the worker's Red output, Green
  output, Test → criterion table, Files changed list, and the measured extras.
  It checks that each acceptance criterion appears in the table, the red run
  failed for missing behavior, and the green and typecheck runs passed, then
  integrates it. No verifier is dispatched. A failed check is incomplete
  evidence.

Risk signals, each of which makes the ticket risky:

- a counted retry
- any measured touch-set extras, including ones that are accepted
- an unknown touch set
- incomplete evidence
- the rerun of a ticket deferred to a drain round by a real merge conflict

A `Risk: low` field, or a missing field, never lowers a risk signal.

Evidence is incomplete when the Red output, Green output, or Test → criterion
table is missing, empty, or lacks a command or exit code, when the red run
failed for a compile or import error, or when the green or typecheck run did
not pass. Incomplete evidence counts no attempt; it only gives the ticket a
fresh verifier, in either strictness. When that verifier's evidence fails the
ticket, the existing counted-failure path applies unchanged.

A deny-list or cap hit still parks the ticket before this decision, and its
branch is verified on approval, as described below.
