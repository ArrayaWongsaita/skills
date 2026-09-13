# 02: `opencode` worker contract — whole-ticket dispatch, model resolution-and-pin, two-rule retry

**What to build:** A worker now builds the **whole ticket** (not a sub-step) in
one `opencode run` dispatch. The run's model is resolved exactly once, before
any worker dispatches, and then **pinned**: every worker for the rest of the
run — including every parallel worker in every later wave — receives that
captured value as an explicit `--model` flag, so a model change elsewhere on
the machine mid-run cannot silently split one run across two models. Retry
carry-over follows two distinct rules instead of the old fresh-dispatch-plus-
progress-note pattern: a verification failure resumes the same `opencode`
session; an `opencode`-process failure redispatches fresh on the same pinned
model.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] `references/worker-contract.md` specifies the **model-resolution-and-pin**
      procedure: if the user passed `--model` at invocation, use it directly;
      otherwise dispatch one resolution check with no `--model` flag so
      `opencode run` resolves its own model (config → last used → internal
      default), read the resolved value back via `opencode models` (or the
      first event stream), record it in the Plan and `status.md`, and pass
      that captured value as an explicit `--model` to every subsequent worker
      for the rest of the run — no worker ever omits `--model` after this
      first resolution
- [x] `references/worker-contract.md`'s invocation is `opencode run --format
      json --model <pinned-model> --dir <worktree>
      --dangerously-skip-permissions "<prompt>"`, building the whole ticket in
      one dispatch, replacing the old per-sub-step invocation
- [x] `references/worker-contract.md` retains the event-stream parsing and
      success/failure envelope definitions unchanged: newline-delimited JSON
      possibly interleaved with non-JSON log lines; success = exit 0 + final
      `step_finish` with `part.reason: "stop"` + no `error` event; failure =
      non-zero exit, an `error` event, a missing final `step_finish`, a
      truncated stream, or a timeout/stall kill
- [x] `references/worker-contract.md` specifies **two retry rules**: a
      verification failure (bounded by `MAX_TICKET_ATTEMPTS`) resumes the same
      session — `opencode run -s <session>` carrying the specific failure as
      the next turn; an `opencode`-process failure (bounded by
      `MAX_OPENCODE_RETRIES`) is a **fresh dispatch** on the same pinned
      model, never a session resume (a crashed, timed-out, or stall-killed
      worker may have no resumable session — a worker killed before its first
      event has no `sessionID` at all)
- [x] `references/worker-contract.md` specifies that multiple `opencode run`
      processes may be in flight concurrently (one per parallel worker), each
      with its own `--dir <worktree>` and its own background-PID timeout
      watcher (`FIRST_EVENT_TIMEOUT` / `STALL_INTERVAL` / `WORKER_TIMEOUT`
      applied per worker, not per run)
- [x] `references/worker-contract.md` marks `FIRST_EVENT_TIMEOUT`,
      `STALL_INTERVAL`, and `WORKER_TIMEOUT` as provisional pending a fresh
      calibration probe against the resolved hosted model, with no numeric
      defaults carried over from the retired local-model probe
- [x] `references/worker-contract.md` drops the "nothing else using the local
      model" preflight caveat and the "restart Ollama and opencode" smoke-test
      failure message
- [x] `references/worker-contract.md` retains git-snapshot handling unchanged:
      `opencode.json` `{"snapshot": false}` written into the worktree and
      excluded from that worktree's diff
- [x] `evals/evals.json`: a run with no `--model` given resolves once and pins
      — a second (or later, or concurrent) worker dispatch in the same run is
      shown receiving an explicit `--model` matching the first resolution; a
      verification-failure retry resumes the same session; an
      `opencode`-process failure retries as a fresh dispatch on the same
      pinned model, never a resume
- [x] `npm run validate` and `npm test` pass
