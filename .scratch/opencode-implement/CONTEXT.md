# opencode-implement — Domain glossary / อภิธานศัพท์

Ubiquitous language for the `opencode-implement` skill. Use these names verbatim in
`SKILL.md`, `references/`, `spec.md`, tickets, tests, and the human guide.

## Actors and units

| term | meaning |
|---|---|
| **orchestrator** | The main agent (Claude). Plans the run, decomposes oversized tickets, writes worker prompts, runs verification, integrates, writes `status.md`. It **never implements a ticket itself** (adr/0002). |
| **worker** | One headless `opencode run` process on the local model, building exactly one **sub-step** test-first inside a git worktree. The `local` unit of work. |
| **fallback subagent** | One native harness subagent (Agent tool, `isolation: "worktree"`) dispatched for a whole ticket the local model could not deliver. The `subagent-fallback` unit of work (adr/0007). |
| **verifier** | Not a separate actor here. The orchestrator is the verification authority (adr/0002, and unlike `subagent-implement`). |

## Work decomposition

| term | meaning |
|---|---|
| **ticket** | A tracer-bullet vertical slice from `grill-to-tickets` / `to-tickets`, in the `to-tickets` local file format under `.scratch/<feature-slug>/issues/<NN>-<slug>.md`. The input unit. |
| **sub-step** | A slice of one ticket sized to fit the **context budget**. Every ticket is decomposed into an ordered chain of sub-steps; the default fault line is **one acceptance criterion per sub-step** (a one-criterion ticket → a one-sub-step chain). Each sub-step is a fresh worker dispatch against the same worktree (adr/0006). |
| **step plan** | The ordered list of sub-steps for one ticket, with each sub-step's file scope. Always built (length 1..N). Shown in the Plan; an estimate, re-split at runtime if a sub-step overflows. |
| **progress note** | The compact hand-off the orchestrator writes between sub-steps: files touched so far, current test status, what the next sub-step must do. A few hundred tokens — never the full transcript. Carries state instead of `opencode` session resume (adr/0006). |
| **context budget** | The per-sub-step ceiling for real work: `window − input floor − headroom`. Estimated at planning from `micro-prompt + spec sections + ADRs + files the sub-step must read + edits + reasoning headroom`. Enforced by decomposition. |
| **input floor** | The tokens `opencode` spends on its own system prompt, tool definitions, and project context before any ticket work — measured by a validation probe, provisionally ~11–15k of the 32k window. |

## Paths

| term | meaning |
|---|---|
| **path** | Which worker path a ticket takes: `local` (its sub-step chain ran on `opencode`) or `subagent-fallback` (escalated to one native subagent). Predicted per ticket in the Plan; the actual path recorded in `status.md`. |
| **fallback** | Automatic escalation of a whole ticket from `local` to `subagent-fallback`, with **no approval pause**, when the local model cannot deliver: a sub-step that cannot be split fine enough to fit the budget, a ticket that fails verification `MAX_TICKET_ATTEMPTS` times on the local model, or an `opencode` failure that persists past `MAX_OPENCODE_RETRIES`. Suppressed by `--no-fallback` — spends Claude tokens and sends the ticket off the machine, so it is predicted in the Plan and disclosed in the handoff (adr/0007). |

## Git and integration

| term | meaning |
|---|---|
| **integration branch** | `opencode-implement/<feature-slug>`, cut from `HEAD` at preflight. Receives exactly one squash commit per ticket, in ascending ticket-number order. |
| **worker branch** | `opencode-implement/<feature-slug>/<NN>`, cut from the current integration `HEAD` for ticket `NN`. Workers (and the fallback subagent) commit only here. |
| **worktree** | `.scratch/<feature-slug>/worktrees/<NN>` (gitignored), one per ticket, created and destroyed one at a time — the run is serial (adr/0005). Reuses the primary checkout's installed dependencies by symlink; a worker that needs a new dependency stops and is replanned. |

## Verification

| term | meaning |
|---|---|
| **verification gate** | The orchestrator's per-ticket check, run in the ticket's worktree: (1) the worker return is well-formed; (2) **reproduce red** — apply only the ticket's test files at the pre-ticket integration `HEAD`, confirm they fail for a missing behaviour, not a compile error; (3) every acceptance criterion maps to at least one new, non-vacuous test; (4) **green** — the new/changed tests pass and the typecheck passes. |
| **checkpoint check** | The lightweight check after each sub-step: the worktree still typechecks/compiles, and the tests touched so far are in the red/green state the step plan expects for that point (a just-written criterion test is red; a just-implemented one is green). Cheap; the full verification gate still runs once at ticket completion. |
| **vacuous test** | A test that asserts nothing meaningful — `expect(true).toBe(true)`, an assertion that recomputes the expected value the way the code under test does, a test that passes without the implementation. Fails the verification gate. |

## `opencode` worker contract

| term | meaning |
|---|---|
| **event stream** | `opencode run --format json` output: newline-delimited JSON events (`step_start`, `text`, `step_finish`, `error`), possibly interleaved with non-JSON log lines. Parsed defensively — non-JSON lines are ignored. |
| **session id** | The `sessionID` (`ses_…`) present on every event, including `error` events. Recorded in `status.md`. Not used for retry carry-over (adr/0006 — fresh session + progress note). |
| **step_finish** | The event carrying `part.reason` (`"stop"` on clean completion) and `part.tokens` `{total, input, output, reasoning, cache}` and `part.cost` (`0` for a local model). Token usage is rolled into `status.md`. |
| **worker failure** | Exit code ≠ 0, an `{"type":"error"}` event, a missing `step_finish`, a truncated return, or a timeout. Distinct from a **verification failure** (worker finished, output is wrong). |
| **stall** | A running worker that emits no new event for `STALL_INTERVAL` (default 10 min). Flagged `possibly stalled` in `status`; a worker with no output at all by `WORKER_TIMEOUT` (default 30 min, editable in the Plan) is killed as a worker failure. |

## Run states

| state | meaning |
|---|---|
| `ready-for-agent` | Ticket parsed, on the frontier or waiting for blockers. |
| `in-progress` | A worker (local sub-step or fallback subagent) is running for this ticket. |
| `verifying` | Worker returned; the orchestrator is running the verification gate. |
| `integrated` | Squash-merged onto the integration branch; checkboxes ticked. |
| `BLOCKED (TICKET_SET_CYCLIC)` | The dependency graph has a cycle. Halts the whole run at planning. |
| `BLOCKED (TICKET_SET_MISSING_BLOCKER)` | A `Blocked by` entry matches no ticket. Halts at planning. |
| `BLOCKED (TICKET_SET_NUMBERING)` | A ticket is blocked by a higher-numbered ticket. Halts at planning. |
| `BLOCKED (TICKET_VERIFICATION_FAILED)` | The ticket failed the verification gate `MAX_TICKET_ATTEMPTS` times on its final path (the fallback subagent with fallback on; the local path with `--no-fallback`). Worktree kept. |
| `BLOCKED (TICKET_TOO_LARGE_FOR_CONTEXT)` | Only under `--no-fallback`: a sub-step cannot be split fine enough to fit the context budget. With fallback on, this escalates to the subagent instead. |
| `BLOCKED (INTEGRATION_DESIGN_CONFLICT)` | A merge conflict that encodes a design decision. The orchestrator surfaces it rather than resolving it. |
