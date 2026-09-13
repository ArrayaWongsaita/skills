# 2. Drop criterion-level decomposition; adopt wave computation and parallel dispatch from `agy-implement`

## Status

Accepted

## Context

`opencode-implement` decomposed every ticket into one sub-step per acceptance
criterion specifically to fit a local 27B model's ~32k context window
(`.scratch/opencode-implement/adr/0006-context-fit-decomposition.md`), and ran
strictly serially because "one local model instance serializes inference
regardless" (repo/feature adr/0005). Both reasons are local-model-specific and
no longer apply once the resolved model is a hosted model (DeepSeek V4.1 Flash)
with a much larger window and native support for concurrent requests. The user
asked for full convergence with `agy-implement`'s execution model: wave
computation, touch-set/overlap estimation, and parallel dispatch across
worktrees.

## Decision

- **Decomposition is eliminated.** A worker builds the **whole ticket**
  test-first in one `opencode run` dispatch — the same granularity the fallback
  subagent already used. `sub-step`, `step plan`, `progress note`, `context
  budget`, and `input floor` are retired terms (see CONTEXT.md).
- **Planning adopts `agy-implement`'s wave algorithm**: build the ticket
  dependency DAG (same validation: acyclic, blockers resolvable, numbering
  consistent with topological order), compute waves (wave 0 = no blockers, wave
  K = all blockers landed in earlier waves), estimate each ticket's touch-set as
  an advisory hint, and flag likely-overlapping same-wave pairs for the user to
  decide whether to serialize at Plan approval.
- **Dispatch is parallel within a wave.** Independent tickets in the same wave
  each get their own `worktrees/<NN>/` and their own concurrent `opencode run`
  worker process, mirroring `agy-implement`'s "serial in-tree, parallel in
  worktrees." The orchestrator is re-invoked as each backgrounded worker
  finishes.
- **A ticket escalating to fallback does not block its wave-mates'
  integration.** Caught during Stage 2 design review: a literal "integrate
  once every ticket in the wave has passed" would make the whole wave's
  integration — and the start of the next wave — wait on the fallback tier's
  extra subagent dispatch (potentially the slowest thing in the wave),
  defeating the point of adopting parallel dispatch. Instead, each ticket that
  passes verification is squash-merged as soon as it's ready, independent of
  its wave-mates' state — the same "everything that passed is integrated"
  precedent `agy-implement` already applies to a `BLOCKED` ticket. A ticket
  in the fallback tier integrates on its own once it finishes, cut from
  whatever integration `HEAD` exists at that point (which may already include
  its former wave-mates' work). The wave as a *planning* unit still gates when
  the *next* wave may start — every ticket in the current wave must reach a
  terminal state (integrated or `BLOCKED`) first — but it no longer gates when
  each individual ticket's own integration happens.
- **Retry-on-verification-failure resumes the same `opencode` session**
  (`opencode run -s <session>` carrying just the specific failure as the next
  turn), mirroring `agy-implement`'s `agy --conversation <id> -p "<feedback>"`.
  The old fresh-dispatch-plus-progress-note pattern is dropped for this case —
  it existed solely to avoid growing a resumed transcript past the 32k window,
  which is no longer the constraint. **This applies only to
  `MAX_TICKET_ATTEMPTS` verification-failure retries** — the worker finished
  cleanly and only its output was wrong, so its session is known-good to
  resume. `MAX_OPENCODE_RETRIES` `opencode`-process failures (crash, timeout,
  stall kill, malformed envelope) keep the **fresh-dispatch** pattern
  unchanged from the shipped skill: a session that failed to complete may not
  exist or be resumable at all (a worker killed before its first event never
  got a `sessionID`), and `agy-implement` itself draws exactly this line
  between its two retry budgets (`MAX_TICKET_ATTEMPTS` resumes,
  `MAX_FAILOVER_ATTEMPTS` redispatches fresh). Caught during Stage 2 design
  review — the first draft of this ADR stated resume without this scoping.
- `MAX_TICKET_ATTEMPTS = 3` still bounds verification-failure retries.
  `MAX_OPENCODE_RETRIES = 3` still bounds `opencode`-process failures (crash,
  timeout, malformed envelope) — mirroring `agy-implement`'s separate
  `MAX_FAILOVER_ATTEMPTS` budget in spirit, but **without** the failover-to-a-
  different-model behavior (see
  [[adr-0004-cost-disclosure-and-no-failover]] — `opencode-implement` still uses
  exactly one model for the whole run).

## Consequences

- `references/decomposition.md`, `references/prompt-scaffold.md`'s per-sub-step
  scaffold, and the step-plan portions of `references/planning.md` are removed
  or rewritten wholesale, not patched.
- `references/planning.md`, `references/worktree-integration.md`, and
  `references/status-and-resume.md` are rewritten to mirror `agy-implement`'s
  same-named files' shape (wave table, touch-set estimation, overlap flags,
  per-wave integration gate), adapted to the `opencode` CLI contract instead of
  the `agy` CLI contract.
- Timeouts (`FIRST_EVENT_TIMEOUT`, `STALL_INTERVAL`, `WORKER_TIMEOUT`) were
  calibrated for a slow local model doing small sub-steps; they are now stale in
  both directions (a hosted model is faster per token, but each dispatch now
  covers a whole ticket instead of one criterion) and need a fresh calibration
  probe against the resolved hosted model before being trusted — tracked as a
  tickets-stage item, not re-guessed here.
- Supersedes `.scratch/opencode-implement/adr/0006-context-fit-decomposition.md`
  (left in place as history) and the "no wave computation, no touch-set
  estimation" rejection recorded in the original `references/planning.md`.

## Rejected alternatives

- **Keep criterion-level decomposition as a discipline independent of window
  size**, sizing the context budget dynamically per resolved model instead of
  dropping it. Considered first; rejected once the user confirmed they no
  longer see context as a real constraint with a hosted model and want full
  `agy-implement`-style convergence, which decomposes by ticket, not by
  criterion.
- **Keep serial-only dispatch.** Rejected: it forfeits the throughput a fast,
  cheap hosted model like DeepSeek Flash is well suited to, for no remaining
  correctness reason.
