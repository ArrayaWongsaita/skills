# opencode-implement — Specification

Feature slug: `opencode-implement`. Glossary: [CONTEXT.md](CONTEXT.md). Decisions:
[adr/0001](adr/0001-standalone-sibling.md),
[adr/0002](adr/0002-orchestrator-never-implements.md),
[adr/0003](adr/0003-local-execution-is-the-purpose.md),
[adr/0004](adr/0004-tdd-mandatory.md),
[adr/0005](adr/0005-serial-execution-parallel-is-a-non-goal.md),
[adr/0006](adr/0006-context-fit-decomposition.md),
[adr/0007](adr/0007-automatic-native-subagent-fallback.md).

## Problem Statement

I have run `/grill-to-tickets` (or `/to-tickets`) and have a directory of tracer-bullet
tickets under `.scratch/<feature-slug>/issues/`, each with a `Blocked by` edge list and a
checklist of acceptance criteria. Turning that ticket set into working code today means
driving `/implement` myself one ticket at a time, which spends my Claude quota and sends
every line of the codebase to a hosted provider.

I run a local model through `opencode` (`opencode run --model ollama/qwen3.8:27b-mlx-32k`).
It is free, it never leaves my machine, and it works offline. I want to hand the whole
ticket directory to something that farms the actual implementation out to that local
model — but the local model is weak and slow (a trivial task takes ~3 minutes; a
too-large task hangs), and it runs in a 32k-token window of which ~11k is gone before any
work starts. A single tracer-bullet ticket does not fit.

So I need the thing driving the run to: plan the order of work from the dependency graph;
break every ticket into criterion-level pieces that fit the local model's context; force
every piece to be built test-first so I can trust a weak model's output; verify every
result itself; and, when the local model genuinely cannot do a ticket — a piece too big
even split down, or three failed attempts, or `opencode` keeps erroring — quietly hand
that one ticket to a capable native subagent instead of stalling. Then assemble
everything onto one branch, one commit per ticket, and stop cleanly before review,
resumable if interrupted.

This is a **background tool**. Serial local inference on a 27B model is slow — a trivial
task took ~3 minutes in a probe, and some runs went much longer or wedged — so a real
feature's ticket set is an hours-long run I start and walk away from. State and resume
have to be solid because I will not be watching.

## Solution

`/opencode-implement .scratch/<feature-slug>/` (or a bare `<feature-slug>`; with no
argument it picks the most recently modified `.scratch/*/issues/` directory and names it
back for confirmation).

The main agent — the **orchestrator** — reads the ticket directory and the parent
`spec.md`, then works in two stages.

1. **Plan (read-only).** It parses the tickets into a dependency DAG, computes the
   dependency order, selects each ticket's **test seam**, and builds a **step plan** for
   every ticket — an ordered chain of **sub-steps**, one acceptance criterion per
   sub-step by default (a one-criterion ticket → a one-sub-step chain). Where a single
   criterion's sub-step is estimated over the **context budget** it is split finer (by
   file or layer). It predicts each ticket's **path** — `local` or, where even a
   split-down sub-step will not fit, `subagent-fallback`. It presents this **Plan** and
   changes no source until approved.

2. **Execute, one ticket at a time in dependency order (serial — adr/0005).** For each
   ticket the orchestrator cuts a git worktree and worker branch from the current
   integration `HEAD`, then:
   - **Local path.** Dispatches one headless `opencode run` **worker** per sub-step, in
     order, each told to build that criterion test-first, each a fresh `opencode` session
     handed a compact **progress note** rather than a resumed transcript. Between
     sub-steps the worker commits on the worker branch, the orchestrator writes the next
     progress note, and a light **checkpoint check** runs. A sub-step that overflows at
     runtime is re-split.
   - **Verification gate (orchestrator).** When the ticket's sub-step chain is complete
     the orchestrator reproduces the whole ticket's red state itself, re-runs the new
     tests green, runs the typecheck, and inspects the test diff for coverage and
     vacuity.
   - **Fallback (automatic — adr/0007).** If a sub-step cannot be split fine enough to
     fit, or the ticket fails the verification gate `MAX_TICKET_ATTEMPTS` times on the
     local model, or `opencode` keeps failing past `MAX_OPENCODE_RETRIES`, the
     orchestrator discards the partial worktree and dispatches one native subagent
     (`isolation: "worktree"`) for the **whole ticket** from clean integration `HEAD`,
     verifying it the same way. No approval pause. `--no-fallback` suppresses this and
     `BLOCKED`s instead — the fallback spends Claude tokens and sends the ticket off the
     machine, which `--no-fallback` exists to prevent.
   - **Integration.** The verified worker branch is squash-merged onto the integration
     branch `opencode-implement/<feature-slug>` as exactly one commit, in ticket-number
     order, ticking that ticket file's checkboxes.

The orchestrator never implements a ticket itself (adr/0002); it writes code only to
resolve a purely mechanical merge conflict. A ticket that neither the local path nor the
fallback can finish within budget becomes `BLOCKED`, its dependency branch halts, work
that passed is integrated,
and the run stops at the next frontier with a report. `/opencode-implement continue`
resumes after the blocker is cleared.

On completion the skill prints a handoff — the integration branch name, one-commit-per-
ticket confirmation, per-path token usage (local runs are `cost: 0`; every ticket that
took the subagent fallback is named, with its Claude token spend and a note that its code
context left the machine), and the `/code-review` + `/scrutinize` commands to run next in
a fresh context. It runs no review, no `git push`, and opens no PR.

## User Stories

### Invocation and planning

1. As a developer, I want to run `/opencode-implement` against a ticket directory, so
   that I can implement a whole `grill-to-tickets` output on my local model in one
   command instead of one `/implement` per ticket.
2. As a developer, I want to pass just a feature slug or nothing at all, so that I do not
   have to type the full `.scratch/<slug>/issues/` path.
3. As a developer, I want the skill to refuse to start unless I invoked it explicitly
   (`/opencode-implement` or `$opencode-implement`), so that it never fires from a stray
   mention of tickets in conversation.
4. As a developer, I want the orchestrator to parse every ticket's `Blocked by` list into
   a dependency graph and reject the run if the graph has a cycle, names a missing
   ticket, or is numbered inconsistently with a topological order, so that a broken
   ticket set is caught before any code is written.
5. As a developer, I want the orchestrator to compute the dependency order and identify
   the frontier from the graph, not guess it.
6. As a developer, I want the orchestrator to select each ticket's test seam at planning
   from the parent spec's Testing Decisions where they constrain it, and to show every
   seam in the Plan, so that workers are handed a fixed seam and never invent one.
7. As a developer, I want a ticket whose acceptance criteria cannot be exercised by an
   isolated test at any seam sent back for replanning rather than implemented without a
   test.
8. As a developer, I want the orchestrator to do nothing irreversible during planning, so
   that I can run planning just to see the shape of the work.
9. As a developer, I want to approve or adjust the Plan — the step plans, the predicted
   paths, the run parameters — before any source file is touched.

### Context-fit decomposition

10. As a developer, I want the orchestrator to build a step plan for **every** ticket —
    an ordered chain of sub-steps, one acceptance criterion per sub-step by default (a
    one-criterion ticket is a one-sub-step chain) — so that no ticket is ever dispatched
    whole to a worker that would exceed the local model's window and hang.
11. As a developer, I want the orchestrator to estimate a single criterion's sub-step
    against the context budget and split it finer (by file or layer) when it still will
    not fit, with the bias set to over-split — an extra 3-minute sub-step is cheaper than
    a sub-step that hangs.
12. As a developer, I want each sub-step to carry the full red-green-refactor protocol
    and to be built test-first, exactly like a whole ticket (adr/0004).
13. As a developer, I want state carried between sub-steps by a commit on the worker
    branch plus a compact progress note (files touched, test status, next step) — not by
    resuming the `opencode` session — so that context does not grow with every sub-step.
14. As a developer, I want the step plan shown in the Plan as an estimate, and a sub-step
    that overflows at runtime re-split by the orchestrator with the re-split recorded in
    `status.md`, so that a wrong estimate does not fail the ticket.
15. As a developer, I want a light checkpoint check after each sub-step (the worktree
    still typechecks, and the criterion test just written is red / just implemented is
    green, per the step plan), so that a bad sub-step is caught before the next one
    builds on it.
16. As a developer, I want a single criterion that cannot be split fine enough to fit
    handled by the fallback (or `BLOCKED (TICKET_TOO_LARGE_FOR_CONTEXT)` under
    `--no-fallback`), never dispatched to a worker that will hang.

### Local workers and TDD

17. As a developer, I want each sub-step handed to exactly one `opencode run` worker as a
    fully self-contained prompt — absolute paths, the "What to build" context and this
    sub-step's acceptance criterion verbatim, the relevant parent-spec sections and ADRs,
    the domain glossary, the assigned test seam, the progress note, and the full
    red-green-refactor protocol — so that a worker with zero conversation context can do
    the work.
18. As a developer, I want workers run with slash-command handling irrelevant to the
    prompt (a ticket body token like `/implement` must not trigger anything), and run
    unattended with file edits and the project's test/typecheck commands auto-approved
    but confined to the ticket's git worktree.
19. As a developer, I want every worker invoked as
    `opencode run --format json --model <model> --dir <worktree> --dangerously-skip-permissions`
    under a hard wall-clock timeout, with the default model `ollama/qwen3.8:27b-mlx-32k`
    and `--model provider/model` overriding it at invocation.
20. As a developer, I want the orchestrator to parse `opencode`'s newline-delimited JSON
    event stream defensively — ignoring interleaved non-JSON log lines, keying success
    off a final `step_finish` with `reason: "stop"` and a zero exit code, and treating an
    `error` event, a non-zero exit, a missing `step_finish`, a timeout, or a stall as a
    worker failure distinct from a verification failure.
21. As a developer, I want a worker that emits no first event within `FIRST_EVENT_TIMEOUT`
    or no new event for `STALL_INTERVAL` killed as a worker failure, and one still
    running at `WORKER_TIMEOUT` killed too, with all three thresholds generous and
    calibrated from a real latency probe — so that a wedged or contended run is caught
    without killing legitimate slow work on a weak local model.
22. As a developer, I want each worker's structured return to include the
    pre-implementation failing-test output, the post-implementation passing output, the
    list of changed files, and a table mapping each new test to the acceptance criterion
    it covers.
23. As a developer, I want workers to touch only what the ticket or sub-step needs, to
    stop and report a missing decision rather than guess, and to stop and report rather
    than run a package install if a new dependency is needed, so that scope creep and
    lockfile churn are caught.

### Verification and integration

24. As a developer, I want the orchestrator — not the worker — to run every ticket's
    verification: reproduce the red state (apply only the ticket's test files at the
    pre-ticket integration `HEAD`, confirm they fail for a missing behaviour), re-run the
    new tests green, run the typecheck, and check the test diff for vacuous assertions
    and for full coverage of the acceptance criteria.
25. As a developer, I want a verification failure to re-dispatch the failing sub-step
    with the specific failure detail (a fresh `opencode` session plus a progress note
    naming the failure), up to `MAX_TICKET_ATTEMPTS = 3` on the local model before the
    ticket escalates.
26. As a developer, I want each verified ticket's worker branch squash-merged into one
    integration branch as exactly one commit, in ticket-number order, with the same
    commit ticking the ticket file's acceptance checkboxes and setting its status.
27. As a developer, I want the orchestrator to resolve a purely mechanical merge conflict
    itself and to stop and surface a conflict that encodes a design decision
    (`BLOCKED (INTEGRATION_DESIGN_CONFLICT)`) rather than choose it silently.
28. As a developer, I want the full typecheck and test suite run on the integration
    branch after each ticket is merged, so that a ticket is never "done" until everything
    still passes together.
29. As a developer, I want a preflight check that the target repo has no uncommitted
    changes and is on (or can create) the integration branch, that `opencode` is
    installed and the model is reachable, stopping to ask if the tree is dirty — the run
    never stashes.
30. As a developer, I want workers and the fallback subagent to commit only on their own
    worker branch and the integration branch never pushed, so that publishing stays my
    explicit decision.

### Automatic subagent fallback

31. As a developer, I want a ticket the local model cannot deliver — cannot be
    decomposed to fit, or failed verification 3 times, or `opencode` failed past its
    retry budget — escalated automatically to one native harness subagent
    (`isolation: "worktree"`, default `general-purpose`, `--fallback-agent` overrides)
    given the same test-first prompt, with no approval pause.
32. As a developer, I want the fallback subagent verified by the same orchestrator-run
    verification gate as a local worker, and `BLOCKED (TICKET_VERIFICATION_FAILED)` only
    when the fallback subagent also fails its full attempt budget.
33. As a developer, I want an `opencode` infra failure inside `MAX_OPENCODE_RETRIES` just
    retried locally, not escalated — a transient hiccup is not the ticket's
    fault.
34. As a developer, I want `--no-fallback` (alias `--strict-local`) to suppress the
    subagent fallback entirely so a run can guarantee zero Claude-token spend and no code
    leaving the machine, falling back to `BLOCKED (TICKET_TOO_LARGE_FOR_CONTEXT)` /
    `BLOCKED (TICKET_VERIFICATION_FAILED)`.
35. As a developer, I want the Plan to predict each ticket's path (`local` /
    `subagent-fallback`) and every actual escalation recorded in `status.md` and named in
    the completion handoff ("ticket N: subagent fallback — Claude tokens spent, code left
    the machine"), so that the cost and the privacy trade are visible before and after.

### Failure, state, and resume

36. As a developer, I want a `BLOCKED` ticket to halt only its own dependency branch —
    everything that passed is integrated and the run stops at the next frontier — so one
    bad ticket does not waste the rest of the run.
37. As a developer, I want the halt report to name which tickets are blocked, why, which
    downstream tickets are therefore not started, and which independent tickets could
    still run.
38. As a developer, I want run state — the dependency-ordered ticket table, each ticket's
    `{status, path, sub_step, session_ids, subagent_id, attempts, opencode_retries,
    worker_branch, commit, tokens}`, the integration branch ref, and cumulative
    per-path token usage — persisted to `.scratch/<slug>/status.md`, so that a crash or a
    closed session loses nothing.
39. As a developer, I want `/opencode-implement continue` to re-check reality before
    trusting that state — git refs, worktrees, and each committed ticket's acceptance
    checks — to discard any half-built worker branch and worktree for a ticket that was
    mid-run when the session died and re-dispatch that ticket from clean, and, when a
    *committed* ticket no longer verifies, to reset the integration branch to the last
    still-good commit, discard the invalidated worktrees, list the discarded commits in
    the report, and re-dispatch from there.
40. As a developer, I want `/opencode-implement status` and `/opencode-implement list` to
    report progress compactly without mutating anything.

### Boundaries

41. As a developer, I want `opencode-implement` to work without modifying
    `grill-to-tickets`, `agy-implement`, `subagent-implement`, `engineering-workflow`,
    any `mattpocock/skills`-sourced file, or `skills-lock.json`.
42. As a developer, I want the skill to carry its own copy of the planning, worktree,
    verification, decomposition, fallback, and state machinery, so that it can diverge
    from its siblings freely.
43. As a developer, I want the final handoff to hand me the integration branch name and
    the exact `/code-review` and `/scrutinize` commands to run next in a fresh context.

## Implementation Decisions

### Skill shape

- **Name** `opencode-implement`. Location `skills/agents/opencode-implement/`, mirrored
  to `.agents/skills/opencode-implement/`. Human guide at
  `docs/skills/agents/opencode-implement.md`. Repo decision record at
  `docs/decisions/0007-opencode-implement-standalone.md`.
- **Invocation** explicit only: `/opencode-implement <dir|slug>` (universal/slash),
  `$opencode-implement <dir|slug>` (Codex). Frontmatter `disable-model-invocation: true`;
  ship `agents/openai.yaml` with `allow_implicit_invocation: false`.
- **Sub-commands** `continue [slug]`, `status [slug]`, `list`.
- **Run options** (set once at invocation): `--model provider/model` (default
  `ollama/qwen3.8:27b-mlx-32k`), `--fallback-agent <name>` (default `general-purpose`),
  `--no-fallback` / `--strict-local`. Editable run parameters shown at Plan approval:
  `FIRST_EVENT_TIMEOUT` (default 6m), `WORKER_TIMEOUT` (default 45m), `STALL_INTERVAL`
  (default 8m), `MAX_TICKET_ATTEMPTS` (3), `MAX_OPENCODE_RETRIES` (3), the context
  budget — all provisional, calibrated from validation probe C.
- **Pure prompt, no scripts.** All parsing, DAG computation, step-plan construction,
  sub-step sizing, and event-stream parsing are done by the orchestrator following prose
  instructions. `references/` holds the detailed procedures; `SKILL.md` holds the
  workflow.
- **Argument resolution**: an explicit dir or slug wins; with no argument, the most
  recently modified `.scratch/*/issues/` directory, named back for confirmation.

### Input contract

- Reads `.scratch/<feature-slug>/issues/<NN>-<slug>.md` in the `to-tickets` local format
  (`# NN: title`, `**What to build:**`, `**Blocked by:**`, `**Status:**`, `- [ ]`
  checkboxes).
- Reads the parent `.scratch/<feature-slug>/spec.md`, `CONTEXT.md`, and `adr/` in the
  feature directory and the repository (`docs/decisions/`).
- v1 accepts feature ticket sets only. Bug-fix ticket sets are out of scope; wide-refactor
  expand–contract sequences run as ordered serial steps with no special handling (the
  run is serial anyway).

### Stage 0 — Plan (read-only)

Detailed in `references/planning.md`.

- Parse tickets → dependency DAG. Validate acyclic, blockers resolvable, numbering
  consistent with a topological order. A failure halts with the specific broken ticket
  named (`TICKET_SET_CYCLIC` / `TICKET_SET_MISSING_BLOCKER` / `TICKET_SET_NUMBERING`).
- Compute the dependency order and the frontier. No waves (adr/0005).
- Select a test seam per ticket from the parent spec's Testing Decisions.
- **Build a step plan for every ticket** (adr/0006): one acceptance criterion per
  sub-step by default; a one-criterion ticket is a one-sub-step chain. For each sub-step,
  estimate its content against the **context budget** (provisionally ~13k tokens of
  sub-step content: `32k window − ~11k input floor − ~4k headroom − ~4k reasoning
  reserve`; pinned by validation probe C) and split it finer (by file, by layer) if it
  will not fit. Bias toward over-splitting. Record each sub-step's file scope.
- Predict each ticket's **path**. A ticket with a sub-step that cannot be split fine
  enough to fit is predicted `subagent-fallback` (or flagged for `BLOCKED
  (TICKET_TOO_LARGE_FOR_CONTEXT)` under `--no-fallback`); every other ticket is `local`.
- **Emit the Plan**: the dependency-ordered ticket table plus, per ticket: its blockers,
  test seam, step plan (the ordered sub-steps and their file scopes), predicted path, and
  retry budgets. Also the editable run parameters. Pause for explicit approval. No source
  mutation before approval.
- `continue` re-runs this against current reality and re-presents the Plan.

### Stage 1 — Execute (serial, dependency order)

Detailed in `references/worker-contract.md`, `references/decomposition.md`,
`references/fallback.md`, `references/worktree-integration.md`.

- **Preflight** (once): target repo clean; create/switch to integration branch
  `opencode-implement/<feature-slug>` from `HEAD`; `opencode` on `PATH` and the model
  resolvable (`opencode models` lists it); Ollama reachable; add
  `.scratch/<slug>/worktrees/` to `.gitignore`; **smoke test** — one trivial
  `opencode run` under `FIRST_EVENT_TIMEOUT`, with nothing else using the local model,
  confirming the local stack responds this session and that `--dangerously-skip-permissions`
  runs a bash command and an edit unattended (validation probe A). A slow, stuck, or
  failed smoke test stops the run with a "free up / restart Ollama and opencode" message
  — it does not start a multi-hour run on a contended or wedged stack.
- **Per ticket, in dependency order:**
  1. Cut worktree `.scratch/<slug>/worktrees/<NN>` and worker branch
     `opencode-implement/<slug>/<NN>` from integration `HEAD`. Symlink the primary
     checkout's installed dependencies.
  2. **Local path** — for each sub-step `K` in the step plan, in order: write
     `prompts/<NN>/<K>.md` (the self-contained prompt including the progress note),
     dispatch a fresh `opencode run` worker (background, harness `run_in_background`,
     under `WORKER_TIMEOUT`), parse `logs/<NN>-<K>.jsonl`, have the worker commit on the
     worker branch, run the **checkpoint check**, write the next progress note. Re-split
     a sub-step that overflows at runtime. A one-sub-step chain is just this once.
  3. **Verification gate** (orchestrator, in the worktree): envelope well-formed;
     reproduce the whole ticket's red state; coverage and non-vacuity; green + typecheck.
     Failure → re-dispatch the failing sub-step with the specific failure,
     `MAX_TICKET_ATTEMPTS = 3`.
  4. **Fallback** (automatic unless `--no-fallback`): on a sub-step that cannot be split
     to fit, the verification budget exhausted, or an `opencode` failure past
     `MAX_OPENCODE_RETRIES` — discard the ticket's partial worktree and worker branch,
     cut a fresh worker branch from integration `HEAD`, dispatch one native subagent
     (Agent tool, `isolation: "worktree"`, the whole-ticket test-first prompt), then run
     the same verification gate. Its full attempt budget exhausted → `BLOCKED
     (TICKET_VERIFICATION_FAILED)`.
  5. **Integration**: squash-merge the verified worker branch onto the integration
     branch as one commit in ticket-number order; tick the ticket's checkboxes; resolve
     a mechanical conflict, surface a design conflict; run the full typecheck + suite on
     the integrated result; `git worktree remove`.

### `opencode` worker contract

Confirmed by probe (2026-09-07, `ollama/qwen3.8:27b-mlx-32k`; design-blocking probes green):

- **Invocation**:
  `opencode run --format json --model <model> --dir <worktree> --dangerously-skip-permissions "<prompt>"`
  under a hard timeout (`timeout`/`gtimeout` if present, else a background-PID + `sleep` +
  `kill` wrapper — `timeout` is not on macOS by default). No `--print-timeout` and no
  `--disable-slash-commands` flag exists in `opencode run`. Whether a `/foo` token in the
  ticket body can trigger anything inside a worker is validation probe E's secondary
  check; if it can, the prompt scaffold fences ticket text in a quoted block.
- **Output**: newline-delimited JSON events on stdout, sometimes interleaved with
  non-JSON log lines (e.g. `ERROR (#…): failed {…}`). Event types seen: `step_start`,
  `tool_use` (carries full file contents and diffs — verbose), `text`, `step_finish`,
  `error`. Every event carries `sessionID` (`ses_…`).
- **Success**: exit code `0` and a final `step_finish` with `part.reason: "stop"` and no
  `error` event. `part.tokens` = `{total, input, output, reasoning, cache:{write,read}}`;
  `part.cost` is `0` for the local model. The last step's `tokens.total` is the peak
  context used.
- **Failure**: exit code `1`, an `{"type":"error", "error":{"name":…, "data":{"message":…}}}`
  event, a missing final `step_finish`, a truncated stream, or a timeout/stall-kill.
  Distinct from a verification failure (worker finished, output is wrong).
- **Retry carry-over**: a fresh `opencode run` session each time, handed a **progress
  note** — not `-s <session>` resume (resume replays the transcript; context would grow).
  `sessionID`s are recorded in `status.md` for debugging only.
- **Token floor**: ~10.5k input on the first step for a trivial task; ~11.3k peak
  `tokens.total` for a 2-file-read + 1-edit task. `opencode`/Ollama does prompt caching
  (`cache.read` grows across steps) but `tokens.total` still counts toward the 32k window.
- **Timing and latency variance** (not cleanly measured — see below): successful runs
  were ~140s trivial, ~180s for a 2-file + 1-edit task. Two other runs went far longer
  and were **killed, not observed to finish** — one at 43 min, one capped at 10 min — on
  tasks whose near-twins finished in ~3 min. Whether those were true hangs or just
  extreme slowness is **unproven**: they were never allowed to complete, and during them
  a second `opencode` (the user's TUI, on the other model variant) plus a stray
  `opencode` process were also alive, so Ollama may have been thrashing two ~18 GB models
  on a 38 GB machine. One data point leans toward "stuck": mid-run, Ollama reported **no
  model loaded** while the `opencode` process was alive — a generating model would be
  loaded. Raw Ollama generation stayed fast throughout (55 tokens / 12s).
  - Design consequence is the same either way: a worker can take far longer than
    expected, for a hang *or* for contention, so the skill needs generous, calibrated
    timeouts, a smoke test, retries, and the fallback.
  - `FIRST_EVENT_TIMEOUT` (default 6 min) — time to the first `step_start`; a stuck run
    emits nothing, and a healthy run's first event lands in ~1–2 min.
  - `WORKER_TIMEOUT` (default 45 min) — overall cap. Deliberately loose: a real sub-step
    (write a test, run it, write code, run it, ~10 tool calls) on a slow local model can
    legitimately take 15–30 min, and killing legitimate slow work wastes the whole run.
  - `STALL_INTERVAL` (default 8 min) — max gap between events once running.
  - **Preflight smoke test** — one trivial `opencode run` with **nothing else using the
    local model**; a slow or stuck smoke test stops the run before a multi-hour attempt.
  - `MAX_OPENCODE_RETRIES = 3`, then the subagent fallback.
  - **Validation probe C must measure the real latency distribution** with exclusive
    Ollama access — run ~10 realistic sub-steps, record time-to-first-event and total,
    set the three timeouts from the observed p95 plus headroom. The defaults above are
    guesses pending that.
- **`opencode` git snapshots**: `step_start`/`step_finish` carry a `snapshot` git hash;
  `opencode` takes internal git snapshots, on by default. The skill turns them **off for
  workers** — `opencode.json` `{"snapshot": false}`, written into the worktree and added
  to that worktree's `.git/info/exclude` so it never enters a diff (or set globally in
  `~/.config/opencode/`). `git merge --squash <worker-branch>` takes only the branch tip
  regardless, so stray snapshot refs cannot corrupt integration; the risk snapshots pose
  is a detached `HEAD` or dirty tree mid-run, which the checkpoint check catches.
  Validation probe B confirms the disable works and no snapshot residue survives.

### Fallback subagent contract

Adapted from `subagent-implement`'s `references/dispatch-contract.md` (copied, not
imported — adr/0001):

- Agent tool, `subagent_type` = `--fallback-agent` value (default `general-purpose`),
  `isolation: "worktree"`, background dispatch, worker branch
  `opencode-implement/<slug>/<NN>` cut fresh from integration `HEAD` (the ticket's
  partial local worktree and worker branch are discarded first — the subagent does the
  whole ticket from clean, adr/0007).
- Same self-contained test-first prompt as a local worker, but for the whole ticket and
  minus the progress-note machinery (a subagent has a large context; no decomposition).
- Same orchestrator-run verification gate. Retry via `SendMessage` with the specific
  failure; a subagent crash/loss counts as one attempt and re-dispatches fresh.

### State and resume

- `.scratch/<feature-slug>/status.md`: the dependency-ordered ticket table; per ticket
  `{status, path, sub_step, session_ids[], subagent_id, attempts, opencode_retries, worker_branch,
  commit, tokens:{local,fallback}}`; the integration branch ref; cumulative per-path
  token usage. Updated as each ticket transitions. No per-turn state-header block.
- `continue` performs Reality reconciliation (git refs, worktrees, each committed
  ticket's acceptance checks) before trusting recorded status; rewinds the integration
  branch to the last still-verifying commit on drift, lists discarded commits, re-plans,
  re-presents the Plan.
- `status` / `list` are read-only.

### Feature-scoped storage

```
.scratch/<feature-slug>/
├── issues/              # input: tickets (NN-<slug>.md), already published
├── spec.md              # input: parent specification
├── status.md            # run state
├── prompts/<NN>/<K>.md  # one self-contained sub-step prompt (with progress note)
├── logs/<NN>-<K>.jsonl  # opencode event stream per sub-step run
├── logs/<NN>-<K>.err    # opencode stderr per sub-step run
└── worktrees/<NN>/      # git worktree per ticket (gitignored), one at a time
```

### Handoff (on completion)

Print: integration branch name; one commit per ticket confirmed; per-path token usage
(local = `cost: 0`; each fallback ticket named with its Claude token spend and a note
that its code context left the machine); and the exact next commands —
`/code-review since <merge-base with main>`, then `/scrutinize` — to run in a fresh
context. No review, push, or PR.

### Rejected alternatives

- **Fork `agy-implement`'s parallel-wave core.** The wave/touch-set/concurrency
  machinery exists to spread load across providers; one local Ollama instance serializes
  inference regardless, so it is pure overhead here (adr/0005).
- **`BLOCKED` on every local-model ceiling instead of a fallback.** A weak model hits
  its ceiling often; the run would stall constantly (adr/0007).
- **Carry sub-step state with `opencode -s` session resume.** Resume replays the
  transcript, so context grows every sub-step — the opposite of what decomposition is
  for (adr/0006).
- **A verifier subagent (as in `subagent-implement`).** The worker is already an
  external process, so there is no orchestrator-context cost to save; the orchestrator
  being the verification authority is the right trust anchor for a weak model (adr/0002).
- **Extract a shared base skill now.** Deferred — three consumers is a better design
  basis than two, and this skill's worker contract still diverges (adr/0001).

## Testing Decisions

### What makes a good test here

`opencode-implement` is a prompt document with no executable code, so its tests exercise
**external behaviour only**: given a scenario (a ticket directory + a parent spec + a
described environment and sub-step size estimates), does the orchestrator produce the
right *Plan* and the right *routing decisions*, expressed as text. Tests assert on
observable
choices, never wording: dependency order, the step-plan fault line and sub-step count,
`local` vs `subagent-fallback` disposition, whether a ticket is blocked, halt-vs-continue,
whether source is mutated before approval, whether the orchestrator ever implements a
ticket itself, whether a fallback fires without a pause and is disclosed.

### The single seam

The **eval harness** is the one and only seam — scenarios fed to `SKILL.md`, the
orchestrator's response checked against expectations. There is no lower seam (zero-script
control plane). Anything that cannot be observed at this seam (real `opencode` subprocess
behaviour, real event-stream shape, real `git worktree` mechanics, the real token floor)
is covered by the **manual validation checklist** in Further Notes.

### Modules under test

- `evals/trigger-evals.json` — `/opencode-implement` and `$opencode-implement` (and the
  sub-commands) trigger (`true`); bare mentions of tickets, "implement this", `opencode`,
  Ollama, or a sibling skill do not (`false`), consistent with
  `disable-model-invocation: true`.
- `evals/evals.json` — one case per decision branch:
  1. Pure linear chain — dependency order 01..N, one commit per ticket, straight
     through, no wave table, no model column beyond the default.
  2. Independent tickets still run serially (no edge between 01 and 02 → still 01 then
     02; parallelism named a non-goal, not a follow-up).
  3. Cyclic ticket set → `BLOCKED (TICKET_SET_CYCLIC)` at planning, tickets named.
  4. Missing blocker → `BLOCKED (TICKET_SET_MISSING_BLOCKER)`, ticket and dangling ref
     named.
  5. Numbering inconsistent with topological order → `BLOCKED (TICKET_SET_NUMBERING)`.
  6. One-criterion ticket → a one-sub-step step plan (behaves like running it whole).
  7. Four-criterion ticket → a four-sub-step step plan by default, one criterion each.
  8. One criterion estimated over the budget → that sub-step split finer (by file/layer),
     shown in the step plan.
  9. No source mutation before Plan approval.
  10. Sub-step state carried by a worker-branch commit + a progress note, never by
      `opencode -s` session resume.
  11. A sub-step that overflows at runtime is re-split by the orchestrator and the
      re-split is recorded in `status.md` — the ticket is not failed for the bad
      estimate.
  12. Checkpoint check after each sub-step (expected red/green per the step plan); full
      verification gate once at ticket completion.
  13. Orchestrator reproduces the red state itself; a fabricated / not-actually-red test
      fails verification.
  14. Vacuous test (`expect(true).toBe(true)`) fails verification.
  15. Missing test→criterion coverage fails verification.
  16. Verification fails 3× on the local model → fallback fires automatically (no pause),
      the ticket's path becomes `subagent-fallback`.
  17. `TICKET_TOO_LARGE_FOR_CONTEXT` with fallback on → subagent directly, no `BLOCKED`.
  18. `TICKET_TOO_LARGE_FOR_CONTEXT` with `--no-fallback` → `BLOCKED
      (TICKET_TOO_LARGE_FOR_CONTEXT)`.
  19. `opencode` error event / non-zero exit within `MAX_OPENCODE_RETRIES` → retried
      locally, not escalated.
  20. `opencode` failure past `MAX_OPENCODE_RETRIES` → fallback fires.
  21. Fallback subagent does the whole ticket from clean integration `HEAD`; the partial
      local worktree and worker branch are discarded first.
  22. Fallback subagent also fails its full attempt budget → `BLOCKED
      (TICKET_VERIFICATION_FAILED)`.
  23. Every escalation recorded in `status.md` and named in the handoff with its Claude
      token spend.
  24. Orchestrator never implements — a hard ticket goes to fallback then `BLOCKED`,
      never hand-coded.
  25. Design-encoding merge conflict → `BLOCKED (INTEGRATION_DESIGN_CONFLICT)`, surfaced
      not resolved.
  26. Blocked ticket halts only its dependency branch; independent tickets are reported
      as an available partial path.
  27. Resume after a crash mid-run — reconciliation rewinds the integration branch to
      the last still-good commit and lists discarded commits.
  28. Dirty target tree at preflight → stop and ask, no stash.
  29. Worker attempts a package install → stops and is replanned; lockfile untouched.
  30. Completion handoff names the integration branch and the `/code-review` +
      `/scrutinize` commands, and does not push or open a PR.

### Prior art

`skills/agents/agy-implement/evals/` and `skills/agents/subagent-implement/evals/` —
same two-file shape (`trigger-evals.json`, `evals.json`), run on demand through
`skill-creator`'s eval tooling with no change to it.

## Out of Scope

- Running `/code-review` or `/scrutinize` — handed off, not performed.
- `git push`, pull requests, and any issue-tracker mutation.
- Bug-fix ticket sets and incident flows.
- Parallel execution of any kind (adr/0005) — not deferred, not planned.
- Per-ticket model selection by complexity, weight, or a capability floor.
- Cross-provider failover / a model list / round-robin (adr/0003). `--model` is a manual
  single override.
- Wiring `opencode-implement` into `engineering-workflow`.
- Extracting shared machinery into a common `references/` bundle or a base skill (adr/0001,
  deferred follow-up).
- Adapters for any CLI other than `opencode` (`agy` has `agy-implement`).
- Generating the tickets — that is `grill-to-tickets` / `to-tickets` upstream.
- Modifying `grill-to-tickets`, `agy-implement`, `subagent-implement`,
  `engineering-workflow`, `mattpocock/skills` files, or `skills-lock.json`.
- Tuning Ollama / `opencode` configuration (`OLLAMA_NUM_PARALLEL`, model params, the
  `opencode.json` permission profile) — the skill assumes a working `opencode run`.

## Further Notes

### Validation probes

The two design-blocking probes (worker bash, git snapshots) are **done and green**
(2026-09-07). The rest run during implementation and change parameter values, not the
spec's shape.

**Done and green (2026-09-07):**

- **`opencode run` event stream** — `--format json` emits newline-delimited JSON
  (`step_start`, `tool_use`, `text`, `step_finish`, `error`), sometimes interleaved with
  non-JSON log lines. Every event has `sessionID`. `step_finish.part.tokens.total` is the
  running context size; `part.cost` is `0`. Clean finish = `part.reason: "stop"`, exit 0.
- **Failure envelope** — an unknown model gave exit `1`, an `ERROR (#…)` stdout log line,
  and two `{"type":"error", error:{name, data:{message}}}` events. `sessionID` still
  present.
- **Worker runs edit *and bash* unattended (was design-blocking A)** — with
  `--dir <worktree> --dangerously-skip-permissions`, a worker read files and edited one
  (~180s), and in a separate run executed `node run.js` via its `bash` tool, captured
  `{"output":"hello from probe\n","exit":0}`, and reported it. The worker red/green
  protocol (worker writes the test, runs it, observes red, writes code, runs green) is
  buildable as specified. `opencode`'s default is already "allow all tools"; the flag is
  belt-and-suspenders.
- **Git snapshots vs. the worktree (was design-blocking B)** — after a worker run in an
  orchestrator-cut `git worktree` + worker branch: `git status` clean, `HEAD` still on
  the worker branch (not detached), only `main` and the worker branch exist, **no
  snapshot refs**. The reflog showed one blank entry + a `reset: moving to HEAD`, i.e.
  `opencode` momentarily touches `HEAD`/index and resets it — harmless when the run
  finishes, but a run *killed* mid-snapshot could leave a dirty index, so: set
  `{"snapshot": false}` (documented switch) per worktree + `.git/info/exclude`, and
  `continue` discards any half-built worktree rather than trusting its git state.
  `git merge --squash <branch>` takes only the branch tip regardless.
- **Token floor** — ~10.5–11k `tokens.total` peak across trivial and read+edit tasks.
  Budget `~13k` of sub-step content is conservative-safe; confirmed once by probe C.
- **Latency variance / possible hangs — not cleanly measured** — 2 of ~7 probe runs went
  long and were killed (43 min / capped at 10 min) on tasks whose twins finished in
  ~3 min; never observed to finish; a competing `opencode` TUI + stray process were alive
  and could have been thrashing Ollama; mid-run Ollama showed no model loaded (leans
  "stuck"). Raw Ollama generation stayed fast. Drives `FIRST_EVENT_TIMEOUT`, the
  smoke test, `MAX_OPENCODE_RETRIES = 3`, the fallback — and probe C.

**C. Real latency distribution AND context budget (calibration).** With **exclusive**
Ollama access, run ~10 realistic sub-steps (a criterion, its test, its impl slice, ~6–10
tool calls). For each record time-to-first-event, total wall time, kill/finish, and the
last `step_finish.tokens.total`. Set `FIRST_EVENT_TIMEOUT` / `STALL_INTERVAL` /
`WORKER_TIMEOUT` from the observed p95 + headroom, the context budget from
`32k − max(tokens.total) − margin`, and record the finish rate — if a meaningful fraction
still never finishes with exclusive access, that is a real `opencode` hang and the
smoke-test / fallback lean harder.

**D. Progress-note carry-over** — decompose a two-criterion ticket; confirm sub-step 2
(fresh session + progress note) builds on sub-step 1's committed work without re-reading
the whole ticket.

**E. Stall detection** — confirm the event-stream timestamp gap is a reliable
`possibly stalled` signal, and that killing a hung `opencode` PID (no `timeout` on macOS
— a background-PID + `sleep` + `kill` wrapper) leaves the worktree recoverable.

**F. Fallback dispatch** — confirm the Agent tool `isolation: "worktree"` lifecycle and
`SendMessage` resume for the fallback path (same posture `subagent-implement` takes).

### Deferred follow-ups

- Shared-machinery refactor once the implement siblings' `references/` stop diverging.
- An optional parallel mode, only if `--model` at a hosted provider becomes a real use
  case (it is not the purpose — adr/0005).
- Bug-fix ticket sets.
- A context-size hint to `grill-to-tickets` / `to-tickets` so tickets arrive sized for a
  small window and the criterion-level split is usually a no-op. Out of scope here
  (upstream skill, and adr/0001 forbids touching it), but noted: well-sized input makes
  the decomposition and fallback machinery rarely fire.

### Relationship to prior art

`qwen-agent` (9arm, captured in `.scratch/agy-implement/qwen-agent-skill.md`) is the
single-task local-delegation primitive: self-contained prompt, mind the context window,
split large jobs into bounded per-file chunks, verify the result yourself.
`opencode-implement` wraps a planning / decomposition / verification / integration
control plane around a chain of those dispatches, and adds the automatic subagent
fallback `qwen-agent` does not have. `agy-implement` and `subagent-implement` are the
sibling control planes; this spec's Stage 0 / verification gate / integration gate / state
model are deliberately parallel to theirs so a future shared-base refactor has three
aligned consumers.
