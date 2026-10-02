# Verification contract

A fresh verifier checks a returned worker only when the ticket is risky. It is
never the orchestrator and never the worker session.

## Risk

A ticket is risky when it is marked `Risk: high`, or when its worker's return
shows a risk signal:

- a counted retry
- any measured touch-set extras, accepted ones included
- an unknown touch set
- incomplete evidence

A `Risk: low` field, or a missing field, never lowers a signal.

Evidence is incomplete when the Red output, Green output, or Test → criterion
table is missing, empty, or lacks a command or exit code; when the Green output
lacks the typecheck result or `none configured`; when the red run failed for a
compile or import error; or when the green or typecheck run did not pass.
Incomplete evidence counts no attempt; it only sends the ticket to a verifier.
If that evidence then fails the ticket, the counted-failure path applies.

## Ticket with no verifier

A ticket with no risk gets no verifier. The orchestrator judges it from the
worker's Red output, Green output, Test → criterion table, Files changed list,
and the measured extras: every acceptance criterion appears in the table, the
red run failed for missing behavior, and the green and typecheck runs passed.
A failed check is incomplete evidence. Record the ticket `Verifier: skipped`.

## Verifier

Dispatch a fresh verifier as soon as the decision is made:

```
Agent(
  subagent_type: Explore,
  description:   "verify ticket <NN> <slug>",
  prompt:        <ticket acceptance criteria, worker report, changed test files,
                  pre-ticket integration SHA, worker branch, measured extras>,
)
```

If the `Explore` report is too shallow to judge, dispatch a fresh
`general-purpose` verifier with explicit read-only instructions. A verifier
edits no file, creates no commit, and returns raw evidence with no verdict:

1. In a scratch checkout at the pre-ticket integration SHA, apply only the
   worker's test files and run them; record whether they fail for the missing
   behavior rather than a compile or import error.
2. On the worker branch, run the ticket's new or changed tests, the project's
   configured typecheck, and the full test suite; record each command and
   output, or that no typecheck is configured.
3. Summarize the test diff: changed test files, case count, and the acceptance
   criteria each case exercises.

The orchestrator judges the evidence: every criterion has coverage, the red run
failed for missing behavior, and the green, typecheck, and suite runs passed. A
verifier crash, a lost subagent, or a missing report is `failed_infra`.

## Attempts

A ticket that fails verification or the integration gate gets a fresh worker
dispatch from the latest integration commit, with the failure in the prompt.
Each such dispatch counts one attempt. After three failed attempts the ticket is
`BLOCKED (TICKET_VERIFICATION_FAILED)`.
