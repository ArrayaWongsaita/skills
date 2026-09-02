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
or omitted. An explicit directory or slug wins. With no argument, the most
recently modified `.scratch/*/issues/` directory is selected and named back to
the user for confirmation before planning.

Codex policy is declared in `agents/openai.yaml`
(`allow_implicit_invocation: false`). Claude Code installations rely on
`disable-model-invocation: true`. Require explicit human invocation before
starting a run or a sub-command.

## Sub-commands

See [references/status-and-resume.md](references/status-and-resume.md).

- `/agy-implement continue [slug]` — resume an interrupted run. Reconcile
  `status.md` against reality (git refs, worktrees, each committed ticket's
  acceptance checks); when a committed ticket no longer verifies, rewind the
  integration branch to the last still-good commit, discard the invalidated
  worktrees, list the discarded commits at the top of the report, then
  re-present the Plan and re-dispatch from the frontier.
- `/agy-implement status [slug]` — report the wave table, each ticket's status,
  blockers, and cumulative per-provider usage, read-only.
- `/agy-implement list` — one line per run discovered under `.scratch/*/status.md`,
  read-only.

## Feature-scoped storage

Every run artifact lives under the ticket directory's feature slug.

```
.scratch/<feature-slug>/
├── issues/            # input: tracer-bullet tickets (NN-<slug>.md), already published
├── spec.md            # input: the parent specification
├── status.md          # run state: wave table, per-ticket status, cumulative usage
├── prompts/<NN>.md     # one self-contained worker prompt per ticket
├── logs/<NN>.json      # one agy result envelope per worker run
└── worktrees/<NN>/     # one git worktree + worker branch per ticket (gitignored)
```

## Stage 0 — Plan (read-only)

Follow [references/planning.md](references/planning.md). In short:

1. **Resolve the target** — an explicit dir or slug wins; with no argument, use
   the most recently modified `.scratch/*/issues/` directory and name it back to
   the user for confirmation before parsing.
2. **Parse** every ticket in the `to-tickets` local format, and read the parent
   `spec.md`, the feature `CONTEXT.md` / `adr/`, and the repo's own ADRs.
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
   exercises the ticket's acceptance criteria.
7. **Emit the Plan** — a wave table plus, per ticket: wave, estimated touch-set,
   serial/parallel proposal and reason, overlap flags, test seam, and retry
   budgets. The Plan has **no model column**. Pause for explicit approval, and
   mutate no file outside `.scratch/<feature-slug>/` until the user approves.

## Stage 1 — Execute (per wave, frontier order)

Once the Plan is approved, work each wave in frontier order. The orchestrator
dispatches every ticket to a worker and owns verification, skill routing, and
merge-conflict resolution; it writes implementation code itself only to resolve a
purely mechanical merge conflict. A ticket that no worker can finish within its
retry budget becomes `BLOCKED` and waits for a human.

### Preflight (once, before wave 0)

Per [references/worktree-integration.md](references/worktree-integration.md): a
target repository with uncommitted changes stops the run and asks — the run
stashes nothing. Then create or switch to the integration branch
`agy-implement/<feature-slug>` cut from `HEAD`, and add
`.scratch/<feature-slug>/worktrees/` to `.gitignore`.

### Dispatch one worker per ticket

Follow [references/agy-contract.md](references/agy-contract.md) and
[references/prompt-scaffold.md](references/prompt-scaffold.md). Cut the ticket's
worktree and worker branch from integration `HEAD`, write the self-contained
worker prompt to `.scratch/<slug>/prompts/<NN>.md`, and dispatch:

```bash
agy -p "$(cat .scratch/<slug>/prompts/<NN>.md)" --add-dir "<worktree>" \
  --output-format json --print-timeout 45m --disable-slash-commands \
  <permission mode> [--model <id>] > .scratch/<slug>/logs/<NN>.json 2>&1
```

The worker builds the ticket test-first and commits on its own worker branch.
Model is taken at dispatch time by round-robin over the run's model list — by
**dispatch order, not ticket number** — or `agy`'s default with no list, and
recorded in `status.md`. The worker prior art is captured verbatim in
[references/qwen-agent-skill.md](references/qwen-agent-skill.md).

A wave the user approved for parallel execution dispatches one background worker
per ticket, capped at the concurrency cap (default 4) with the rest queued; the
harness re-invokes the orchestrator as each finishes. A worker silent for a
configurable interval is flagged **possibly stalled** in `status`.

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
commit in ascending ticket-number order, ticking that ticket file's checkboxes
and setting its `Status:`; resolve a mechanical merge conflict on the main
thread and surface a design-encoding one; then run the full typecheck and test
suite on the integrated result before advancing.

## State, failure, and resume

Follow [references/status-and-resume.md](references/status-and-resume.md). Run
state lives in `.scratch/<feature-slug>/status.md` — the wave table, each
ticket's `{status, conversation_id, model, attempts, failover_attempts,
worker_branch, commit, usage}`, the integration branch ref, and cumulative
per-provider usage — updated as each ticket transitions.

A `BLOCKED` ticket halts only its own dependency branch: the in-flight workers
finish, passing work is integrated, and the run stops at the next frontier with a
report naming the blocked tickets, their reasons, the downstream tickets not
started, and the `/agy-implement continue` command. `continue` reconciles against
reality and rewinds before resuming.

## Stop — Handoff

When every ticket is integrated and the last wave's suite is green, print a
handoff and stop. Name the integration branch, confirm one commit per ticket,
give the per-provider token usage, and hand over the review commands:

```text
All <N> tickets integrated onto the integration branch
agy-implement/<feature-slug> — one commit per ticket, in dependency order.

Per-provider token usage:
  <provider>   in <…>  out <…>  total <…>
  ...

Review is a separate pass. In a fresh context:
/code-review agy-implement/<feature-slug>
/scrutinize
```

This skill hands off here. Running `/code-review` or `/scrutinize`, `git push`,
pull requests, and tracker updates stay the user's explicit decision — this run
does none of them.

## Constraints

- Keep `grill-to-tickets`, `engineering-workflow`, every `mattpocock/skills`-sourced
  file, and `skills-lock.json` exactly as they are — this skill is standalone by
  design (see `docs/decisions/0004-agy-implement-standalone.md`).
- Workers commit only on their own worker branch; the orchestrator commits only on
  the integration branch. Publishing — `git push`, pull requests, tracker
  mutations — happens only when the user explicitly asks.
- The orchestrator dispatches every ticket to a worker and writes implementation
  code itself only to resolve a mechanical merge conflict.
