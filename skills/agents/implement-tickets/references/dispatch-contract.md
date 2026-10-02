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

## Measuring touch-set extras

The orchestrator computes extras right after a worker returns and before
verification (the decision to verify, see
[risk-based verification](verification.md#risk-based-verification), comes after), so later steps act on a trusted list. An extra is a changed file
outside the ticket's declared touch set. Take the changed files from the worker
branch itself:

```
git diff --name-only --no-renames <pre-ticket-integration-sha> <worker-branch>
```

`--no-renames` makes a rename or deletion count as its old and new paths.
Subtract the declared touch set; what remains is the ticket's extras.

- When the worker omits a changed file from its report, that file is still an
  extra.
- The worker's own Touch-set extras list is advisory and never replaces the
  orchestrator's measurement.
- A ticket with an unknown touch set has no extras, because it has no declared
  baseline.

## Extras into a later-wave ticket's files

An extra into a file that a later-wave ticket declares as its own edit is
accepted with a warning, not parked. That later ticket is dispatched from a
base that already contains the change. A same-wave sibling is the real-conflict
case in the [integration gate](integration-gate.md#conflict-deferral-and-drain-rounds).

## Deny-list and cap hits

A deny-list extra, or a ticket over the cap, parks the ticket before
verification with the status token `BLOCKED (TOUCH_SET_APPROVAL)`. The check
runs on the measured extras from the branch diff, so a parked branch is not yet
verified. The ticket's work is kept on its worker branch.

The deny-list is a fixed default plus the ticket's own read-only Context items:

- Lockfile names `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, and
  `bun.lockb`, and environment files `.env*`, match at any directory depth.
- The directory-style entries `.github/workflows/` and `docs/decisions/`, and
  the file `.gitlab-ci.yml`, match as a prefix from the repository root.
- The ticket's read-only Context items (plain and "from NN" items) match by
  exact path, but only those that no ticket edits. An extra that any ticket in
  the set declares as its own edit is not a deny-list case, even when this
  ticket lists it as a read; the real-conflict rule handles it.

The cap: a ticket with more than five distinct extra files, counted as the union
across all its dispatches, parks the same way. Extras dropped by a rejection no
longer count. A redispatch after a rejection that parks again costs another
attempt; attempt counting is defined in
[status-and-resume.md](status-and-resume.md#rejection) and
[integration-gate.md](integration-gate.md#conflict-deferral-and-drain-rounds).

A ticket with an unknown touch set has no extras and no cap, but the deny-list
still applies to it.

A parked ticket's work is kept on its worker branch. For adapter backends the
worktree is kept too; see the adapter contract.
