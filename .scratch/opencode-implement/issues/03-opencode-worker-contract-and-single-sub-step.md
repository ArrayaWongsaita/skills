# 03: The `opencode` worker contract and a single sub-step dispatch

**What to build:** With an approved Plan, the orchestrator can dispatch one sub-step to a
headless `opencode run` worker against an isolated worktree with a self-contained
test-first prompt, parse `opencode`'s JSON event stream defensively, decide
success/failure/timeout/stall, and retry an `opencode` failure a bounded number of times.
A preflight smoke test confirms the local stack responds this session before any real
dispatch.

**Blocked by:** 02

**Status:** done

- [x] `references/worker-contract.md` documents the invocation
      (`opencode run --format json --model <model> --dir <worktree>
      --dangerously-skip-permissions "<prompt>"`), the wrapper that enforces
      `FIRST_EVENT_TIMEOUT` (default 6m), `STALL_INTERVAL` (default 8m), and
      `WORKER_TIMEOUT` (default 45m) — all marked provisional pending validation probe C
      — with no `timeout` binary on macOS (a background-PID + `sleep` + `kill` wrapper),
      and the `{"snapshot": false}` `opencode.json` written per worktree and added to
      that worktree's `.git/info/exclude`
- [x] `references/worker-contract.md` documents parsing the newline-delimited JSON event
      stream (`step_start`, `tool_use`, `text`, `step_finish`, `error`), ignoring
      interleaved non-JSON log lines: success = exit 0 + a final `step_finish` with
      `part.reason: "stop"` and no `error` event; failure = non-zero exit, an
      `{"type":"error"}` event, a missing final `step_finish`, a truncated stream, a
      first-event/stall/overall timeout kill; `part.tokens` rolled into `status.md`;
      `sessionID` recorded for debugging (retry uses a fresh session, not `-s`)
- [x] `references/prompt-scaffold.md` defines the per-sub-step worker prompt: absolute
      working directory; the ticket's "What to build" context and **this sub-step's
      acceptance criterion** verbatim; relevant parent-spec sections / ADRs / glossary;
      the assigned test seam; the **progress note** (files touched so far, current test
      status, what this sub-step must do); the full red-green-refactor protocol inline;
      the constraints (touch only what this sub-step needs; commit on the worker branch,
      never push or open a PR; no package installs; no repo scan; stop and report a
      missing decision rather than guess); and the required structured return (red
      output, green output, changed files, test→criterion mapping)
- [x] `references/worker-contract.md` specifies `MAX_OPENCODE_RETRIES = 3` for `opencode`
      failures (each a fresh dispatch), distinct from the verification budget in ticket
      04
- [x] SKILL.md Stage 1 gains the preflight smoke test (one trivial `opencode run` under
      `FIRST_EVENT_TIMEOUT`; a hang or failure stops the run with a "restart Ollama /
      opencode" message) and the single-sub-step dispatch path
- [x] `evals/evals.json` cases: `opencode` error event / non-zero exit within
      `MAX_OPENCODE_RETRIES` → retried locally, not escalated; first-event / stall /
      overall timeout → worker failure; a hung smoke test → run does not start; the
      worker prompt carries the criterion, seam, progress note, and RGR protocol
- [x] `npm run validate` and `npm test` pass
