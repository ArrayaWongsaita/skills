# opencode-implement → hosted-model, wave/parallel — Specification

Feature slug: `opencode-implement-hosted-model`. This spec describes the target
end-state of the **existing** `opencode-implement` skill after this change lands
— it is a migration spec, not a new skill. Glossary:
[CONTEXT.md](CONTEXT.md). New decisions:
[adr/0001](adr/0001-hosted-only.md),
[adr/0002](adr/0002-whole-ticket-wave-parallel.md),
[adr/0003](adr/0003-fallback-tier-retained.md),
[adr/0004](adr/0004-cost-disclosure-and-no-failover.md).
Unchanged decisions carried over from `.scratch/opencode-implement/adr/`:
[0001-standalone-sibling](../opencode-implement/adr/0001-standalone-sibling.md),
[0002-orchestrator-never-implements](../opencode-implement/adr/0002-orchestrator-never-implements.md),
[0004-tdd-mandatory](../opencode-implement/adr/0004-tdd-mandatory.md).
Superseded: [0003](../opencode-implement/adr/0003-local-execution-is-the-purpose.md),
[0005](../opencode-implement/adr/0005-serial-execution-parallel-is-a-non-goal.md),
[0006](../opencode-implement/adr/0006-context-fit-decomposition.md). Amended:
[0007](../opencode-implement/adr/0007-automatic-native-subagent-fallback.md).

## Problem Statement

`opencode-implement` was built around a local, 27B Ollama model: weak, slow, and
boxed into a 32k-token window, which forced criterion-level decomposition, serial
dispatch, and a "zero-cost, private" pitch. I have stopped using local models in
`opencode` entirely — I now run a hosted model (DeepSeek V4.1 Flash, via a hosted
`opencode`-compatible gateway) — and the local-specific machinery is now dead
weight: decomposition exists to dodge a window size that no longer applies,
serial-only dispatch exists to dodge a concurrency limit that no longer applies,
and the whole "cost: 0" framing is now simply wrong, since every ticket on the
main path spends real money.

At the same time, I don't want to lose two things this skill still gets right
that `agy-implement` (the sibling built for hosted, multi-provider work) doesn't
have: an automatic escape hatch when the chosen model genuinely can't deliver a
ticket, and the discipline of staying on exactly one deliberately-chosen model
per run rather than routing across a pool. I want the skill's execution
shape — wave computation, touch-set/overlap estimation, parallel dispatch across
worktrees — to converge with `agy-implement`'s, because that shape is what a fast
hosted model deserves, while `opencode` (not `agy`) stays the delegate CLI and the
fallback tier stays intact.

I also don't want to hardcode a new "the right model" the way `ollama/qwen3.8:
27b-mlx-32k` was hardcoded before. I want the skill to trust whatever model
`opencode` itself resolves — its own config, or the last one I selected — so
switching models is something I do in `opencode`, not something I have to
remember to also tell this skill about.

## Solution

`/opencode-implement .scratch/<feature-slug>/` (or a bare `<feature-slug>`; with
no argument it picks the most recently modified `.scratch/*/issues/` directory
and names it back for confirmation) — invocation, sub-commands, and feature-scoped
storage layout are unchanged from today.

The main agent — the **orchestrator** — reads the ticket directory and the
parent `spec.md`, then works in two stages, now shaped like `agy-implement`'s:

1. **Plan (read-only).** Parse tickets into a dependency DAG; validate it
   (acyclic, blockers resolvable, numbering consistent with a topological
   order) or halt naming the specific broken ticket. **Compute execution
   waves** (wave 0 = no blockers; wave K = every blocker landed in an earlier
   wave). **Estimate each ticket's touch-set** as an advisory hint and flag
   `likely-overlapping — consider serializing` same-wave pairs. Select each
   ticket's **test seam** from the parent spec's Testing Decisions. Emit the
   **Plan**: a wave table with, per ticket, its touch-set estimate, a
   serial/parallel proposal, overlap flags, its test seam, and retry budgets —
   **no model column** (one resolved model serves the whole run) and **no
   step-plan / sub-step column** (decomposition is gone). Pause for explicit
   approval; nothing outside `.scratch/<feature-slug>/` is touched before then.

2. **Execute, wave by wave, frontier order.** Once approved:
   - **Resolve the run's model once, before wave 0, and pin it.** If the user
     passed `--model` at invocation, that value is used. Otherwise, dispatch
     one resolution check with no `--model` flag so `opencode run` resolves
     its own model (its config, then the last model it used, then its internal
     default), read the resolved value back off `opencode models` (or the
     first event stream), and **capture it**. From that point on, every
     worker for the rest of the run — including every parallel worker in every
     later wave — is dispatched with that captured value as an explicit
     `--model` flag. The skill never re-resolves mid-run: without this, a
     model change in the user's own `opencode` session (or any other process
     on the same machine) between ticket dispatches would silently split one
     run across two different models. The resolved model is recorded in the
     Plan and `status.md` before wave 0 starts.
   - **Dispatch.** Serial tickets (a dependency edge, or a flagged pair the
     user chose to serialize) reuse one worktree slot at a time. A wave
     approved for parallel execution dispatches one background `opencode run`
     **worker** per independent ticket at once, each in its own worktree, up to
     a **concurrency cap** (default 4, editable in the Plan); queued tickets
     start as slots free. Every worker builds its **whole ticket** test-first
     in one dispatch — there is no sub-step chain.
   - **Verification gate (orchestrator, per ticket).** Reproduce the ticket's
     red state at the pre-ticket integration `HEAD`, re-run the new tests
     green, run the typecheck, check test coverage and non-vacuity — unchanged
     from today. A failure **resumes the same `opencode` session**
     (`opencode run -s <session>` with the specific failure as the next turn),
     up to `MAX_TICKET_ATTEMPTS = 3`.
   - **Fallback (automatic, unchanged mechanism — reframed reason).** A ticket
     whose verification budget is exhausted, whose `opencode` failures exhaust
     `MAX_OPENCODE_RETRIES = 3`, or that is too large even for the resolved
     model's window, escalates automatically (no approval pause) to one native
     subagent for the whole ticket, from a clean worker branch. `--opencode-only`
     (renamed from `--no-fallback` / `--strict-local`) suppresses this and
     `BLOCKED`s instead.
   - **Integration gate, as each ticket clears — not gated on the whole
     wave.** A ticket that escalates to fallback does **not** hold up its
     wave-mates: every other ticket in the wave that passes verification is
     squash-merged in ascending ticket-number order as soon as it's ready,
     with the full suite run on that integrated result, the same "everything
     that passed is integrated" precedent `agy-implement` already uses for a
     `BLOCKED` ticket. The wave only advances to the next one once every
     ticket in it has reached a terminal state (integrated, fallback-verified
     and integrated, or `BLOCKED`); a ticket still inside the fallback tier
     integrates on its own, cut from whatever integration `HEAD` exists at
     the moment it finishes — which may already include its former wave-mates'
     work.

The orchestrator never implements a ticket itself. A ticket neither path can
finish within budget becomes `BLOCKED`; it halts only its own dependency branch,
everything else that passed is integrated, and the run stops at the next
frontier with a report. `/opencode-implement continue` resumes after the
blocker is cleared.

On completion the skill prints a handoff — the integration branch name,
one-commit-per-ticket confirmation, **cumulative token usage for both paths**
(`tokens.main` for the `opencode` path, now real spend; `tokens.fallback`
unchanged), and the `/code-review` + `/scrutinize` commands to run next in a
fresh context. It still runs no review, no `git push`, and opens no PR.

## User Stories

### Invocation and planning (unchanged from today)

1. As a developer, I want to run `/opencode-implement` against a ticket
   directory, so that I can implement a whole `grill-to-tickets` output in one
   command instead of one `/implement` per ticket.
2. As a developer, I want to pass just a feature slug or nothing at all.
3. As a developer, I want the skill to refuse to start unless invoked
   explicitly.
4. As a developer, I want the dependency graph validated (cycle, missing
   blocker, bad numbering) before any code is written.
5. As a developer, I want the orchestrator to compute the dependency order
   from the graph, not guess it.
6. As a developer, I want each ticket's test seam selected at planning from
   the parent spec's Testing Decisions and shown in the Plan.
7. As a developer, I want a ticket whose acceptance criteria cannot be
   exercised by an isolated test at any seam sent back for replanning.
8. As a developer, I want planning to be read-only.
9. As a developer, I want to approve or adjust the Plan before any source
   file is touched.

### Wave planning and parallel dispatch (new — replaces "Context-fit decomposition")

10. As a developer, I want the orchestrator to compute execution waves from
    the dependency DAG (wave 0 = no blockers; wave K = all blockers landed
    earlier), the same algorithm `agy-implement` uses, so that independent
    tickets are identified as candidates for concurrent execution instead of
    forced into a single serial chain.
11. As a developer, I want each ticket's touch-set estimated as an advisory
    hint at planning, and a `likely-overlapping — consider serializing` flag
    raised for an independent same-wave pair whose estimates intersect or
    either of which touches a cross-cutting file (router, DI container, root
    schema, migrations, `package.json`/lockfiles, CI config, shared config),
    so that I can decide at Plan approval which flagged pairs to serialize —
    the integration gate remains the correctness guarantee either way.
12. As a developer, I want independent tickets in a wave the Plan approved for
    parallel execution dispatched as concurrent background workers, one
    worktree each, capped at a **concurrency cap** (default 4, editable),
    with queued tickets starting as slots free, so that a fast hosted model's
    throughput isn't wasted on artificial serialization.
13. As a developer, I want a worker that writes no output for a configurable
    stall interval flagged `possibly stalled` in status, per worker, so that
    one stuck concurrent worker is visible without blocking the others.
14. As a developer, I want a wide-refactor expand–contract ticket sequence to
    run as ordered waves (expand | migrate batches | contract) with the
    integration gate at every wave boundary, with no refactor-specific
    handling beyond honoring that order.

### Hosted workers and TDD (revised — replaces "Local workers and TDD")

15. As a developer, I want each ticket handed to exactly one `opencode run`
    worker as a fully self-contained, whole-ticket, test-first prompt —
    absolute paths, the "What to build" text and every acceptance criterion
    verbatim, the relevant parent-spec sections and ADRs, the domain glossary,
    the assigned test seam, and the full red-green-refactor protocol — so that
    a worker with zero conversation context can do the whole ticket in one
    dispatch.
16. As a developer, I want workers run with a ticket-body token like
    `/implement` inert, and run unattended with edits and the project's
    test/typecheck commands auto-approved but confined to the ticket's git
    worktree.
17. As a developer, I want the run's model resolved exactly **once**, before
    wave 0 — either the `--model` I gave at invocation, or whatever
    `opencode run` resolves on its own with no flag — confirmed via `opencode
    models` and shown in the Plan, then **pinned**: every worker for the rest
    of the run, in every wave, is dispatched with that same captured value as
    an explicit `--model` flag, so a model switch elsewhere on the machine
    mid-run can't silently split one run across two models.
18. As a developer, I want the orchestrator to parse `opencode`'s
    newline-delimited JSON event stream defensively, keying success off a
    final `step_finish` with `reason: "stop"` and a zero exit code, and
    treating an `error` event, a non-zero exit, a missing `step_finish`, a
    timeout, or a stall as a worker failure distinct from a verification
    failure — unchanged from today.
19. As a developer, I want the three worker timeouts (`FIRST_EVENT_TIMEOUT`,
    `STALL_INTERVAL`, `WORKER_TIMEOUT`) recalibrated against the resolved
    hosted model doing whole-ticket work, not left at values calibrated for a
    slow local model doing single-criterion sub-steps — both the workload
    shape and the model's speed changed.
20. As a developer, I want each worker's structured return to include the
    pre-implementation failing-test output, the post-implementation passing
    output, the changed-files list, and a table mapping each new test to the
    acceptance criterion it covers — unchanged from today.
21. As a developer, I want workers to touch only what the ticket needs, stop
    and report a missing decision rather than guess, and stop and report
    rather than run a package install if a new dependency is needed —
    unchanged from today.

### Verification and integration (revised for waves)

22. As a developer, I want the orchestrator — never the worker — to run every
    ticket's verification gate: reproduce the red state, re-run the new tests
    green, run the typecheck, check coverage and non-vacuity.
23. As a developer, I want a verification failure to **resume the same
    `opencode` session** with the specific failure as the next turn — not a
    fresh dispatch — up to `MAX_TICKET_ATTEMPTS = 3`, mirroring how
    `agy-implement` resumes a worker via its conversation id.
24. As a developer, I want each verified worker branch squash-merged onto the
    integration branch (in ticket-number order relative to what's already
    integrated) and the full suite run on that result **as soon as that
    ticket clears** — not held until its whole wave finishes — so that a
    slow fallback escalation for one ticket doesn't stall its already-passing
    wave-mates. The wave still gates the *next* wave: it doesn't start until
    every ticket in the current one reaches a terminal state.
25. As a developer, I want the orchestrator to resolve a purely mechanical
    merge conflict itself and stop and surface a design-encoding conflict
    (`BLOCKED (INTEGRATION_DESIGN_CONFLICT)`) rather than choose it silently.
26. As a developer, I want a preflight check that the target repo is clean,
    the integration branch exists, and `opencode` is on `PATH` with the
    resolved model listed by `opencode models` — no Ollama-specific check, no
    "restart Ollama" message.
27. As a developer, I want workers and the fallback subagent to commit only on
    their own worker branch, with the integration branch never pushed.

### Automatic subagent fallback (mechanism unchanged, reason reframed)

28. As a developer, I want a ticket the resolved model cannot deliver — too
    large even for its window, failed verification 3 times, or `opencode`
    failed past its retry budget — escalated automatically to one native
    harness subagent for the whole ticket, with no approval pause, because a
    capable model can still hit a capability ceiling and a fourth attempt on
    the same model is not the right next step.
29. As a developer, I want the fallback subagent verified by the same
    verification gate as a main-path worker, and `BLOCKED
    (TICKET_VERIFICATION_FAILED)` only when the fallback also fails its full
    attempt budget.
30. As a developer, I want an `opencode` infra failure inside
    `MAX_OPENCODE_RETRIES` retried as a **fresh dispatch on the same pinned
    model** — never a session resume (a crashed or timed-out session may not
    be resumable), never escalated, and never routed to a different model — a
    transient hiccup is not the ticket's fault, and this skill still does not
    do cross-model failover.
31. As a developer, I want `--opencode-only` (renamed from `--no-fallback` /
    `--strict-local`, since nothing is "local" anymore) to suppress the
    subagent fallback entirely, falling back to `BLOCKED` instead.
32. As a developer, I want the Plan to predict each ticket's path (`opencode`
    / `subagent-fallback`) and every actual escalation recorded in
    `status.md` and named in the handoff with its Claude token spend and a
    note that its code context left the machine.

### Cost and model visibility (new)

33. As a developer, I want `status.md`, the Plan, and the completion handoff
    to disclose cumulative token usage (and cost, where `opencode` reports it)
    for the **main** `opencode` path as `tokens.main`, alongside the existing
    `tokens.fallback`, so that real spend on the main path is as visible as
    fallback spend always was.
34. As a developer, I want the resolved model named in the Plan and in
    `status.md` (not assumed), so that "whatever `opencode` last had selected"
    is a fact I can see, not a guess.

### Failure, state, and resume (revised for waves)

35. As a developer, I want a `BLOCKED` ticket to halt only its own dependency
    branch — everything that passed is integrated, independent later waves
    with no dependency on it are reported as an available partial path but not
    started automatically, and the run stops at the next frontier.
36. As a developer, I want the halt report to name blocked tickets, why,
    which downstream tickets are therefore not started, and which independent
    tickets/waves could still run.
37. As a developer, I want run state — the wave table, each ticket's
    `{status, session_id, attempts, opencode_retries, worker_branch, commit,
    usage}`, the integration branch ref, and cumulative usage per path —
    persisted to `status.md` so a crash or closed session loses nothing.
38. As a developer, I want `/opencode-implement continue` to reconcile against
    reality (git refs, worktrees, each committed ticket's acceptance checks)
    before trusting recorded state, rewind the integration branch on drift,
    list discarded commits, and re-dispatch from the frontier.
39. As a developer, I want `/opencode-implement status` and `/opencode-implement
    list` to report progress — including cumulative usage per path and any
    possibly-stalled worker — without mutating anything.

### Boundaries

40. As a developer, I want `opencode-implement` to remain a standalone skill —
    not merged into `agy-implement` — carrying its own copy of the planning,
    worktree, verification, fallback, and state machinery, even though that
    machinery now closely mirrors `agy-implement`'s.
41. As a developer, I want the skill to keep working without modifying
    `grill-to-tickets`, `agy-implement`, `subagent-implement`,
    `engineering-workflow`, any `mattpocock/skills`-sourced file, or
    `skills-lock.json`.
42. As a developer, I want the final handoff to hand me the integration
    branch name and the exact `/code-review` and `/scrutinize` commands to
    run next in a fresh context.

## Implementation Decisions

### Skill shape

- Name, location, and human-guide path unchanged:
  `skills/agents/opencode-implement/`, mirrored to
  `.agents/skills/opencode-implement/`, `docs/skills/agents/opencode-implement.md`.
- **Repo decision record**: `docs/decisions/0007-opencode-implement-standalone.md`
  gets a short addendum noting its "local execution" framing is superseded by
  this feature — not a rewrite (see Further Notes).
- Invocation, sub-commands (`continue`, `status`, `list`), and frontmatter
  (`disable-model-invocation: true`, Codex `allow_implicit_invocation: false`)
  unchanged.
- **Run options** (set once at invocation): `--model provider/model` (no
  skill-level default — omitted means `opencode` resolves its own), `--fallback-agent
  <name>` (default `general-purpose`), `--opencode-only` (renamed from
  `--no-fallback` / `--strict-local`; keep `--no-fallback` working as a
  deprecated alias for one release). Editable at Plan approval: the
  **concurrency cap** (default 4, new), `FIRST_EVENT_TIMEOUT`, `STALL_INTERVAL`,
  `WORKER_TIMEOUT`, `MAX_TICKET_ATTEMPTS`, `MAX_OPENCODE_RETRIES` — all
  provisional pending a fresh calibration probe against the resolved hosted
  model (the old values were calibrated for a local model doing sub-steps and
  no longer apply to either the model or the workload shape).
- Pure prompt, no scripts — unchanged.

### Input contract

Unchanged from today: reads `.scratch/<feature-slug>/issues/<NN>-<slug>.md` in
the `to-tickets` local format, the parent `spec.md`, `CONTEXT.md`, and `adr/`.
Feature ticket sets only; wide-refactor sequences run as ordered waves (not
ordered serial steps — see User Story 14).

### Stage 0 — Plan (read-only)

Rewrite `references/planning.md` to adopt `agy-implement`'s planning procedure
(`skills/agents/agy-implement/references/planning.md` §§1–7) verbatim except:

- Step 5's touch-set estimation and overlap-flag mechanics carry over unchanged.
- Step 7's Plan table drops the (never-present) model column for the same
  underlying reason `agy-implement` drops it — one resolved model for the
  whole run here, vs. round-robin-at-dispatch there — and drops any step-plan
  column entirely (no decomposition).
- Retry budgets on the Plan are `MAX_TICKET_ATTEMPTS = 3` and
  `MAX_OPENCODE_RETRIES = 3` (not `MAX_FAILOVER_ATTEMPTS` — this skill retries
  `opencode` failures on the same model, never fails over to a different one).
- The editable run parameters section adds the **concurrency cap** and keeps
  the `opencode`-specific timeouts, dropping every local-window/context-budget
  parameter.

### Stage 1 — Execute (wave by wave, frontier order)

Rewrite `references/worktree-integration.md` to adopt `agy-implement`'s worktree
and integration procedure (its `references/worktree-integration.md`)
verbatim except:

- Preflight drops the Ollama-reachability check and the local-specific smoke
  test message; keeps `opencode`-specific checks (`opencode` on `PATH`,
  `opencode models` lists the resolved model, `opencode.json`
  `{"snapshot": false}` written per worktree).
- The worker CLI is `opencode run`, not `agy` — see the rewritten
  `references/worker-contract.md` below — but the worktree lifecycle,
  serial-vs-parallel dispatch within a wave, the concurrency cap and queue, and
  the verification gate all carry over from `agy-implement` unchanged in
  shape.
- **Integration is per-ticket, not gated on the whole wave** (revised at
  Stage 2 design review — see [[adr-0002-whole-ticket-wave-parallel]]): a
  ticket squash-merges (in ticket-number order relative to already-integrated
  tickets) as soon as it passes verification, with the full suite run on that
  integrated result, whether or not its wave-mates are done. A ticket that
  exhausts its main-path budget escalates to the fallback tier instead of
  integrating; once the fallback subagent's result passes the same
  verification gate, it integrates the same way, cut from whatever `HEAD`
  exists by then. Only the **wave boundary itself** waits — the run does not
  start the next wave until every ticket in the current one has reached a
  terminal state (integrated, or `BLOCKED`). This is the one place the
  mechanism diverges from `agy-implement`'s literal per-wave integration gate,
  because `agy-implement` has no fallback tier whose completion time is
  unbounded relative to the rest of the wave.

**Files touched under `references/`:**

| file | change |
|---|---|
| `planning.md` | rewritten wholesale, adopting `agy-implement/references/planning.md` §§1–7 (see Stage 0 above) |
| `worktree-integration.md` | rewritten wholesale, adopting `agy-implement/references/worktree-integration.md` (see Stage 1 above), plus the fallback-escalation step |
| `worker-contract.md` | rewritten in place: model-resolution-and-pin, whole-ticket invocation, the two-rule retry carry-over, per-worker concurrency (see below) |
| `fallback.md` | rewritten in place: same triggers and mechanics, reframed rationale (see [[adr-0003-fallback-tier-retained]]) |
| `status-and-resume.md` | rewritten wholesale, adopting `agy-implement/references/status-and-resume.md`'s wave-table/reconciliation shape, with `tokens: {main, fallback}` in place of `tokens: {local, fallback}` |
| `prompt-scaffold.md` | rewritten in place: converts from the per-sub-step prompt (with a progress-note section) to a whole-ticket prompt, mirroring `agy-implement/references/prompt-scaffold.md`'s shape |
| `decomposition.md` | **deleted.** Criterion-level splitting no longer exists and `agy-implement` has no equivalent file — its touch-set estimation lives inline in `planning.md` instead. |

### `opencode` worker contract

Rewrite `references/worker-contract.md`:

- **Invocation**: `opencode run --format json --dir <worktree>
  --dangerously-skip-permissions "<prompt>"`, adding `--model <model>` only
  when the user passed one at invocation.
- **Model resolution check**: before wave 0, confirm the resolved model via
  `opencode models` (or the first worker's `step_start`/`step_finish` events)
  and record it in `status.md` and the Plan.
- **Output, success, and failure envelope**: unchanged (newline-delimited JSON,
  `step_finish`/`part.reason: "stop"`/exit 0 for success, `error` event /
  non-zero exit / missing envelope / timeout for failure).
- **Retry carry-over — two distinct rules, mirroring `agy-implement`'s split
  between its two retry budgets:**
  - **Verification failure (`MAX_TICKET_ATTEMPTS`)**: **resume the same
    session** — `opencode run -s <session>` with the specific failure as the
    next turn — replacing the old fresh-dispatch-plus-progress-note pattern.
    The worker finished cleanly; only its output was wrong, so its session is
    known-good to resume.
  - **`opencode`-process failure (`MAX_OPENCODE_RETRIES`)**: a **fresh**
    dispatch, unchanged from the shipped skill today. A crash, timeout, stall
    kill, or malformed envelope leaves no guarantee a session exists or is
    resumable — a worker killed before its first event has no `sessionID` at
    all — so this retries the same captured model from a clean prompt, never
    a resume.

  `sessionID`s are recorded in `status.md` either way, for debugging.
- **Concurrency**: multiple `opencode run` processes may be in flight at once,
  one per parallel worker, each with its own `--dir <worktree>` and its own
  background-PID timeout watcher (`FIRST_EVENT_TIMEOUT` /
  `STALL_INTERVAL` / `WORKER_TIMEOUT` per worker, not per run).
- **Timeouts and cost**: values are provisional pending a fresh calibration
  probe against the resolved hosted model (see Further Notes) — no longer
  inherited from the local-model probe. `part.cost` is no longer assumed `0`;
  roll it (or the token counts, if `opencode` doesn't report cost for the
  provider) into `tokens.main`.
- **Git snapshots**: unchanged (`opencode.json` `{"snapshot": false}` per
  worktree, excluded from the diff).

### Fallback subagent contract

`references/fallback.md` keeps its trigger list, dispatch mechanics
(`isolation: "worktree"`, fresh worker branch from clean integration `HEAD`,
`SendMessage`-based retry), and verification-and-budget section unchanged from
today. Only the opening rationale changes, from "a 27B local model is weak and
slow" to "any single resolved model has a capability ceiling" (see
[[adr-0003-fallback-tier-retained]]).

### State and resume

`.scratch/<feature-slug>/status.md` adopts `agy-implement`'s shape
(`references/status-and-resume.md`): the **wave table**, per ticket
`{status, session_id, attempts, opencode_retries, worker_branch, commit,
usage}`, the integration branch ref, and **cumulative usage split by path**
(`tokens.main`, `tokens.fallback` — not `agy-implement`'s per-provider split,
since there is only ever one model here). `continue` performs the same reality
reconciliation `agy-implement` does (git refs, worktrees, re-verify each
committed ticket, rewind on drift). `status` / `list` stay read-only.

### Feature-scoped storage

```
.scratch/<feature-slug>/
├── issues/            # input: tickets (NN-<slug>.md), already published
├── spec.md            # input: parent specification
├── status.md          # run state: wave table, per-ticket status, cumulative usage
├── prompts/<NN>.md    # one self-contained whole-ticket worker prompt
├── logs/<NN>.jsonl    # opencode event stream per ticket run
├── logs/<NN>.err      # opencode stderr per ticket run
└── worktrees/<NN>/    # one git worktree + worker branch per ticket (gitignored)
```

(Drops the old `prompts/<NN>/<K>.md` sub-step nesting — one prompt file per
ticket, not per sub-step.)

### Handoff (on completion)

Print: integration branch name; one commit per ticket confirmed; **cumulative
token usage for both paths** (`tokens.main` — real spend against the resolved
model; `tokens.fallback` — each fallback ticket named with its Claude token
spend and a note that its code context left the machine); the resolved model
name; and the exact next commands (`/code-review since <merge-base with main>`,
then `/scrutinize`). No review, push, or PR.

### Rejected alternatives

- **Keep decomposition, make the context budget dynamic per resolved model.**
  Considered first; rejected once the user chose full convergence with
  `agy-implement`'s whole-ticket dispatch shape (see
  [[adr-0002-whole-ticket-wave-parallel]]).
- **Drop the fallback tier to match `agy-implement` exactly.** Rejected — the
  user chose to keep it as this skill's differentiator (see
  [[adr-0003-fallback-tier-retained]]).
- **Adopt `agy-implement`'s model-list + round-robin failover.** Rejected — no
  model list was ever asked for; this skill still resolves and uses exactly
  one model per run (see [[adr-0004-cost-disclosure-and-no-failover]]).
- **Merge into `agy-implement` as an `--engine opencode|agy` flag.** Rejected —
  explicit user decision to keep `opencode-implement` standalone.
- **Pin a new hardcoded default model.** Rejected — defeats the point of
  trusting `opencode`'s own resolution (see [[adr-0001-hosted-only]]).

## Testing Decisions

### What makes a good test here

Unchanged framing: `opencode-implement` is a prompt document with no executable
code, so tests exercise external behaviour only — given a scenario (a ticket
directory + a parent spec + a described environment), does the orchestrator
produce the right *Plan* and the right *routing decisions*. Tests assert on
observable choices, never wording: wave assignment, serial/parallel
disposition, overlap flags, `opencode` vs. `subagent-fallback` disposition,
blocked/halt-vs-continue, whether source is mutated before approval, whether
the orchestrator ever implements a ticket itself, whether a fallback fires
without a pause and is disclosed, whether cost is disclosed for both paths.

### The single seam

Unchanged: the eval harness is the one seam. Anything unobservable there (real
`opencode` subprocess behaviour, real event-stream shape, real concurrent
`git worktree` mechanics, the real hosted-model token/cost floor) is covered by
the manual validation checklist in Further Notes.

### Modules under test

- `evals/trigger-evals.json` — unchanged trigger set, minus any Ollama-specific
  non-trigger case (replace with a generic "mentions a hosted model" non-trigger
  case).
- `evals/evals.json` — revise the case list from the original 30 cases:
  - **Drop** (decomposition-specific, no longer applicable): the one-sub-step /
    four-sub-step step-plan cases, the over-budget-split case, the
    progress-note-carry-over case, the per-sub-step checkpoint-check case,
    `TICKET_TOO_LARGE_FOR_CONTEXT` as a common case (keep it as a rare edge
    case, not a dedicated scenario).
  - **Add**: wave computation from a DAG with independent branches; a
    same-wave overlapping-touch-set pair correctly flagged; a flagged pair the
    user chose to serialize actually serialized; parallel dispatch of an
    approved wave respects the concurrency cap and queues the rest; a
    possibly-stalled worker flagged without blocking its wave-mates; a
    verification-failure retry resumes the same session, while an
    `opencode`-process failure retries as a fresh dispatch on the same pinned
    model; a ticket escalating to fallback integrates on its own without
    blocking its already-passed wave-mates from integrating first; the next
    wave still waits until every ticket in the current wave reaches a
    terminal state; the model is resolved once and then pinned — a later
    worker in the same run is dispatched with an explicit `--model` even when
    the user gave none at invocation; `tokens.main` accumulates and is shown
    in the Plan/status/handoff; the resolved model is recorded in `status.md`
    and shown in the Plan; `--opencode-only` suppresses fallback the same way
    `--no-fallback` did.
  - **Keep unchanged**: cyclic/missing-blocker/bad-numbering halts at planning;
    no source mutation before approval; verification reproduces red itself and
    rejects a vacuous or non-covering test; fallback fires automatically on
    verification-budget exhaustion and on `opencode`-failure exhaustion, never
    on a transient `opencode` hiccup within budget; fallback does the whole
    ticket from clean `HEAD`; fallback's own budget exhaustion yields
    `BLOCKED (TICKET_VERIFICATION_FAILED)`; design-encoding merge conflict
    surfaces rather than resolving silently; a blocked ticket halts only its
    dependency branch; resume reconciles and rewinds on drift; dirty target
    tree at preflight stops and asks; a worker needing a new dependency stops
    and replans; the handoff names the integration branch and next commands
    without pushing or opening a PR.

### Prior art

`skills/agents/agy-implement/evals/` — same two-file shape, and now the closer
structural sibling for eval-case parity than it was before this feature.

## Out of Scope

- Running `/code-review` or `/scrutinize` — handed off, not performed.
- `git push`, pull requests, and any issue-tracker mutation.
- Bug-fix ticket sets and incident flows.
- Per-ticket model selection by complexity, weight, or a capability floor.
- **Cross-provider / cross-model failover, a model list, or round-robin
  dispatch** — carried forward from the original design; `--model` (or
  `opencode`'s own resolution) is a single choice for the whole run
  ([[adr-0004-cost-disclosure-and-no-failover]]).
- A hard cost cap / `--max-cost` flag — this feature adds visibility, not
  enforcement.
- Merging into `agy-implement` — explicit user decision to stay standalone.
- Wiring `opencode-implement` into `engineering-workflow`.
- Extracting shared machinery into a common `references/` bundle or a base
  skill with `agy-implement` — deferred; the two skills' worker contracts
  still diverge (`opencode` vs. `agy` CLI) even after this change.
- Adapters for any CLI other than `opencode`.
- Generating the tickets — that is `grill-to-tickets` / `to-tickets` upstream.
- Modifying `grill-to-tickets`, `agy-implement`, `subagent-implement`,
  `engineering-workflow`, `mattpocock/skills` files, or `skills-lock.json`.
- Re-adding local-model support as a documented path (mechanically, `--model`
  can still point at a local `opencode` provider — see
  [[adr-0001-hosted-only]] — but no docs, defaults, or preflight checks
  target it).

## Further Notes

### Validation probes needed (fresh — the originals were local-model-specific)

- **Model-resolution probe.** Confirm `opencode run` with no `--model` flag
  actually resolves to the last-used / configured model, not an unexpected
  internal default, in this environment. Confirms the mechanism
  [[adr-0001-hosted-only]] relies on.
- **Latency and concurrency probe.** Run several whole-ticket-shaped prompts
  against the resolved hosted model, some concurrently, and record
  time-to-first-event, total wall time, and whether concurrent dispatch
  degrades latency or hits a rate limit. Sets `FIRST_EVENT_TIMEOUT` /
  `STALL_INTERVAL` / `WORKER_TIMEOUT` and the initial **concurrency cap**
  from observed behavior instead of the local-model probe's numbers.
- **Session-resume probe.** Confirm `opencode run -s <session>` resumes with
  the prior turn's file edits intact and accepts a short follow-up prompt,
  the mechanism the new retry strategy depends on
  ([[adr-0002-whole-ticket-wave-parallel]]).
- **Cost/usage reporting probe.** Confirm what `opencode run --format json`
  reports for `part.cost` (or whether it's still always `0`, meaning the
  gateway doesn't surface cost and `tokens.main` must stand in for it) against
  the hosted provider in use.
- **Context-overflow error-shape probe.** With no planning-time context-budget
  estimate anymore, `TICKET_TOO_LARGE_FOR_CONTEXT` can only be detected at
  runtime. Confirm whether `opencode`'s `error` event distinguishes a genuine
  context-length-exceeded failure from a generic crash/timeout — if it
  doesn't, an oversized ticket burns its full `MAX_OPENCODE_RETRIES` budget on
  a doomed retry before falling back anyway (same end state, just slower;
  not a correctness bug, but worth knowing before relying on the distinct
  status token).

### Deferred follow-ups

- Shared-machinery refactor with `agy-implement`, now that the two skills'
  planning/dispatch shape has converged substantially — still deferred, since
  the worker CLI contract (`opencode` vs. `agy`) still diverges.
- A hard `--max-cost` budget cap, if visibility from this feature shows it's
  needed.
- A short addendum to `docs/decisions/0007-opencode-implement-standalone.md`
  noting its local-execution framing is superseded — tracked as a ticket, not
  done in this spec.

### Relationship to prior art

This feature moves `opencode-implement` from `qwen-agent`'s single-task
local-delegation lineage into `agy-implement`'s wave/parallel control-plane
lineage, while keeping `opencode` (not `agy`) as the delegate CLI and keeping
the automatic subagent fallback tier that `agy-implement` doesn't have. The two
skills' Stage 0 / verification gate / integration gate / state model are now
close to identical in shape by design — the same alignment the original spec
anticipated as a "future shared-base refactor" — but remain separate skills
because their worker contracts still diverge and the fallback tier is a
deliberate, kept difference.
