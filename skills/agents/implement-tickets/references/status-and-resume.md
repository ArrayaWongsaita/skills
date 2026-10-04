# Run status and resume

The run record is `.scratch/<feature-slug>/status.md`, written when the run
starts and updated as each ticket moves. Its first line is exactly
`skill: implement-tickets`:

```markdown
skill: implement-tickets
# Run status: <feature-slug>

Integration branch: `implement-tickets/<feature-slug>`
Integration commit: `<current-sha>`

| Ticket | Status | Attempts | Branch | Commit | Worktree | Extras | Risk | Verifier |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| 01 | integrated | 1 | `implement-tickets-work/<feature-slug>/01-a1` | `<sha>` | `a1: <path>` | `none` | `low` | `skipped` |
```

One row per ticket in ticket order. Status moves through pending, dispatched,
verifying, integrated, or `BLOCKED` with its reason token. Risk is `low`, `high`
for a declared `Risk: high`, or the name of the
[risk signal](verification.md#risk) that made the ticket risky. Verifier is
`ran` or `skipped`. Extras lists the accepted extra files, written when they
are accepted. Attempts counts ticket attempts only; infrastructure failures
count none. Branch and Commit hold the latest attempt's branch and the commit it
produced.

## Worktree column

The Worktree cell lists every attempt of the ticket, separated by semicolons:
`aK: <path>`, or `aK-iJ: <path>` for an infrastructure retry. A harness branch
that differs from the Worker branch is appended as ` (harness: <branch>)`, and a
path the orchestrator could not identify is written `?`. For example:
`a1: /w/one; a2: /w/two (harness: worktree-x); a2-i1: ?`.

The path is written when the worker returns. A worker that never returns is found
by matching its branch name in the worktree list; a crash before the worker
created its branch leaves a path the orchestrator cannot identify, which is
reported as an unknown path in `report.md` and the handoff. When the harness
result lacks the path or branch name, fall back to the worktree list
([dispatch contract](dispatch-contract.md#worker-branch-per-attempt)).

`K` is the number after `a`, so `a1-i1` counts as `K=1`. For any redispatch,
derive `K` as one more than the highest `K` found in the Worktree cell, in the
local branches matching `implement-tickets-work/<slug>/NN-*`, and in the worktree
list, and derive `J` the same way, never from the `Attempts` column: a reset
`Attempts` or a crashed worker that never reported a path must not reuse a kept
name.

## Run report

`.scratch/<feature-slug>/report.md` collects what went wrong so the skill can be
improved from real runs. Append one entry at the moment of each of these:

- a ticket becomes `BLOCKED`, or a gate fails
- a verifier rejects a ticket, or the orchestrator rejects extras
- an infrastructure failure repeats
- the written procedure was unclear, missing, or contradictory and the
  orchestrator had to improvise

```markdown
## <NN or run> — <short title>

- Step: <planning | dispatch | measuring | verification | gate | continue>
- Happened: <what the agent did>
- Expected: <what the skill text led it to expect>
- Evidence: <status.md rows, command output, or the agent's message, trimmed>
```

A clean run writes no report. The person reads `report.md` after the run and
decides what to send to the skill repository.

## Blocked tickets

A ticket blocked after its [attempts](verification.md#attempts) holds its transitive dependants. Finish
the in-flight ticket, then keep running independent tickets. The final report
names each blocked ticket with its reason, each held ticket with its blocker,
and the command `/implement-tickets continue <feature-slug>`.

## Continue

`/implement-tickets continue [slug]` resumes a run. Refuse a `status.md` whose
first line is not `skill: implement-tickets` and tell the person to recover the
old run from git history or start over.

1. Reconcile each recorded integration branch, commit, worker branch, and ticket
   commit against Git. If Git drifted from the recorded sequence, find the last
   good ticket commit, rewind the integration branch to it with the
   [gate's rewind](integration-gate.md#failing-gate), record the discarded commits,
   and reset the affected rows.
2. Re-run planning on the current tickets and print the Plan.
3. Resume from the first ready ticket. A ticket that was `verifying` or
   `dispatched` restarts from a fresh worker. An integrated ticket is not
   re-verified.
