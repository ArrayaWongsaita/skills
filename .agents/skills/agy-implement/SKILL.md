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

- `/agy-implement continue [slug]` — resume an interrupted run. Re-checks reality
  against git and the tickets' acceptance state, rewinds the integration branch
  to the last still-good commit when a committed ticket no longer verifies, then
  re-presents the Plan and re-dispatches from the frontier.
- `/agy-implement status [slug]` — report the wave table, each ticket's status,
  and any blockers, read-only.
- `/agy-implement list` — list runs discovered under `.scratch/*/status.md`,
  read-only.

Each sub-command's full behavior is specified alongside the stage it belongs to.

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

Once the Plan is approved, run the preflight in
[references/worktree-integration.md](references/worktree-integration.md), then
work each wave in frontier order. The orchestrator dispatches every ticket to a
worker and owns verification, skill routing, and merge-conflict resolution; it
writes implementation code itself only to resolve a purely mechanical merge
conflict. A ticket that no worker can finish within its retry budget becomes
`BLOCKED` and waits for a human.

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
Model is taken at dispatch time by round-robin over the run's model list (or
`agy`'s default with no list) and recorded in `status.md`. The worker prior art
is captured verbatim in
[references/qwen-agent-skill.md](references/qwen-agent-skill.md).

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

## Stop — Handoff

When every ticket is done, print the integration branch name, one-commit-per-ticket
confirmation, cumulative per-provider token usage, and the exact `/code-review`
and `/scrutinize` commands to run next in a fresh context. This skill hands off
here — review, `git push`, and pull requests stay the user's explicit decision.

## Constraints

- Keep `grill-to-tickets`, `engineering-workflow`, every `mattpocock/skills`-sourced
  file, and `skills-lock.json` exactly as they are — this skill is standalone by
  design (see `docs/decisions/0004-agy-implement-standalone.md`).
- Workers commit only on their own worker branch; the orchestrator commits only on
  the integration branch. Publishing — `git push`, pull requests, tracker
  mutations — happens only when the user explicitly asks.
- The orchestrator dispatches every ticket to a worker and writes implementation
  code itself only to resolve a mechanical merge conflict.
