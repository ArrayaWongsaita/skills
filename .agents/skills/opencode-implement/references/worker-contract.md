# The `opencode` worker contract

Each sub-step is built by one headless `opencode run` **worker** on the local
model. This is the contract for invoking it, bounding it, and reading its result.
Values marked *provisional* are pinned by validation probe C before a real run is
trusted.

## Invocation

```bash
opencode run --format json \
  --model <model> \
  --dir <absolute path to the ticket's worktree> \
  --dangerously-skip-permissions \
  "$(cat .scratch/<slug>/prompts/<NN>/<K>.md)"
```

| flag | why |
|---|---|
| `--format json` | newline-delimited JSON events on stdout (parsed below) |
| `--model <model>` | the run's one `--model` value (default `ollama/qwen3.8:27b-mlx-32k`) |
| `--dir <worktree>` | the worker's working directory is the ticket's worktree; every path in the prompt is absolute |
| `--dangerously-skip-permissions` | edits and bash run unattended, confined to `--dir`. `opencode`'s default is already "allow all tools"; this is belt-and-suspenders. Confirmed by the preflight smoke test. |

There is no `--print-timeout` and no `--disable-slash-commands` in `opencode run`.

### Snapshots off

`opencode` takes internal git snapshots by default, which momentarily touch
`HEAD`/index. Before the first worker in a worktree, write `opencode.json` with
`{"snapshot": false}` into the worktree root and add `opencode.json` to that
worktree's `.git/info/exclude`, so the file never enters a diff and the snapshots
never run. `git merge --squash <worker-branch>` takes only the branch tip, so
integration is robust to stray refs regardless.

## Bounding a worker

`timeout` is not on macOS by default. Run the worker in the background, capture
its PID, and enforce three limits with a `sleep` + `kill` watcher:

- **`FIRST_EVENT_TIMEOUT`** (provisional 6m) — time to the first `step_start`
  event. A stuck run emits nothing; a healthy run's first event lands in ~1–2m.
- **`STALL_INTERVAL`** (provisional 8m) — the maximum gap between events once
  running. A worker past this is flagged `possibly stalled` in `status.md`.
- **`WORKER_TIMEOUT`** (provisional 45m) — the overall cap. Deliberately loose:
  a real sub-step on a slow local model can legitimately take 15–30m, and
  killing legitimate slow work wastes the whole run.

Killing a worker for any of the three is an **`opencode` failure** (below), not a
verification failure.

## Reading the event stream

`opencode run --format json` writes newline-delimited JSON to stdout, sometimes
interleaved with non-JSON log lines (e.g. `ERROR (#…): failed {…}`). Parse
defensively: read line by line, `JSON.parse` each line, **ignore lines that do
not parse**. Redirect stdout to `logs/<NN>-<K>.jsonl` and stderr to
`logs/<NN>-<K>.err`.

Event shapes seen:

| `type` | carries |
|---|---|
| `step_start` | `sessionID`, `part.snapshot` |
| `tool_use` | `part.tool` (`read` / `edit` / `bash` / …), `part.state.input`, `part.state.output`, `part.state.metadata.exit` for bash |
| `text` | `part.text` — assistant prose |
| `step_finish` | `part.reason` (`"stop"` \| `"tool-calls"`), `part.tokens` `{total, input, output, reasoning, cache:{write,read}}`, `part.cost` (`0` local) |
| `error` | `error.name`, `error.data.message` |

Every event carries `sessionID` (`ses_…`).

- **Success** = exit code `0` **and** a final `step_finish` with
  `part.reason: "stop"` **and** no `error` event. The last `step_finish`'s
  `part.tokens.total` is the peak context the sub-step used — roll it into
  `status.md`.
- **`opencode` failure** = a non-zero exit code, any `error` event, a missing
  final `step_finish`, a truncated stream, or a timeout / first-event / stall
  kill. This is distinct from a **verification failure** (the worker finished
  cleanly but its output is wrong — see
  [worktree-integration.md](worktree-integration.md)).

## Retry carry-over

A retry — for an `opencode` failure or a verification failure — is a **fresh
`opencode run`**, never `-s <session>` resume: resume replays the whole
transcript, so context would grow with every attempt, the opposite of what the
32k window allows. The new prompt carries a **progress note** (see
[prompt-scaffold.md](prompt-scaffold.md)) describing what is done and what this
attempt must fix. `sessionID`s are recorded in `status.md` for debugging only.

`MAX_OPENCODE_RETRIES = 3` for `opencode` failures. Exhausting it escalates the
whole ticket to the fallback (see [fallback.md](fallback.md)), or, under
`--no-fallback`, blocks it.

## Preflight smoke test

Before the first real dispatch, and with **nothing else using the local model**,
run one trivial `opencode run` (e.g. "reply with the word READY") under
`FIRST_EVENT_TIMEOUT`, in a throwaway directory, that also asks the worker to run
one `bash` command and make one edit. A slow, stuck, or failed smoke test stops
the whole run with a "free up / restart Ollama and opencode" message — it does
not begin a multi-hour run on a contended or wedged stack.
