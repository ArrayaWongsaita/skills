---
name: subagent-implement
description: Turn a directory of grill-to-tickets tickets into working code without spending the main agent's context on implementation — plan the dependency order, dispatch one native harness subagent per ticket to build it test-first in an isolated worktree, have a fresh verifier subagent reproduce the red state and run the suite, judge the two reports, integrate one commit per ticket onto a branch, and stop before review.
disable-model-invocation: true
---

# Subagent Implement

Take a directory of `grill-to-tickets` / `to-tickets` tracer-bullet tickets and
drive it to working code **while the main agent's context stays lean**. The main
agent — the **orchestrator** — reads the ticket set and its parent `spec.md`,
plans the order of work from the dependency graph, then dispatches one **worker**
— a native harness subagent — per ticket. Each worker builds its ticket
test-first inside an isolated worktree and returns a compact report; a fresh
**verifier** subagent reproduces the red state and runs the suite; the
orchestrator reads only those two reports, judges the result, squash-merges one
commit per ticket onto an **integration branch**, and stops before review.

This is the native-subagent, context-preserving sibling of `agy-implement`.
`agy-implement` dispatches external `agy` processes to spread token spend across
LLM providers; `subagent-implement` dispatches the harness's own subagents so the
file reads, edits, and test runs of implementation land in a worker's context
window rather than the orchestrator's — only each worker's and verifier's final
report crosses back. It carries its own copy of the planning, dispatch,
verification, and state machinery so it can diverge from `agy-implement` freely.

```
Stage 0: Plan (read-only)   parse tickets -> dependency DAG -> dependency order
   |                        pick a test seam and an agent per ticket, emit the Plan
   | (pause: explicit approval, no source mutated)
   v
Stage 1: Execute, one ticket at a time in dependency order
   |  dispatch one worker subagent per ticket (isolated worktree, test-first prompt)
   |  fresh verifier subagent per ticket (reproduce red, green, typecheck, full suite)
   |  orchestrator judges the two reports (vacuous? covers the criteria?) then squash-merges
   v
Stop: handoff (integration branch, one commit per ticket, /code-review + /scrutinize)
```

## Invocation

Explicit invocation only:

- Universal / slash command: `/subagent-implement <dir|slug>`
- Codex command: `$subagent-implement <dir|slug>`

`<dir|slug>` is a `.scratch/<feature-slug>/` directory, a bare `<feature-slug>`,
or omitted. An explicit argument wins. With no argument, the most recently modified `.scratch/*/issues/` directory
is used and named back to the user for confirmation. Full resolution rules are in
[references/planning.md](references/planning.md) §1.

Run options, set once at invocation:

- `--agent <name>` — pin every worker to this subagent type for the whole run.
- `--model <id>` — pass this model to every worker as a raw value. Omitted by
  default, so workers inherit the orchestrator's model and the skill stays
  portable across harnesses.

Codex policy is declared in `agents/openai.yaml`
(`allow_implicit_invocation: false`). Claude Code installations rely on
`disable-model-invocation: true`. A run or a sub-command starts only on explicit
human invocation.

## Sub-commands

Detailed in [references/status-and-resume.md](references/status-and-resume.md).

- `/subagent-implement continue [slug]` — resume an interrupted run: reconcile
  against reality, rewind the integration branch if a committed ticket no longer
  verifies, then re-present the Plan and re-dispatch from the frontier.
- `/subagent-implement status [slug]` — the ticket table, per-ticket status, and
  blockers, read-only.
- `/subagent-implement list` — one line per run under `.scratch/*/status.md`,
  read-only.

## Feature-scoped storage

Every run artifact lives under the ticket directory's feature slug.

```
.scratch/<feature-slug>/
├── issues/            # input: tracer-bullet tickets (NN-<slug>.md), already published
├── spec.md            # input: the parent specification
├── status.md          # run state: ticket table, per-ticket status, integration ref
├── prompts/<NN>.md    # one self-contained worker prompt per ticket
└── reports/<NN>.md    # the worker report and the verifier report for each ticket
```

Worker worktrees are managed by the harness (`isolation: "worktree"`), not stored
here.

## Stage 0 — Plan (read-only)

Follow [references/planning.md](references/planning.md). In short:

1. **Resolve the target** and load every ticket, the parent `spec.md`, the
   feature `CONTEXT.md` / `adr/`, and the repo's own decisions.
2. **Parse** every ticket in the `to-tickets` local format.
3. **Build and validate the dependency DAG** — acyclic, every blocker resolvable,
   numbering consistent with a topological order. A cycle, a missing blocker, or
   inconsistent numbering **halts the run before any other work**, naming the
   specific broken ticket.
4. **Compute the dependency order** — a topological ordering of the tickets. The
   **frontier** is every ticket whose blockers have all landed.
5. **Select a test seam per ticket** from the parent spec's Testing Decisions
   where they constrain it, otherwise the narrowest public boundary that
   exercises the ticket's acceptance criteria. A ticket no isolated test can
   exercise returns to planning rather than shipping without a test.
6. **Match an agent per ticket** — see
   [references/dispatch-contract.md](references/dispatch-contract.md). The default
   is a general-purpose subagent; a run-level `--agent` pin overrides.
7. **Emit the Plan** — the ticket table in dependency order plus, per ticket: its
   blockers, its test seam, its matched agent, and the retry budget. Pause for
   explicit approval, and mutate no file outside `.scratch/<feature-slug>/` until
   the user approves.

## Stage 1 — Execute (one ticket at a time, frontier order)

Once the Plan is approved, run the preflight in
[references/verification-and-integration.md](references/verification-and-integration.md),
then take frontier tickets in dependency order. Each ticket runs through dispatch
→ verification → integration before the next one starts. A ticket no worker can
finish within its retry budget becomes `BLOCKED` and waits for a human.

### Dispatch one worker per ticket

Follow [references/dispatch-contract.md](references/dispatch-contract.md) for the
subagent call and
[references/prompt-scaffold.md](references/prompt-scaffold.md) for the worker
prompt. Write the self-contained prompt to `.scratch/<slug>/prompts/<NN>.md`,
then dispatch one subagent with `isolation: "worktree"` against a worker branch
`subagent-implement/<feature-slug>/<NN>` cut from integration `HEAD`.

The worker builds the ticket test-first, commits on its worker branch, and ends
its final message with the required return: the red output, the green output, the
files it changed, and a table mapping each new test to the acceptance criterion
it covers. The harness re-invokes the orchestrator when the worker finishes; the
orchestrator writes the report to `.scratch/<slug>/reports/<NN>.md` and reads it
there.

### Verification gate (fresh verifier subagent, per ticket)

The orchestrator dispatches a fresh **verifier** — an `Explore` subagent, which
reads and runs commands but writes no files — told the pre-ticket integration
`HEAD`, the worker branch, and the list of changed test files. The verifier:

1. **Reproduces the red state.** On a scratch checkout at the pre-ticket
   integration `HEAD`, it applies **only the test files**, runs them, and records
   whether they fail for a missing behaviour — not a compile or import error.
2. **Runs green.** It checks out the worker branch, re-runs the ticket's new and
   changed tests, runs the typecheck, and runs the full test suite.
3. **Returns raw evidence** — the red output, the green output, the typecheck and
   suite results, and a summary of the test diff. It renders **no verdict**.

The orchestrator reads that report and makes the judgment itself:

- Every acceptance criterion maps to at least one new test.
- No test is vacuous or tautological (`expect(true).toBe(true)`, an assertion
  that recomputes the expected value the way the code does).
- The red reproduction failed for a missing behaviour; the green run, the
  typecheck, and the full suite pass.

Any gap resumes the same worker via `SendMessage` with the specific failure, up
to `MAX_TICKET_ATTEMPTS = 3`. A worker crash, timeout, or lost subagent counts as
one attempt and re-dispatches a fresh worker. The third failure yields
`BLOCKED (TICKET_VERIFICATION_FAILED)`, records the failure output in
`status.md`, and keeps the worktree for inspection. Should the verifier itself
error, the orchestrator runs the ticket's new tests once directly as a fallback
check.

### Integration (orchestrator, per ticket)

Follow
[references/verification-and-integration.md](references/verification-and-integration.md):
squash-merge the verified worker branch onto the integration branch as exactly
one commit named for the ticket, ticking that ticket file's acceptance checkboxes
and setting its `Status:`. A mechanical conflict (import ordering, adjacent
edits, a moved block) the orchestrator resolves itself; a conflict that encodes a
design decision (which module owns a shared contract, which schema shape wins)
halts the run and surfaces the decision — the affected ticket returns to Stage 0.
After the merge, remove the worker's worktree and advance to the next frontier
ticket.

Because the run is serial — each worker branch is cut from the current
integration `HEAD` with no other ticket merged in between — the verifier's
full-suite run on the worker branch already covers the post-merge state, so v1
has no separate integration gate. Parallel execution is a deferred follow-up that
reintroduces one.

## State, failure, and resume

Follow
[references/status-and-resume.md](references/status-and-resume.md). Run state
lives in `.scratch/<feature-slug>/status.md` — the ticket table in dependency
order, each ticket's `{status, subagent_id, agent_type, model, attempts,
worker_branch, commit}`, and the integration branch ref — updated as each ticket
transitions.

A `BLOCKED` ticket halts only its own dependency branch: passing work stays
integrated, tickets that transitively depend on the blocked one are held, and the
run stops at the next frontier with a report naming the blocked tickets, their
reasons, the downstream tickets not started, and the `/subagent-implement
continue` command. Independent tickets with no dependency on the blocked one are
reported as an available partial path.

## Stop — Handoff

When every ticket is integrated and the last verifier's suite is green, print a
handoff and stop — the integration branch name, one-commit-per-ticket
confirmation, and the review commands to run next in a fresh context:

```text
All <N> tickets integrated onto subagent-implement/<feature-slug> — one commit
per ticket, in dependency order. The implementation ran in workers; the
orchestrator's context stayed clear of it.

Review is a separate pass. In a fresh context, from this branch:
/code-review since <merge-base with main>
/scrutinize
```

This run stops here — it runs no review, no `git push`, and opens no pull
request.

## Constraints

- The orchestrator dispatches every ticket to a worker. It writes implementation
  code itself only to resolve a purely mechanical merge conflict; a
  design-encoding conflict is surfaced, and a ticket no worker can complete
  within its retry budget becomes `BLOCKED` and waits for a human.
- The orchestrator's own steps stay text-only — parse tickets, build the DAG,
  write prompts, read the two reports, judge, squash-merge, write `status.md`.
  Reading ticket implementation files, running tests, and running the suite
  happen inside subagents.
- Workers commit only on their own worker branch; the orchestrator commits only
  on the integration branch. `git push`, pull requests, running `/code-review` or
  `/scrutinize`, and tracker updates happen only when the user explicitly asks —
  this run does none of them.
- Keep `grill-to-tickets`, `engineering-workflow`, `agy-implement`, every
  `mattpocock/skills`-sourced file, and `skills-lock.json` exactly as they are —
  this skill is standalone by design (see
  `docs/decisions/0005-subagent-implement-standalone.md`).
