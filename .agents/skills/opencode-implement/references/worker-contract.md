# The `opencode` worker contract

Each ticket is built by one headless `opencode run` **worker** on the resolved
and pinned model, in one dispatch. This is the contract for resolving the model,
invoking the worker, bounding it, and reading its result.

## Model resolution and pin

The run's model is resolved **exactly once**, before wave 0, and **pinned** for
the rest of the run.

**If the user passed --model at invocation** (i.e., `--model <provider/model>` was
given explicitly), that value is used directly — no resolution check needed.

**If no `--model` flag was given at invocation**, dispatch one resolution check
with no `--model` flag so `opencode run` resolves its own model (its config →
last model used → internal default). Read the resolved value back via
`opencode models` (or the `sessionID`/model field on the first `step_start`
event). Capture it.

From that point on, **every worker for the rest of the run** — including every
parallel worker in every later wave — is dispatched with that captured value as
an explicit `--model` flag. No worker ever omits `--model` after this first
resolution. Without this pin, a model change in the user's own `opencode`
session (or any other process on the machine) between ticket dispatches would
silently split one run across two different models.

The resolved model is recorded in the **Plan** and **`status.md`** before wave 0
starts.

## Invocation

Canonical form (all on one line for readability; the shell also accepts the `\` continuation below):

```
opencode run --format json --model <pinned-model> --dir <worktree> --dangerously-skip-permissions "<prompt>"
```

Expanded form for clarity:

```bash
opencode run --format json --model <pinned-model> --dir <worktree> \
  --dangerously-skip-permissions "$(cat .scratch/<slug>/prompts/<NN>.md)"
```

| flag | why |
|---|---|
| `--format json` | newline-delimited JSON events on stdout (parsed below) |
| `--model <pinned-model>` | the run's one resolved-and-pinned model; passed explicitly to every worker |
| `--dir <worktree>` | the worker's working directory is the ticket's worktree; every path in the prompt is absolute |
| `--dangerously-skip-permissions "<prompt>"` | edits and bash run unattended, confined to `--dir`. `opencode`'s default is already "allow all tools"; this is belt-and-suspenders. |

There is no `--print-timeout` and no `--disable-slash-commands` in `opencode run`.

The prompt at `.scratch/<slug>/prompts/<NN>.md` is the whole-ticket
self-contained prompt for ticket `<NN>`. One file per ticket, not per sub-step.

### Snapshots off

`opencode` takes internal git snapshots by default, which momentarily touch
`HEAD`/index. Before the first worker in a worktree, write `opencode.json` with
`{"snapshot": false}` into the worktree root and add `opencode.json` to that
worktree's `.git/info/exclude`, so the file never enters a diff and the snapshots
never run. `git merge --squash <worker-branch>` takes only the branch tip, so
integration is robust to stray refs regardless.

## Bounding a worker

`timeout` is not on macOS by default. Run the worker in the background, capture
its PID, and enforce three limits with a `sleep` + `kill` watcher — applied
**per worker**, not per run, since multiple `opencode run` processes may be in
flight concurrently:

- **`FIRST_EVENT_TIMEOUT`** (provisional — see calibration note below) — time to
  the first `step_start` event. A stuck run emits nothing.
- **`STALL_INTERVAL`** (provisional — see calibration note below) — the maximum
  gap between events once running. A worker past this is flagged `possibly
  stalled` in `status.md`.
- **`WORKER_TIMEOUT`** (provisional — see calibration note below) — the overall
  cap per worker.

All three values are **provisional pending a fresh calibration probe against the
resolved hosted model** doing whole-ticket work. The old values were calibrated
for a slow local model doing single-criterion sub-steps; both the model's speed
and the workload shape have changed, so no numeric defaults are carried over from
that probe.

Killing a worker for any of the three is an **`opencode` failure** (below), not a
verification failure.

## Concurrency

Multiple `opencode run` processes may be in flight concurrently — one per
parallel worker in a wave. Each worker runs with its own `--dir <worktree>` and
its own background-PID timeout watcher (`FIRST_EVENT_TIMEOUT` /
`STALL_INTERVAL` / `WORKER_TIMEOUT` applied per worker, not per run).

## Reading the event stream

`opencode run --format json` writes newline-delimited JSON to stdout, sometimes
interleaved with non-JSON log lines (e.g. `ERROR (#…): failed {…}`). Parse
defensively: read line by line, `JSON.parse` each line, **ignore lines that do
not parse**. Redirect stdout to `logs/<NN>.jsonl` and stderr to
`logs/<NN>.err`.

Event shapes seen:

| `type` | carries |
|---|---|
| `step_start` | `sessionID`, `part.snapshot` |
| `tool_use` | `part.tool` (`read` / `edit` / `bash` / …), `part.state.input`, `part.state.output`, `part.state.metadata.exit` for bash |
| `text` | `part.text` — assistant prose |
| `step_finish` | `part.reason` (`"stop"` \| `"tool-calls"`), `part.tokens` `{total, input, output, reasoning, cache:{write,read}}`, `part.cost` |
| `error` | `error.name`, `error.data.message` |

Every event carries `sessionID` (`ses_…`).

- **Success** = exit code `0` **and** a final `step_finish` with
  `part.reason: "stop"` **and** no `error` event. Roll `part.cost` (or
  `part.tokens` counts, if the provider does not report cost) into
  `tokens.main` in `status.md`.
- **`opencode` failure** = a non-zero exit code, any `error` event, a missing
  final `step_finish`, a truncated stream, or a timeout / first-event / stall
  kill. This is distinct from a **verification failure** (the worker finished
  cleanly but its output is wrong — see
  [worktree-integration.md](worktree-integration.md)).

## Retry carry-over — two distinct rules

Retry behavior differs by failure type:

### Rule 1 — Verification failure → resume the same session (`MAX_TICKET_ATTEMPTS`)

When the orchestrator's verification gate rejects a worker's output, the worker
itself finished cleanly — its session is known-good to resume. Retry by resuming
the same `opencode` session:

```bash
opencode run -s <session> --format json --model <pinned-model> \
  --dir <worktree> --dangerously-skip-permissions "<specific failure detail>"
```

The specific failure (the failing test output, the vacuous assertion, the
uncovered criterion) is the next turn in the resumed session. `sessionID`s are
recorded in `status.md` either way.

`MAX_TICKET_ATTEMPTS = 3` bounds verification-failure retries. Exhausting it
escalates the whole ticket to the fallback (see [fallback.md](fallback.md)), or,
under `--opencode-only`, blocks it.

### Rule 2 — `opencode`-process failure → fresh dispatch on the same pinned model (`MAX_OPENCODE_RETRIES`)

A crash, timeout, stall kill, or malformed envelope leaves no guarantee that a
session exists or is resumable. A worker killed before its first event has no
`sessionID` at all. Never attempt a session resume after an `opencode`-process
failure — redispatch fresh on the same pinned model, from the same clean prompt:

```bash
opencode run --format json --model <pinned-model> --dir <worktree> \
  --dangerously-skip-permissions "$(cat .scratch/<slug>/prompts/<NN>.md)"
```

`MAX_OPENCODE_RETRIES = 3` bounds `opencode`-process failure retries. Exhausting
it escalates to the fallback tier — never to a different model.
