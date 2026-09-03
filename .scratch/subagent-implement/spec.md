# subagent-implement — Specification

Feature slug: `subagent-implement`. Glossary: [CONTEXT.md](CONTEXT.md). Decisions:
[adr/0001](adr/0001-context-preservation-is-the-purpose.md),
[adr/0002](adr/0002-orchestrator-never-implements.md),
[adr/0003](adr/0003-serial-first-parallelism-deferred.md),
[adr/0004](adr/0004-fresh-verifier-subagent.md). Repo ADR:
[docs/decisions/0005](../../docs/decisions/0005-subagent-implement-standalone.md).

## Problem Statement

I have a directory of tracer-bullet tickets under `.scratch/<feature-slug>/issues/`
from `grill-to-tickets` (or `to-tickets`). Driving `/implement` myself, one ticket
per context window, fills my window with implementation detail — file reads, edits,
test output — and my planning and judgment degrade as the run goes on.
`/agy-implement` fixes a different problem (spreading spend across LLM providers)
and brings machinery I do not need here: provider round-robin, failover, per-wave
scheduling.

I want to hand the whole ticket directory to something that plans the order of
work, farms each ticket's implementation to a subagent whose context — not mine —
holds the detail, forces every ticket test-first so I can trust the result,
assembles the pieces into one branch with one commit per ticket, and stops
cleanly before review — resumable if interrupted, and portable across harnesses.

## Solution

`/subagent-implement .scratch/<feature-slug>/` (or a bare `<feature-slug>`; with
no argument it picks the most recent `.scratch/*/issues/` directory). Options:
`--agent <name>` pins the worker subagent type for the run; `--model <id>` is a
raw pass-through, omitted by default.

The **orchestrator** works in two stages:

1. **Plan (read-only).** Parse the tickets into a dependency DAG, validate it,
   compute the dependency order, select a test seam per ticket from the parent
   spec's Testing Decisions, match an agent per ticket, and present the **Plan**.
   Change no source until the user approves.
2. **Execute, one ticket at a time in dependency order.** Dispatch one **worker**
   subagent per ticket (Agent tool, `isolation: "worktree"`, self-contained
   test-first prompt). When it returns, dispatch a fresh **verifier** (`Explore`)
   that reproduces the red state and runs green + typecheck + full suite,
   returning raw evidence. The orchestrator judges from the two reports —
   coverage, vacuous assertions, genuinely-red-first, genuinely-green — and
   squash-merges the worker branch as one commit in dependency order.

The orchestrator never implements a ticket itself; it writes code only to resolve
a mechanical merge conflict. A ticket that fails judgment three times is
`BLOCKED`; the running ticket finishes, passing work stays integrated, and the
run stops at the next frontier with a report. `/subagent-implement continue`
resumes with Reality reconciliation.

On completion the skill prints a handoff — the integration branch name, a
one-commit-per-ticket confirmation, and the `/code-review` + `/scrutinize`
commands for a fresh context. It runs no review, no push, no PR.

## User Stories

1. As a developer, I want to run `/subagent-implement` against a ticket directory
   so I implement a whole `grill-to-tickets` output in one command while my
   context stays free for planning.
2. As a developer, I want each ticket's file reads, edits, and test runs to
   happen in a subagent so they never enter my window — only the worker's report
   and the verifier's evidence do.
3. As a developer, I want the skill to refuse to start unless I invoked it
   explicitly (`/subagent-implement` or `$subagent-implement`).
4. As a developer, I want the dependency DAG validated (cycle, missing blocker,
   numbering) and the run halted with the specific broken ticket named.
5. As a developer, I want the Plan to show, per ticket, its blockers, test seam,
   matched agent, and retry budget — and no model column — and to pause for my
   approval before any source file is touched.
6. As a developer, I want the worker subagent chosen by a name/description match
   against the agents in my environment, falling back to `general-purpose`, with
   an optional `--agent` pin — and no per-ticket agent reasoning.
7. As a developer, I want workers to inherit my model by default so the skill
   works on any harness, with `--model` as an explicit raw override.
8. As a developer, I want each ticket built test-first, and a ticket that no
   isolated test can exercise sent back to planning rather than shipped without a
   test.
9. As a developer, I want a fresh verifier subagent — not the worker, not me — to
   reproduce the red state and run the suite, and I want to make the pass / retry
   / BLOCKED call myself from its evidence.
10. As a developer, I want a failed ticket retried on the same worker via a
    follow-up message up to three times, then `BLOCKED` with the worktree kept.
11. As a developer, I want each verified ticket squash-merged as exactly one
    commit in dependency order, ticking that ticket's checkboxes and status.
12. As a developer, I want a mechanical merge conflict resolved by the
    orchestrator and a design-encoding one surfaced to me, never chosen silently.
13. As a developer, I want a `BLOCKED` ticket to halt only its dependency branch,
    with independent tickets reported as an available partial path.
14. As a developer, I want run state in `.scratch/<slug>/status.md` and
    `/subagent-implement continue` to reconcile against reality — re-verifying
    each integrated ticket and rewinding to the last still-good commit.
15. As a developer, I want the completion handoff to give me the integration
    branch and the exact review commands, and to push nothing.

## Implementation Decisions

- **Name** `subagent-implement`. Location `skills/agents/subagent-implement/`,
  mirrored byte-identical to `.agents/skills/subagent-implement/`. Human guide at
  `docs/skills/agents/subagent-implement.md`. Symlink `.claude/skills/subagent-implement`.
- **Invocation** explicit only: `disable-model-invocation: true` +
  `agents/openai.yaml` `allow_implicit_invocation: false`. Sub-commands
  `continue`, `status`, `list`.
- **Pure prompt, no scripts.** Parsing, DAG/order computation, agent match, and
  judgment are prose instructions the orchestrator follows. `references/` holds
  the procedures; `SKILL.md` holds the workflow.
- **Reference set** (5): `planning.md`, `dispatch-contract.md`,
  `prompt-scaffold.md`, `verification-and-integration.md`,
  `status-and-resume.md`.
- **Dispatch** via the Agent / Task tool: `subagent_type` (resolved by agent
  match, never `fork`), `prompt` by value (written to `prompts/<NN>.md` first),
  `isolation: "worktree"`, `model` only when `--model` is set.
- **Worker branch** `subagent-implement/<feature-slug>/<NN>` cut from integration
  `HEAD`; **integration branch** `subagent-implement/<feature-slug>`.
- **Retry** one budget `MAX_TICKET_ATTEMPTS = 3`; same worker resumed via
  `SendMessage`; a crash counts as one attempt and re-dispatches fresh; no
  separate failover budget.
- **Verifier** a fresh `Explore` subagent per ticket returning raw evidence and
  no verdict; orchestrator fallback runs the new tests once directly on verifier
  error.
- **Integration** squash-merge one commit per ticket in dependency order; no
  separate integration gate in v1 serial.
- **status.md** fields `{status, subagent_id, agent_type, model, attempts,
  worker_branch, commit}` + integration branch ref; no per-provider usage; no
  per-turn state header.
- v1 accepts feature ticket sets only.

## Testing Decisions

`subagent-implement` is a prompt document with no executable code, so tests
exercise **external behaviour only**: given a scenario (a ticket directory + a
parent spec + a described environment), does the orchestrator produce the right
Plan and the right dispatch, verification, and integration decisions, expressed
as text. Tests assert on observable choices — dependency order, which ticket is
BLOCKED, whether it halts vs continues, whether it mutates source before
approval, whether it ever implements a ticket itself, which subagent type it
dispatches — never on wording.

The **eval harness** is the one seam (`evals/evals.json`, one case per decision
branch; `evals/trigger-evals.json` for routing). Anything below it (real subagent
dispatch, `isolation: "worktree"` mechanics, `SendMessage` resume) is covered by
the first-use confirmation checklist in `references/dispatch-contract.md`, not by
an eval. A `tests/subagent-implement-contract.test.mjs` and
`tests/subagent-implement-evals.test.mjs` guard the `.agents/` mirror, the
reference-set agreement, and drift between the skill prose and the eval claims —
the same shape as the `agy-implement` contract tests.

## Out of Scope

- Running `/code-review` or `/scrutinize` — handed off, not performed.
- `git push`, pull requests, and any issue-tracker mutation.
- Bug-fix ticket sets and incident flows.
- Parallel execution of independent tickets — deferred follow-up via
  `isolation: "worktree"` with a per-wave integration gate.
- Per-ticket model or agent selection by complexity or capability.
- A shared-`references/` refactor with `agy-implement` — deferred until the
  shared parts stop diverging.
- Wiring `subagent-implement` into `engineering-workflow` as its `IMPLEMENTATION`
  delegate.
- Modifying `grill-to-tickets`, `engineering-workflow`, `agy-implement`,
  `mattpocock/skills` files, or `skills-lock.json`.

## Further Notes

### First-use confirmation checklist

Assumptions about the harness's Agent / Task tool, confirmed on the first real
run and folded back into `references/dispatch-contract.md`:

1. A non-fork subagent dispatched in the background re-invokes the orchestrator
   on completion.
2. `isolation: "worktree"` keeps a worktree that has commits, and its path +
   branch are recoverable by the orchestrator.
3. `SendMessage` resumes a backgrounded worker with its context intact.
4. Whether the final report carries token usage (bonus for `status.md`).
5. `Explore` reads deeply enough to summarise a test diff; if not, the verifier
   becomes `general-purpose` instructed to write nothing.

### Deferred follow-ups

- Parallel execution + per-wave integration gate.
- Shared-`references/` refactor with `agy-implement` once the shared parts
  stabilise.
- `engineering-workflow` `IMPLEMENTATION`-delegate wiring, if it survives.
