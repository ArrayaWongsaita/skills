# Worker verification contract

The verifier is a fresh native subagent for each returned worker. It is never
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
