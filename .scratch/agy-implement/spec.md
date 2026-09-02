# agy-implement — Specification

Feature slug: `agy-implement`. Glossary: [CONTEXT.md](CONTEXT.md). Decisions:
[adr/0001](adr/0001-standalone-not-engineering-workflow.md),
[adr/0002](adr/0002-orchestrator-never-implements.md),
[adr/0003](adr/0003-provider-distribution-is-the-purpose.md),
[adr/0004](adr/0004-tdd-mandatory-every-ticket.md). Prior research:
[DESIGN.md](DESIGN.md).

## Problem Statement

I have run `/grill-to-tickets` (or an equivalent) and have a directory of tracer-bullet
tickets under `.scratch/<feature-slug>/issues/`, each with a `Blocked by` edge list and
a checklist of acceptance criteria. Turning that ticket set into working code today
means driving `/implement` myself, one ticket per fresh context window. That is slow,
it spends my whole token budget on a single provider (so a big ticket set stalls when
that provider's quota or rate limit is hit), and the rigor of the work depends on my
attention that day rather than on a fixed method.

I want to hand the whole ticket directory to something that plans the order of work,
farms the actual implementation out across several LLM providers so no single provider's
quota is the bottleneck, runs genuinely independent tickets at the same time, forces
every ticket to be built test-first so I can trust the result, assembles the pieces into
one branch with one commit per ticket, and stops cleanly before review — resumable if it
gets interrupted.

## Solution

`/agy-implement .scratch/<feature-slug>/` (or a bare `<feature-slug>`; with no argument
it picks the most recent `.scratch/*/issues/` directory).

The main agent — the **orchestrator** — reads the ticket directory and the parent
`spec.md`, then works in two stages:

1. **Plan (read-only).** It parses the tickets into a dependency DAG, computes execution
   **waves**, predicts each ticket's file **touch-set**, marks which same-wave tickets
   are safe to run in parallel, assigns a model to each ticket by round-robin over an
   optional model list, and picks each ticket's **test seam** from the parent spec's
   Testing Decisions. It presents this **Plan** and changes no source until I approve it.

2. **Execute, wave by wave.** For each wave it dispatches one headless `agy` **worker**
   per ticket — serial tickets in the integration tree, parallel tickets each in their
   own `git worktree`. Every worker is told to build the ticket **test-first**. When a
   worker returns, the orchestrator runs the **verification gate** itself (re-runs the
   new tests, typechecks, inspects the test diff for quality). When every ticket in a
   wave passes, the **integration gate** merges the worktrees in ticket-number order,
   runs the full test suite, and commits one commit per ticket.

The orchestrator never implements a ticket itself; it only writes code to resolve merge
conflicts. When a ticket cannot be finished within its retry budget it becomes
`BLOCKED`, the running wave is allowed to finish, work that passed is integrated, and
the run stops at the next frontier with a report. `/agy-implement continue` resumes
after I clear the blocker.

When all tickets are done the skill prints a handoff: the integration branch name, a
per-provider token summary, and the commands to run `/code-review` and `/scrutinize` in
a fresh context. It does not run review, push, or open a PR.

## User Stories

### Invocation and planning

1. As a developer, I want to run `/agy-implement` against a ticket directory, so that I
   can implement a whole `grill-to-tickets` output in one command instead of one
   `/implement` per ticket.
2. As a developer, I want to pass just a feature slug or nothing at all, so that I do
   not have to type the full `.scratch/<slug>/issues/` path every time.
3. As a developer, I want the skill to refuse to start unless I invoked it explicitly
   (`/agy-implement` or `$agy-implement`), so that it never fires from a stray mention
   of tickets in conversation.
4. As a developer, I want the orchestrator to parse every ticket's `Blocked by` list
   into a dependency graph and reject the run if the graph has a cycle or names a
   missing ticket, so that I find a broken ticket set before any code is written.
5. As a developer, I want the orchestrator to group tickets into waves — each wave being
   every ticket whose blockers all landed in an earlier wave — so that the execution
   order is derived from the tickets, not guessed.
6. As a developer, I want the orchestrator to predict each ticket's touch-set (the files
   it will create or modify) from the ticket text, the parent spec, and a look at the
   codebase, and to show it in the Plan as an advisory hint — not an automatic gate — so
   that I can judge parallel-safety without the run depending on the accuracy of a
   pre-implementation guess.
7. As a developer, I want the Plan to flag same-wave tickets whose predicted touch-sets
   overlap or that touch a known cross-cutting file (router, DI container, root schema,
   migrations directory, `package.json`, lockfiles, shared config) as
   "likely-overlapping — consider serializing", so that I approve concurrency with the
   risk visible.
8. As a developer, I want to decide at Plan approval which flagged tickets to serialize
   and which to run in parallel anyway, so that the integration gate — not a heuristic —
   is the thing that guarantees correctness.
9. As a developer, I want a ticket that `to-tickets` sequenced as a wide-refactor
   expand-contract batch to run as ordered serial steps on the integration branch, so
   that the batch stays green step to step.
10. As a developer, I want the Plan to show, per ticket: its wave, predicted touch-set,
    serial/parallel disposition and why, assigned model, test seam, and retry budget,
    so that I can see exactly what will happen before approving.
11. As a developer, I want to approve or adjust the Plan — including choosing which
    waves actually run in parallel and editing the model assignment — before any source
    file is touched, so that I stay in control of concurrency and spend.
12. As a developer, I want the orchestrator to do nothing irreversible during planning,
    so that I can run the planning stage just to see the shape of the work.

### Provider distribution and models

13. As a developer, I want every worker to use `agy`'s own default model when I supply
    no model list, so that I never have to think about model selection to get a run
    going.
14. As a developer, I want to optionally pass a flat list of `agy` model ids at run
    start, so that a run can spread its tickets across several providers.
15. As a developer, I want tickets assigned to that list by plain round-robin (ticket in
    position N gets `list[N mod len]`), with no reasoning about which ticket suits which
    model, so that model assignment can never be the thing that goes wrong.
16. As a developer, I want provider distribution to be the stated reason workers exist,
    so that anyone reading the skill understands round-robin and failover are there to
    protect provider quota, not to chase the cheapest or fastest model.
17. As a developer, I want a worker whose provider rate-limits, times out, or crashes to
    be re-run on the next model in the list (or the same default again if there is no
    list), so that a provider outage does not fail the ticket.
18. As a developer, I want provider failover to have its own budget (default 3), separate
    from the verification-failure budget, so that infrastructure flakiness does not eat
    the ticket's real retry attempts.
19. As a developer, I want a per-provider breakdown of token usage in the final report,
    so that I can see how the run's spend was actually distributed.

### Workers and test-driven implementation

20. As a developer, I want each ticket handed to exactly one worker as a fully
    self-contained prompt — absolute paths, the ticket's "What to build" and acceptance
    criteria verbatim, the relevant sections of the parent spec, the ADRs in the
    ticket's area, the domain glossary, and the assigned test seam — so that a worker
    with zero conversation context can still do the ticket correctly.
21. As a developer, I want every worker prompt to carry the full red-green-refactor
    protocol inline, so that the method does not depend on the worker's environment
    having a TDD skill.
22. As a developer, I want workers run with slash-command expansion disabled, so that a
    ticket body containing a token like `/implement` cannot trigger anything inside the
    worker.
23. As a developer, I want every ticket implemented test-first with no exceptions — the
    worker writes the failing test at the assigned seam, observes it fail, writes
    minimal code to pass, then refactors — so that each ticket ships with a test that
    actually measures its acceptance criteria.
24. As a developer, I want a ticket that cannot be exercised by an isolated test to be
    sent back for replanning rather than implemented without a test, so that
    "untestable" surfaces as a decomposition problem instead of a silent gap.
25. As a developer, I want each worker's structured return to include the pre-implementation
    failing-test output, the post-implementation passing output, the list of files it
    changed, and a table mapping each new test to the acceptance criterion it covers, so
    that the orchestrator can check the work without re-deriving it.
26. As a developer, I want the orchestrator to reproduce the red state itself — set the
    ticket's non-test changes aside, run the new test files, confirm they fail, restore —
    so that the "test-first" guarantee does not rest on the worker's pasted output.
27. As a developer, I want the orchestrator to select each ticket's test seam at
    planning, using the parent spec's Testing Decisions as the primary input wherever
    they constrain it, and to show every seam in the Plan, so that workers are handed a
    fixed seam and never invent their own.
28. As a developer, I want workers to touch only what their ticket needs and to stop and
    report if a required decision is missing from the spec rather than guessing, so that
    scope creep and invented requirements are caught early.
29. As a developer, I want a worker that needs a new third-party dependency to stop and
    report it rather than run a package install, so that the shared lockfile is never
    mutated by a worker and a new dependency is a deliberate planning decision.
30. As a developer, I want to choose how workers run unattended — sandboxed with
    auto-accepted edits by default, or with permissions skipped but confined to a git
    worktree when I opt in per run — so that an unattended worker's blast radius is
    bounded.
31. As a developer, I want at most a configurable number of workers running at once
    (default 4), with extra tickets queued, so that a wide wave does not overwhelm my
    machine or my spend.

### Verification and integration

32. As a developer, I want the orchestrator — not the worker — to run every ticket's
    verification: reproduce the red state, re-run the new tests green, run a typecheck,
    and check the test diff for vacuous or tautological assertions and for full coverage
    of the acceptance criteria, so that I am trusting my own agent's check and not the
    worker's word.
33. As a developer, I want a verification failure (tests missing, not actually red first,
    still red, vacuous, or not covering the criteria) to send the ticket back to the
    same worker with the failure detail via a resumed conversation, up to 3 attempts, so
    that fixes are targeted and cheap.
34. As a developer, I want a ticket that fails verification 3 times to become `BLOCKED`
    with the failure output recorded and its worktree kept, so that I can inspect
    exactly what went wrong.
35. As a developer, I want each verified ticket's worker branch squash-merged into one
    integration branch as exactly one commit, in ticket-number order, so that "one
    commit per ticket in dependency order" is guaranteed by integration and not by
    worker discipline.
36. As a developer, I want that squash commit to also tick the ticket file's acceptance
    checkboxes and set its status, so that the ticket files stay an accurate record.
37. As a developer, I want the orchestrator to resolve any merge conflict itself on the
    main thread — never a worker — and, when a conflict encodes a design decision
    (which module owns a shared contract), to stop and surface that decision rather than
    choose it silently, so that the "orchestrator never implements" boundary holds even
    at integration.
38. As a developer, I want the full typecheck and test suite run on the integrated
    result after every wave, so that a wave is never "done" until everything still
    passes together.
39. As a developer, I want workers to commit freely on their own worker branch but never
    push or open a PR, and the integration branch never pushed, so that publishing stays
    my explicit decision.
40. As a developer, I want a preflight check that the target repository has no
    uncommitted changes and is on (or can create) the integration branch, stopping to
    ask if the tree is dirty, so that the run never mixes with or stashes my existing
    work.

### Failure, state, and resume

41. As a developer, I want a blocked ticket to stop only the branch of work that depends
    on it — the currently running wave finishes, everything that passed is integrated,
    and the run halts at the next frontier — so that one bad ticket does not waste the
    workers already in flight.
42. As a developer, I want the halt report to name which tickets are blocked, why, and
    which downstream tickets are therefore not started, so that I know exactly what to
    fix.
43. As a developer, I want run state — the wave table, each ticket's status,
    conversation id, attempts, worker branch, commit, and token usage, plus the
    integration branch ref and cumulative usage — persisted to `.scratch/<slug>/status.md`,
    so that a crash or a closed session loses nothing.
44. As a developer, I want `/agy-implement continue` to re-check reality before trusting
    that state — git status, the worktrees, and each ticket's acceptance checks — and,
    when a committed ticket no longer verifies, to reset the integration branch to the
    last still-good commit, discard the worktrees for invalidated tickets, list the
    discarded commits in the report, and re-dispatch from there, so that resuming after
    I have hand-edited things is safe and its blast radius is visible.
45. As a developer, I want `/agy-implement status` and `/agy-implement list` to report
    progress compactly without mutating anything, so that I can check in on a run
    read-only.
46. As a developer, I want a worker that produces no output for a long time to be
    flagged as possibly stalled in `status`, so that a hung provider call does not sit
    invisible until timeout.

### Boundaries

47. As a developer, I want `agy-implement` to work without modifying `grill-to-tickets`
    or `engineering-workflow`, so that it is a drop-in alternative to the `/implement`
    line in the `grill-to-tickets` handoff.
48. As a developer, I want the skill to carry its own copy of the planning, worktree,
    verification, and TDD logic, so that a future `qwen-implement` or `codex-implement`
    sibling can diverge from it freely.
49. As a developer, I want the final handoff to hand me the integration branch name and
    the exact `/code-review` and `/scrutinize` commands to run next in a fresh context,
    so that review stays a separate, clean pass.

## Implementation Decisions

### Skill shape

- **Name** `agy-implement`. Location `skills/agents/agy-implement/`, mirrored to
  `.agents/skills/agy-implement/`. Human guide at `docs/skills/agents/agy-implement.md`
  per repo convention.
- **Invocation** explicit only: `/agy-implement <dir|slug>` (universal/slash),
  `$agy-implement <dir|slug>` (Codex). Frontmatter `disable-model-invocation: true`;
  ship `agents/openai.yaml` with `allow_implicit_invocation: false`, matching
  `grill-to-tickets`, `to-spec`, `to-tickets`, `implement`.
- **Sub-commands** `continue [id]`, `status [id]`, `list` — mirroring
  `engineering-workflow`.
- **Pure prompt, no scripts.** All parsing, DAG/wave computation, round-robin, and
  touch-set estimation are done by the orchestrator following prose instructions, as in
  `engineering-workflow`'s zero-script control plane. `references/` holds the detailed
  procedures; `SKILL.md` holds the workflow.
- **Argument resolution**: an explicit dir or slug wins; with no argument, the most
  recently modified `.scratch/*/issues/` directory is used and named back to the user
  for confirmation before planning.

### Input contract

- Reads `.scratch/<feature-slug>/issues/<NN>-<slug>.md` files in the `to-tickets` local
  format: `# NN: title`, `**What to build:**`, `**Blocked by:**` (numbers/titles or
  "None (can start immediately)"), `**Status:**`, and `- [ ]` acceptance checkboxes.
- Reads the parent `.scratch/<feature-slug>/spec.md` (for Implementation Decisions,
  Testing Decisions, seams), `CONTEXT.md`, and `adr/` in the feature directory and the
  repository.
- v1 accepts feature ticket sets only. Bug-fix ticket sets are out of scope; wide-refactor
  expand-contract sequences are accepted but run as ordered serial steps with no special
  optimization.

### Stage 0 — Plan (read-only)

- Parse tickets → dependency DAG. Validate acyclic, all blockers resolvable, numbering
  consistent with a topological order. A validation failure stops the run with the
  specific broken ticket named.
- Compute waves: wave 0 = tickets with no blockers; wave K = tickets whose blockers are
  all in waves < K. Within a wave, tickets with no `Blocked by` edge between them are
  parallel candidates.
- Estimate each ticket's touch-set from ticket text + parent spec + a codebase look.
  This is an **advisory hint, not a gate**: same-wave parallel candidates whose estimated
  touch-sets overlap, or that touch a cross-cutting file (configurable list; defaults:
  router / route table, DI container, root ORM schema, migrations directory,
  `package.json`, lockfiles, CI config, shared env/config modules), are flagged in the
  Plan as "likely-overlapping — consider serializing". The user decides at Plan approval;
  the default suggestion is to serialize a flagged pair.
- Assign a test seam per ticket: the orchestrator selects it at planning, using the
  parent spec's Testing Decisions as the primary input wherever they constrain it. Every
  seam is shown in the Plan.
- Emit the **Plan**: wave table + per-ticket {estimated touch-set, parallel/serial
  proposal + reason, overlap flags, test seam, retry budgets}. Model is not assigned
  here — see Stage 1. Pause for explicit approval. No source mutation before approval.
- `continue` re-presents the Plan (reconciled against reality) before resuming execution.

### Stage 1 — Execute (per wave, frontier order)

- **Preflight** (once, before wave 0): target repo has no uncommitted changes; create or
  switch to the integration branch `agy-implement/<feature-slug>`. Dirty tree → stop and
  ask; never auto-stash.
- **Worktrees.** Every ticket — serial or parallel — is worked on its own worker branch
  `agy-implement/<slug>/<NN>` in its own `git worktree` under
  `.scratch/<slug>/worktrees/<NN>`, cut from the current integration HEAD.
  `.scratch/<slug>/worktrees/` is added to `.gitignore`. Serial tickets use one worktree
  at a time; a parallel wave creates one per ticket, concurrency capped (default 4,
  editable in the Plan), excess tickets queued.
- **Worktree dependencies.** Each worktree reuses the primary checkout's installed
  dependencies by symlink (`node_modules`, and the equivalent for other ecosystems);
  workers are forbidden from running package installs (story 29). A ticket that needs a
  new dependency stops and is replanned.
- **Model assignment** happens at **dispatch time**, not at planning: each time a worker
  slot starts, it takes the next model from the run's list by round-robin over dispatch
  order; with no list, `agy`'s default. No per-ticket model reasoning (adr/0003). The
  assignment is recorded in `status.md` and reported.
- **Worker invocation**: `agy -p "<prompt file>" --add-dir <worktree> --output-format
  json --print-timeout <generous, default 45m> --disable-slash-commands` plus the
  approved permission mode — default `--sandbox --mode accept-edits`; opt-in alternative
  `--dangerously-skip-permissions` confined to the worktree. `--model` is passed only
  when the run has a model list. The worker's working directory is its worktree; every
  path in the prompt is absolute.
- **Worker prompt** (`.scratch/<slug>/prompts/<NN>.md`): working directory; "What to
  build" verbatim; acceptance criteria verbatim; relevant parent-spec sections; relevant
  ADRs; domain glossary; assigned test seam; the full red-green-refactor protocol;
  constraints (touch only what the ticket needs; do not refactor unrelated code; commit
  your work on this worker branch but do not push or open a PR; do not run package
  installs; do not scan the repo; stop and report a missing decision rather than guess);
  required return format (red output, green output, changed files, test→criterion table).
- The harness re-invokes the orchestrator as each background worker finishes; the
  orchestrator parses `.scratch/<slug>/logs/<NN>.json`.

### Worker result envelope

`agy --output-format json` returns
`{conversation_id, status, response, duration_seconds, num_turns, usage:{input_tokens,
output_tokens, thinking_tokens, cache_read_tokens, total_tokens}}` (shape confirmed by a
probe; `status: "SUCCESS"` observed). The orchestrator keys off `status` (success vs
failure/timeout — *provisional: the exact failure/timeout tokens are confirmed by
validation probe 1 before shipping*), reads `response` for the structured return, resumes
a worker for a retry via `agy --conversation <conversation_id> -p "<feedback>"`, and
rolls `usage` into `status.md` per provider.

### Verification gate (orchestrator, per ticket, in the ticket's worktree)

1. `status` is a success value; the return contains red output, green output, and the
   test→criterion table.
2. **Reproduce red.** From the worker branch's return, split changed files into tests and
   implementation. On a scratch checkout at the pre-ticket integration HEAD, apply only
   the test files, run them, and confirm they fail for the expected reason (not a
   compile/import error). A test that passes without the implementation, or fails only to
   compile, is a verification failure.
3. Every acceptance criterion maps to at least one new test; no test is vacuous or
   tautological.
4. Re-run the ticket's new/changed tests green; typecheck passes.
5. Any failure → resumed-conversation retry with the specific failure, `MAX_TICKET_ATTEMPTS
   = 3`. Attempt 3 failure → `BLOCKED (TICKET_VERIFICATION_FAILED)`, worktree kept,
   failure output in `status.md`.
6. Provider/infra failure (rate-limit, timeout, crash) → `Failover` to the next model
   (or same default), separate budget `MAX_FAILOVER_ATTEMPTS = 3`, not counted against
   attempt 3.

### Integration gate (orchestrator, per wave)

1. **Squash-merge** each verified ticket's worker branch into the integration branch as
   exactly one commit, in ascending ticket-number order. The squash commit message names
   the ticket; the same commit ticks that ticket file's acceptance checkboxes and sets
   `Status:` done. "One commit per ticket" is an integration property, not a worker rule.
2. Merge conflict → the orchestrator resolves it on the main thread. If the conflict
   encodes a design decision (which module owns a shared contract, which schema shape
   wins), the orchestrator stops and surfaces that decision rather than choosing it —
   the affected tickets return to Stage 0 planning.
3. Full typecheck + full test suite on the integrated result. Green → `git worktree
   remove` the wave's worktrees and advance. Red → identify the culprit ticket, retry it
   (verification budget) or `BLOCKED`.

### Orchestrator boundaries (adr/0002)

- The orchestrator dispatches every ticket. It writes code only to resolve merge
  conflicts that are purely mechanical. It also owns verification, skill routing, and
  the Plan.
- A merge conflict that encodes a design decision (module ownership, contract shape) is
  not resolved silently — the orchestrator stops and surfaces the decision.
- A ticket no worker can complete within budget is `BLOCKED` — the orchestrator does not
  implement it to "rescue" the run.

### Failure and partial delivery

- A `BLOCKED` ticket halts only its dependency branch. The running wave's in-flight
  workers are allowed to finish; passing work is integrated; the run then stops at the
  next frontier.
- Halt report: blocked tickets + reasons + the downstream tickets not started + the
  `continue` command.

### State and resume

- `.scratch/<feature-slug>/status.md`: wave table; per-ticket `{status, conversation_id,
  model, attempts, failover_attempts, worker_branch, commit, usage}`; integration branch
  ref; cumulative per-provider usage. Updated as each ticket transitions.
- No per-turn state-header block (unlike `engineering-workflow`).
- `continue` performs Reality reconciliation: re-check git refs, worktrees, and each
  committed ticket's acceptance checks before trusting recorded status. When a committed
  ticket no longer verifies, **rewind**: reset the integration branch to the last commit
  whose ticket still verifies, discard the worktrees for the invalidated tickets, list
  every discarded commit at the top of the report, and re-dispatch from that point. Then
  re-present the Plan.
- `status` / `list` are read-only.

### Handoff (on completion)

Print: integration branch name; one commit per ticket confirmed; cumulative per-provider
token usage; and the exact next commands —
`/code-review` from the integration branch's merge-base, then `/scrutinize` for a
system-level pass — to run in a fresh context. No review, push, or PR from this skill.

### Constraints

- Do not modify `grill-to-tickets`, `engineering-workflow`, any `mattpocock/skills`-sourced
  file, or `skills-lock.json`.
- Workers commit only on their own worker branch; the orchestrator commits only on the
  integration branch. Nothing is pushed. PRs and tracker mutations are not part of this
  skill and happen only if the user explicitly asks.
- Each provider sibling (`agy-implement`, future `qwen-implement`, …) owns a full copy of
  the shared machinery in v1; a shared-`references/` refactor is a deferred follow-up.

### Rejected alternatives

- **Serial-only v1 (round-robin, no worktrees, no integration gate).** It delivers the
  stated purpose — provider distribution (adr/0003) — in full, at roughly 30% of the
  mechanism. Rejected for v1 because throughput on a large ticket set matters to the
  owner from day one (Q6), and because the worktree/branch isolation is also what makes
  per-ticket TDD verification (adr/0004) clean — a serial worker mutating the live tree
  makes "reproduce red for this ticket only" harder. Adding parallelism later would mean
  reworking the execution core rather than extending it. The trade-off is accepted:
  parallelism is best-effort, and the integration gate is the correctness guarantee.
- **Per-ticket model matching by weight / complexity / a capability floor.** Rejected in
  discovery (adr/0003) — choosing a model per ticket was the error-prone part, not
  having several models. Round-robin over a flat list, or the single `agy` default, is
  the whole of model selection.
- **Touch-set prediction as a hard parallel-safety gate.** Downgraded to an advisory
  hint (finding 6): a pre-implementation LLM guess is not reliable enough to gate on,
  and the integration gate catches the same collisions deterministically.

## Testing Decisions

### What makes a good test here

`agy-implement` is a prompt document with no executable code, so its tests exercise
**external behavior only**: given a scenario (a ticket directory + a parent spec + a
described environment), does the orchestrator produce the right *Plan* and the right
*routing decisions*, expressed as text. Tests never assert on wording, only on
observable choices: wave membership, serial-vs-parallel disposition, which ticket is
blocked, whether it halts vs continues, whether it mutates source before approval,
whether it ever implements a ticket itself.

### The single seam

The **eval harness** is the one and only seam. Scenarios are fed to `SKILL.md` and the
orchestrator's response is checked against expectations. There is no lower seam because
there is no script to unit-test (zero-script control plane). Any behavior that cannot be
observed at this seam (real `agy` subprocess behavior, real `git worktree` mechanics) is
covered by the manual validation checklist in Further Notes, not by an eval.

### Modules under test

- `evals/trigger-evals.json` — query / `should_trigger` pairs. `/agy-implement` and
  `$agy-implement` trigger (`true`); bare mentions of tickets, implementation, or a
  sibling skill, and generic "implement this" requests, do not (`false`), consistent
  with `disable-model-invocation: true`.
- `evals/evals.json` — prompt / `expected_output` / `expectations`, one case per
  decision branch:
  1. Pure linear chain — one ticket per wave, all serial, straight through.
  2. One parallel wave — edge-free tickets with disjoint estimated touch-sets dispatched
     together with no overlap flag.
  3. Overlap hint — two edge-free tickets with overlapping estimated touch-sets are
     flagged "likely-overlapping" in the Plan with a serialize suggestion, but the run
     still parallelizes them if the user approves that.
  4. Cross-cutting file — a ticket touching the router is flagged in the Plan.
  5. Model assigned at dispatch, not planning — the Plan shows no model column; models
     appear in `status.md` as workers start.
  6. No source mutation before Plan approval.
  7. Orchestrator never implements — a hard ticket goes `BLOCKED`, not hand-coded.
  8. Design-encoding merge conflict — orchestrator stops and surfaces the decision, does
     not resolve it silently.
  9. Verification failure ×3 → `BLOCKED (TICKET_VERIFICATION_FAILED)`.
  10. Provider failover does not consume the verification budget.
  11. Vacuous-test rejection — a worker return with `expect(true).toBe(true)` fails
      verification.
  12. Fabricated / not-actually-red test — orchestrator's own red reproduction fails, so
      the ticket fails verification.
  13. Missing test→criterion coverage fails verification.
  14. Blocked ticket halts only its branch; independent waves already running finish and
      integrate.
  15. Resume after a crash mid-wave — reconciliation rewinds the integration branch to
      the last still-good commit and lists the discarded commits.
  16. Dirty target tree at preflight → stop and ask, no stash.
  17. No model list → every worker uses `agy` default; with a list → round-robin over
      dispatch order.
  18. Wide-refactor sequence runs as ordered serial steps.
  19. Worker attempts a package install → stops and is replanned; lockfile untouched.
  20. Completion handoff names the integration branch and the `/code-review` +
      `/scrutinize` commands, and does not push or open a PR.

### Prior art

`skills/agents/grill-to-tickets/evals/` and `skills/agents/engineering-workflow/evals/`
— same two-file shape (`trigger-evals.json`, `evals.json`), run on demand through
`skill-creator`'s existing eval tooling with no change to that tooling. `grill-to-tickets`
issue `02-add-eval-suite.md` is the closest template for the case list.

## Out of Scope

- Running `/code-review` or `/scrutinize` — handed off, not performed.
- `git push`, pull requests, and any issue-tracker mutation.
- Bug-fix ticket sets and incident flows.
- Any special optimization of wide-refactor expand-contract sequences beyond running
  them as ordered serial steps.
- Touch-set prediction as a hard parallel-safety gate — it is an advisory hint only
  (finding 6).
- Automatic parallelization of touch-set-flagged tickets without the user's approval.
- Wiring `agy-implement` into `engineering-workflow` as its `IMPLEMENTATION` delegate.
- Extracting shared machinery into a common `references/` bundle or a base skill + worker
  adapter (deferred follow-up).
- A native-subagent (Task tool) worker adapter, or adapters for any provider CLI other
  than `agy`.
- Per-ticket model selection by complexity, weight, or a capability floor (explicitly
  cut — adr/0003).
- Generating the tickets — that is `grill-to-tickets` / `to-tickets` upstream.
- Modifying `grill-to-tickets`, `engineering-workflow`, `mattpocock/skills` files, or
  `skills-lock.json`.

## Further Notes

### Manual validation checklist (run during implementation, before shipping)

These verify assumptions about the `agy` CLI that the eval seam cannot reach. They
change parameter values in the spec, not its shape.

1. **`agy` failure envelope** — run `agy -p` with an impossible task and a short
   `--print-timeout`; record the `status` value(s) for failure and timeout. Feeds the
   verification gate and Failover logic.
2. **`--sandbox` capability** — in a throwaway worktree, `agy --sandbox --mode
   accept-edits -p "run the test suite and report pass/fail"`; confirm the sandbox
   permits the project's typecheck/test commands. Decides whether `--sandbox` +
   `accept-edits` can be the default or the run must fall back to worktree-confined
   `--dangerously-skip-permissions`.
3. **`--conversation` retry** — one task, then `agy --conversation <id> -p "<follow-up>"`;
   confirm context carries and the second envelope is well-formed. Feeds the
   verification-retry loop.
4. **`--json-schema`** — enforce a `{verdict, files[], red, green, coverage[]}` schema on
   the final result; confirm `response` obeys it. If reliable, the worker return format
   becomes a schema instead of a prose convention.
5. **Two real parallel worktrees** — take two edge-free tickets from an existing
   `.scratch/*/issues/`, run two background workers in two worktrees, dry-run the merge;
   observe what actually collides. Validates the touch-set / cross-cutting-file list.
6. **`stream-json` progress** — confirm the event stream from `agy --output-format
   stream-json`, for the stall-detection flag in `status`.

### Deferred follow-ups

- Shared-machinery refactor once a second sibling exists (adr/0001 trade-off).
- `engineering-workflow` `IMPLEMENTATION`-delegate wiring, if `engineering-workflow`
  survives.
- Native-subagent worker adapter.

### Relationship to prior art

`qwen-agent` (9arm, captured in `qwen-agent-skill.md`) is the single-task delegation
primitive this skill's worker dispatch is modeled on: self-contained prompt, verify the
result yourself, background-redirect for parallel jobs. `agy-implement` wraps a planning
and integration control plane around a fleet of those dispatches. See `DESIGN.md` §4 for
the point-by-point mapping.
