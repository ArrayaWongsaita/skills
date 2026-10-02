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

## Infrastructure failures

A worker crash, a missing report, a hung or lost subagent, and a failed sync to
the integration SHA are `failed_infra`. They count no ticket attempt. Retry with
a fresh worker; after two infra retries on one ticket, mark it
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
discard the branch and redispatch with the prompt told to stay in its declared
files, at the cost of one attempt. Other extras are accepted, recorded in
`status.md`, and listed in the handoff.
