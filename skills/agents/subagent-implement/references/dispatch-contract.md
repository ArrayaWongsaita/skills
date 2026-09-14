# The native subagent worker contract

The orchestrator dispatches one harness subagent per ticket as a **worker** and
reads its final report. A second subagent per ticket, the **verifier**, is
covered in
[verification-and-integration.md](verification-and-integration.md). Both are
dispatched through the harness's Agent / Task tool, run in the background, and
notify the orchestrator on completion — the orchestrator is re-invoked as each
finishes rather than blocking a single turn.

## Dispatching a worker

```
Agent(
  subagent_type: <resolved agent, see below>,
  description:   "implement ticket <NN> <slug>",
  prompt:        <contents of .scratch/<slug>/prompts/<NN>.md>,
  isolation:     "worktree",
  model:         <the run's --model value, only when set>,
)
```

| field | why |
|---|---|
| `subagent_type` | the resolved worker agent (never `fork` — a fork inherits the orchestrator's context and model, which is the cost this skill exists to avoid) |
| `description` | short label for the run log |
| `prompt` | the self-contained worker prompt; written to `.scratch/<slug>/prompts/<NN>.md` first for the audit trail, then passed by value |
| `isolation: "worktree"` | the worker gets its own git worktree so its edits and commits never touch the orchestrator's checkout; a worktree with commits on it persists for the orchestrator to merge |
| `model` | passed only when the run set `--model`; otherwise omitted so the worker inherits the orchestrator's model and the skill stays portable across harnesses |

The worker's working directory is its worktree, already on the worker branch
`subagent-implement/<feature-slug>/<NN>` cut from integration `HEAD`. Every path
in the prompt is absolute.

## Resolving the worker agent

Decided once at planning, applied to every ticket:

1. **`--agent <name>` wins.** A run-level pin names the subagent type for every
   worker; use it and skip the rest.
2. **Otherwise, match by wording.** Read the subagent types available in the
   orchestrator's environment. Pick one whose name or description clearly covers
   building software — words like `implement`, `feature`, `build`, `code`, `tdd`,
   `engineer`, `developer`. The first clear match wins.
3. **Fall back to `general-purpose`** when no available agent is
   implementation-shaped.
4. **Fall back to `claude`** when `general-purpose` is not among the available
   types.

There is no reasoning about which ticket suits which agent beyond the wording
match — that selection is the part that goes wrong. The verifier is always
`Explore`.

## Worker final report

The worker ends its final message with the structured return the prompt asks for:

- **Red output** — the failing test run from the red step, verbatim.
- **Green output** — the passing test run and the typecheck, verbatim.
- **Files changed** — every file the worker created or modified, as a list,
  split into test files and implementation files.
- **Test → criterion table** — each new test mapped to the acceptance criterion
  it covers.

The orchestrator writes this to `.scratch/<slug>/reports/<NN>.md` and reads it
there. The harness also exposes the worker's subagent id / name — retained in
`status.md` and used to resume the same worker for a retry.

A missing return section, a truncated message, or a non-completion status is a
worker failure — handled the same as a verification failure.

## Retry and budget

One budget: **`MAX_TICKET_ATTEMPTS = 3`**.

- A **verification failure** (tests missing, not actually red first, still red,
  vacuous, or not covering the criteria) resumes the *same* worker:
  `SendMessage({ to: <worker id/name>, message: "<the specific failure detail>" })`.
  The worker keeps its worktree and its context; the follow-up is targeted and
  cheap.
- A **worker crash, timeout, or lost subagent** re-dispatches a *fresh* worker
  against the same worker branch. There is no separate failover budget — with no
  external provider in the loop, an infrastructure failure and a bad result draw
  from the same three attempts.
- The **third failure** yields `BLOCKED (TICKET_VERIFICATION_FAILED)`, records
  the failure output in `status.md`, and keeps the worktree for inspection.

## Points to confirm on first real use

The Agent / Task tool's exact behaviour varies by harness. Confirm on the first
run, the way `agy-implement` confirms its `agy` envelope, and adjust these
references rather than the workflow:

| assumption | how to confirm |
|---|---|
| a non-fork subagent dispatched in the background re-invokes the orchestrator on completion | dispatch one trivial worker, observe the re-invocation |
| `isolation: "worktree"` keeps a worktree that has commits, and its path + branch are recoverable by the orchestrator | dispatch a worker that commits, then locate the worktree and branch from the orchestrator |
| `SendMessage` resumes a backgrounded worker with its context intact | resume one worker with a follow-up, confirm it still has the ticket context |
| the final report carries token usage | inspect one completed worker's result; if present, roll it into `status.md` as a bonus |
| `Explore` reads deeply enough to summarise a test diff | run one verifier; if its reading is too shallow, switch the verifier to `general-purpose` instructed to write nothing |
