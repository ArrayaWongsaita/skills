---
name: agy-implement
description: Turn a directory of grill-to-tickets tickets into working code by planning execution waves, dispatching one headless agy worker per ticket across several LLM providers, forcing test-first implementation, verifying every result, integrating one commit per ticket onto a branch, and stopping before review.
disable-model-invocation: true
---

# Agy Implement

Take a directory of `grill-to-tickets` tracer-bullet tickets and drive it to
working code. The main agent — the **orchestrator** — reads the ticket set and
its parent `spec.md`, plans the order of work as dependency **waves**, then
dispatches one headless `agy` **worker** per ticket. Workers build each ticket
test-first; the orchestrator verifies every result itself, assembles the verified
work onto one **integration branch** as one commit per ticket, and stops before
review.

This skill is the multi-provider, parallelizing alternative to the single-context
`/implement` line in the `grill-to-tickets` handoff. It carries its own copy of
the planning, worktree, verification, and TDD machinery so a future
`qwen-implement` or `codex-implement` sibling can diverge from it freely.

```
Stage 0: Plan (read-only)     parse tickets -> dependency DAG -> waves
   |                          estimate touch-sets, pick test seams, emit the Plan
   | (pause: explicit approval, no source mutated)
   v
Stage 1: Execute, wave by wave
   |  dispatch one agy worker per ticket (serial in-tree, parallel in worktrees)
   |  orchestrator verification gate per ticket (reproduce red, green, typecheck)
   |  integration gate per wave (squash-merge in ticket order, full suite)
   v
Stop: handoff message (integration branch, per-provider usage, /code-review + /scrutinize)
```

## Invocation

Explicit invocation only:

- Universal / slash command: `/agy-implement <dir|slug>`
- Codex command: `$agy-implement <dir|slug>`

`<dir|slug>` is a `.scratch/<feature-slug>/` directory, a bare `<feature-slug>`,
or omitted. An explicit argument wins.
With no argument, the most recently modified `.scratch/*/issues/` directory is
used and named back to the user for confirmation. Full resolution rules are in
[references/planning.md](references/planning.md) §1.

Codex policy is declared in `agents/openai.yaml`
(`allow_implicit_invocation: false`). Claude Code installations rely on
`disable-model-invocation: true`. Require explicit human invocation before
starting a run or a sub-command.

## Sub-commands

Detailed in [references/status-and-resume.md](references/status-and-resume.md).

- `/agy-implement continue [slug]` — resume an interrupted run: reconcile against
  reality, rewind the integration branch if a committed ticket no longer
  verifies, then re-present the Plan and re-dispatch from the frontier.
- `/agy-implement status [slug]` — the wave table, per-ticket status, blockers,
  and cumulative per-provider usage, read-only.
- `/agy-implement list` — one line per run under `.scratch/*/status.md`,
  read-only.

## Feature-scoped storage

Every run artifact lives under the ticket directory's feature slug.

```
.scratch/<feature-slug>/
├── issues/            # input: tracer-bullet tickets (NN-<slug>.md), already published
├── spec.md            # input: the parent specification
├── status.md          # run state: wave table, per-ticket status, cumulative usage
├── prompts/<NN>.md    # one self-contained worker prompt per ticket
├── logs/<NN>.json     # one agy result envelope per worker run
└── worktrees/<NN>/    # one git worktree + worker branch per ticket (gitignored)
```

## Stage 0 — Plan (read-only)

Follow [references/planning.md](references/planning.md). In short:

1. **Resolve the target** and load every ticket, the parent `spec.md`, the
   feature `CONTEXT.md` / `adr/`, and the repo's own ADRs.
2. **Parse** every ticket in the `to-tickets` local format.
3. **Build and validate the dependency DAG** — acyclic, every blocker resolvable,
   numbering consistent with a topological order. A cycle, a missing blocker, or
   inconsistent numbering **halts the run before any other work**, naming the
   specific broken ticket.
4. **Compute waves** — wave 0 is every ticket with no blockers; wave K is every
   ticket whose blockers all landed in earlier waves. Within a wave, tickets with
   no `Blocked by` edge between them are independent tickets.
5. **Estimate each ticket's touch-set** as an advisory hint. Flag an independent
   same-wave pair `likely-overlapping — consider serializing` when their
   estimated touch-sets intersect or either touches a cross-cutting file (router,
   DI container, root schema, migrations directory, `package.json`, lockfiles, CI
   config, shared config). The user decides at approval; the integration gate is
   the correctness guarantee.
6. **Select a test seam per ticket** from the parent spec's Testing Decisions
   where they constrain it, otherwise the narrowest public boundary that
   exercises the ticket's acceptance criteria. A ticket no isolated test can
   exercise returns to planning rather than shipping without a test.
7. **Emit the Plan** — a wave table plus, per ticket: wave, estimated touch-set,
   serial/parallel proposal and reason, overlap flags, test seam, and retry
   budgets. The Plan has **no model column**. Pause for explicit approval, and
   mutate no file outside `.scratch/<feature-slug>/` until the user approves.

## Stage 1 — Execute (per wave, frontier order)

Once the Plan is approved, run the preflight in
[references/worktree-integration.md](references/worktree-integration.md), then
work each wave in frontier order. The orchestrator dispatches every ticket to a
worker; a ticket no worker can finish within its retry budget becomes `BLOCKED`
and waits for a human.

### Dispatch one worker per ticket

Follow [references/agy-contract.md](references/agy-contract.md) for the exact
`agy` invocation and [references/prompt-scaffold.md](references/prompt-scaffold.md)
for the worker prompt. Cut the ticket's worktree and worker branch from
integration `HEAD`, write the self-contained prompt to
`.scratch/<slug>/prompts/<NN>.md`, and dispatch `agy` against that worktree. The
prompt carries the ticket's `**Reuse:**` line verbatim and, when the project has
a Reuse Catalog (`docs/reuse-catalog.md`), a read-only pointer to it for any
helper the ticket did not plan; a Reuse line with any verb other than `use` also
names the spec's Reuse Plan among the worker's sections.

The worker builds the ticket test-first and commits on its own worker branch.
Model is assigned at dispatch time by round-robin over dispatch order (see
`agy-contract.md`) and recorded in `status.md`. A wave approved for parallel
execution dispatches one background worker per ticket, capped at the concurrency
cap (default 4) with the rest queued; the harness re-invokes the orchestrator as
each finishes.

### Verification gate (orchestrator, per ticket, in the ticket's worktree)

The orchestrator — not the worker — runs every check:

1. **Envelope.** `status` is a success value and the `response` carries the red
   output, the green output, and the test → criterion table. A non-success
   `status`, a missing envelope, or a truncated return is a worker failure.
2. **Reproduce the red state.** Split the worker's changed files into tests and
   implementation. On a scratch checkout at the pre-ticket integration `HEAD`,
   apply **only the test files**, run them, and confirm they fail for a missing
   behaviour — not a compile or import error. A test that passes without the
   implementation, or only fails to compile, is a verification failure. The
   worker's pasted red output is corroborating evidence, not the check.
3. **Coverage.** Every acceptance criterion maps to at least one new test, and no
   test is vacuous or tautological (`expect(true).toBe(true)`, an assertion that
   recomputes the expected value the way the code does).
4. **Green.** Re-run the ticket's new and changed tests; they pass. The
   typecheck passes.

Any failure resumes the same worker through `agy --conversation <id> -p "<the
specific failure>"`, up to `MAX_TICKET_ATTEMPTS = 3`. The third failure yields
`BLOCKED (TICKET_VERIFICATION_FAILED)`, records the failure output in
`status.md`, and keeps the worktree for inspection. A provider or infrastructure
failure (rate-limit, timeout, crash) instead triggers **`Failover`** to the next
model — separate budget `MAX_FAILOVER_ATTEMPTS = 3`, not counted against the
verification attempts.

### Integration gate (orchestrator, per wave)

Follow [references/worktree-integration.md](references/worktree-integration.md):
squash-merge each verified worker branch into the integration branch as one
commit in ascending ticket-number order (then ticking that ticket's checkboxes and
setting its `Status:` — on disk when `.scratch/` is git-ignored, inside the commit
when the ticket file is tracked), resolve a mechanical conflict and surface a
design-encoding one, then run the full typecheck and test suite on the
integrated result before advancing. Each ticket's squash commit also carries
its Reuse Catalog entries: for each `create-shared`, `create-candidate`,
`extend`, or `promote` in its Reuse line, the orchestrator greps the symbol in
the worker's changed files for its path, takes the use-when from the spec's
Reuse Plan, and writes the entry — serially, in ticket order, so the
orchestrator is the catalog's only writer while parallel wave-mates only read
it; no entry for a symbol that is not there; nothing at all when the project has
no catalog.

## State, failure, and resume

Follow [references/status-and-resume.md](references/status-and-resume.md). Run
state lives in `.scratch/<feature-slug>/status.md` — the wave table, each
ticket's `{status, conversation_id, model, attempts, failover_attempts,
worker_branch, commit, usage}`, the integration branch ref, and cumulative
per-provider usage — updated as each ticket transitions.

A `BLOCKED` ticket halts only its own dependency branch: the in-flight workers
finish, passing work is integrated, and the run stops at the next frontier with a
report naming the blocked tickets, their reasons, the downstream tickets not
started, and the `/agy-implement continue` command.

## Stop — Handoff

When every ticket is integrated and the last wave's suite is green, print a
handoff and stop — the integration branch name, one-commit-per-ticket
confirmation, cumulative per-provider token usage, and the review commands to run
next in a fresh context:

```text
All <N> tickets integrated onto the integration branch
agy-implement/<feature-slug> — one commit per ticket, in dependency order.

Per-provider token usage:
  <provider>   in <…>  out <…>  total <…>
  ...

Review is a separate pass. In a fresh context, from this branch:
/code-review since <merge-base with main>
/scrutinize
```

This run stops here — it runs no review, no `git push`, and opens no pull
request.

## Constraints

- The orchestrator dispatches every ticket to a worker. It writes implementation
  code itself only to resolve a purely mechanical merge conflict; a
  design-encoding conflict is surfaced, not resolved.
- Workers commit only on their own worker branch; the orchestrator commits only
  on the integration branch. `git push`, pull requests, running `/code-review` or
  `/scrutinize`, and tracker updates happen only when the user explicitly asks —
  this run does none of them.
- Keep `grill-to-tickets`, `engineering-workflow`, every `mattpocock/skills`-sourced
  file, and `skills-lock.json` exactly as they are — this skill is standalone by
  design (see `docs/decisions/0004-agy-implement-standalone.md`).
