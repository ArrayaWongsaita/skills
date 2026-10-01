# Worker dispatch contract

The orchestrator dispatches one native harness subagent as a worker for each
ready ticket. It writes that ticket's self-contained prompt to
`.scratch/<slug>/prompts/<NN>.md` before passing the prompt to the harness.
Each worker uses its own worktree and branch. The prompt supplies the integration
SHA so the worker can sync before it reads or changes ticket files.

A native worker dispatch has this shape:

```
Agent(
  subagent_type: <resolved worker agent>,
  description:   "implement ticket <NN> <slug>",
  prompt:        <contents of .scratch/<slug>/prompts/<NN>.md>,
  isolation:     "worktree",
  run_in_background: true,
  model:         <the run's --model value, only when set>,
)
```

The worker agent is selected once during planning: an explicit native
`--agent` pin wins; otherwise choose an implementation-shaped available agent,
falling back to `general-purpose`. The verifier is not selected through this
worker setting.

## Shared concurrency cap

The default in-flight cap is 4. `--concurrency N` overrides it. The orchestrator
counts workers and verifiers together against this one cap, counting only
subagents that have not returned. The wave planner only reports the selected
number; the orchestrator enforces it while scheduling.

Keep ready workers queued when the cap is full. Whenever a worker returns, put
its verifier at the front of the dispatch queue. Verifiers are started before
starting new workers. This lets verification begin while other workers in
the wave are still running. Once all returned workers have their verifiers
started, fill any remaining slots with ready workers in ticket order.

The harness may have a lower concurrent-subagent limit of its own. If a spawn
fails with the exact message `Concurrent subagent limit reached`, treat this as
a capacity wait: wait for a free slot and retry the same spawn. That wait is
not a worker or verifier failure and does not count against the two
infrastructure retries.

## Background dispatch and timeouts

Workers and verifiers are dispatched in the background so the orchestrator can
continue scheduling and can stop a child that hangs. Immediately after each
dispatch, arm one background wait per dispatch for that child:

- Worker wait: 2700 seconds (45 minutes).
- Verifier wait: 900 seconds (15 minutes).

If the child returns first, collect its completion report and cancel or ignore
its wait. If the background wait ends first, call `TaskStop` for that child and
record `failed_infra`. A timeout records `failed_infra` and does not count as a
ticket attempt.

A child crash or lost subagent is an infrastructure failure: record
`failed_infra`, keep it out of the ticket-attempt count, and retry with a fresh
child. A missing completion report is handled the same way. A worker sync
failure is also `failed_infra`.

Track infrastructure retries per ticket separately from ticket attempts.
After two infra retries, if the second retry also fails as infrastructure,
mark the ticket `BLOCKED (TICKET_PROVIDER_FAILED)`.
Infrastructure failures never use the
three-attempt ticket verification budget. Capacity waits for
`Concurrent subagent limit reached` do not count against the two infra retries
and do not increment this retry count.
