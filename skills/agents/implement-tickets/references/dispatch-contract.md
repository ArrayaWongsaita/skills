# Worker dispatch contract

The orchestrator dispatches one native worker per ticket, one ticket at a time,
in ascending ticket number. It writes the ticket's self-contained prompt to
`.scratch/<slug>/prompts/<NN>.md`, then passes it to the harness. The prompt
carries the integration SHA the worker syncs to first
([prompt scaffold](prompt-scaffold.md)).

```
Agent(
  subagent_type: <worker agent chosen in planning>,
  description:   "implement ticket <NN> <slug>",
  prompt:        <contents of .scratch/<slug>/prompts/<NN>.md>,
  isolation:     "worktree",
)
```

A ticket is ready when every blocker is integrated. A blocked ticket and its
transitive dependants wait; the next ready ticket goes next.

## Worker branch per attempt

Each attempt builds on its own Worker branch, `implement-tickets-work/<slug>/NN-aK`,
with `K` the attempt number starting at 1. An infrastructure retry that counts
no attempt takes `implement-tickets-work/<slug>/NN-aK-iJ`, with `J` counting the
infrastructure retries of that attempt from 1. The prompt carries the name as
`<worker-branch>` ([prompt scaffold](prompt-scaffold.md)). A kept worktree holds
its branch, so a retry on a new name never collides with it. Derive `K` and `J`
by the [rule next to the Worktree column](status-and-resume.md#worktree-column).

The orchestrator records the worktree path the worker returns in `status.md`.
This assumes `isolation: "worktree"` returns the worktree path and its branch
name. Confirm it on the first real dispatch: dispatch a worker that commits, then
compare the returned path and branch with `git worktree list`. When a result
lacks either, find the worktree by matching the attempt's branch name in
`git worktree list`.

## Infrastructure failures

A worker crash, a missing report, a hung or lost subagent, and a failed sync to
the integration SHA are `failed_infra`. They count no ticket attempt. Retry with
a fresh worker on the next `-iJ` branch name, since the failed worker's kept
worktree still holds its own; after two infra retries on one ticket, mark it
`BLOCKED (TICKET_PROVIDER_FAILED)`.

## Measuring extras

Right after a worker returns, measure its extras from the branch:

```
git diff --name-only --no-renames <pre-ticket-integration-sha> <worker-branch>
```

Subtract the declared touch set; what remains is the ticket's extras. A file the
worker left out of its report is still an extra, and the worker's own
Touch-set extras list is advisory. A ticket with an unknown touch set has no
extras.

The orchestrator rejects extras that the acceptance criteria do not explain
(for example a lockfile, a CI workflow, or an ADR the ticket never mentions):
keep the worktree and redispatch on a new branch name with the prompt told to
stay in its declared files, at the cost of one attempt. Other extras are accepted, recorded in
`status.md`, and listed in the handoff.
