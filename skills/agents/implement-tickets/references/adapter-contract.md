# Adapter contract

An adapter is a separately installed skill named `implement-tickets-<name>`.
The core searches for its `SKILL.md` in this order: project
`.agents/skills/`, project `.claude/skills/`, user `~/.agents/skills/`, and user
`~/.claude/skills/`. `preflight.mjs` reports the first matching path. The Plan
uses the selected adapter name as its backend.

If no adapter exists, preflight stops before presenting the Plan. It reads the
`implement-tickets` source from `skills-lock.json` first and
`~/.agents/.skill-lock.json` second and prints:

```text
npx skills add <source> --skill implement-tickets-<name>
```

When neither lock has the core entry, it uses
`<source of implement-tickets>` in the install line and tells the person to use
the source that installed the core. `--agent` cannot be combined with `--with`;
that error is returned before planning. `--model` is passed to the adapter as
the original raw value, with no parsing or normalization.

## Input

For each worker dispatch, the core passes the adapter one request containing:

```json
{
  "action": "run",
  "backend": "<name>",
  "ticket": { "number": "NN", "title": "<title>", "attempt": 1 },
  "prompt": "<complete worker prompt>",
  "integration_sha": "<wave integration commit>",
  "worker_branch": "implement-tickets-work/<slug>/NN",
  "worktree_path": "/<feature>/worktrees/NN-attempt-1",
  "model": "<raw model value>"
}
```

`model` is omitted when the run has no `--model`. The core creates the worker
branch and worktree under the feature directory's `worktrees/` folder, checks
the worktree out at `integration_sha`, and passes its path to the adapter. The
adapter runs its backend only in that supplied worktree and returns one
envelope conforming to
[`envelope.schema.json`](envelope.schema.json). Preserve backend usage as
reported; the core records it as possibly cache-inclusive.

## Resume

For a counted `failed_other`, the core may call the same adapter again with
`action: "resume"`, the same `session_id`, the existing ticket and worktree,
and the verifier's failure evidence appended to the prompt. Resume the existing
backend session rather than starting a new one. Return a fresh envelope using
the same schema. The first successful delivery includes usage from each resume
on its delivering path.

An infrastructure retry may start a fresh backend session after the prior
session is unavailable. It uses the same ticket, worker branch, and feature
worktree unless the orchestrator has explicitly recreated them from the wave's
integration SHA.

## Failover

The table below defines outcome routing:

| Outcome | Core action | Attempt accounting |
| --- | --- | --- |
| `completed` | Send the worker report to a fresh verifier. Integrate only after verification. | The report is eligible for verification. |
| `failed_infra` | Not counted: retry infrastructure at most two times; after two retries, mark `BLOCKED (TICKET_PROVIDER_FAILED)`. | At most two retries. |
| `failed_other` | Append the failure evidence and resume the same session. A third counted failure marks `BLOCKED (TICKET_VERIFICATION_FAILED)`. | One counted attempt. |

Adapter backends carry the same Touch-set extras section in the free-form
worker report; the envelope schema does not change and there is no
adapter-specific drift rule. The core measures extras from the worker branch as
for native runs.

An envelope is a transport result, not a verdict. The verifier supplies raw
evidence and the orchestrator judges whether the ticket is complete.

## Worktree cleanup

The core owns the worker branch and worktree. The adapter must not create,
switch, merge, or remove either one; it must work only at `worktree_path` (the
worktree path) and return its envelope. The core removes the worktree after integration.
Failed and blocked worktrees remain available for inspection and are swept on
`continue`; worktrees of parked tickets (`BLOCKED (TOUCH_SET_APPROVAL)`) are exempt
from that sweep, because approval needs the kept work. Native runs keep harness-managed isolation; they do
not use adapter-created worktrees.

## Fixture adapter

`tests/fixtures/implement-tickets/adapters/implement-tickets-fixture/` is a
scripted adapter fixture, not a real backend. Its completed, infrastructure
failure, other failure, and resume envelopes are checked by the core preflight
script against the shipped schema.
