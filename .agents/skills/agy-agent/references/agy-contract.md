# The `agy` CLI Contract

`agy` is Google Antigravity's CLI, driven here in **headless mode** (`-p`). The
host agent dispatches a self-contained task non-interactively and reads the
structured JSON envelope. Source of truth for this contract:
<https://antigravity.google/docs/cli/headless/>.

## Invocation Syntax

Run `agy` with file-based prompt substitution and **split stdout from stderr**:

```bash
agy -p "$(cat /tmp/agy-prompts/<task-id>.md)" \
  --output-format json \
  --print-timeout 15m \
  --disable-slash-commands \
  --dangerously-skip-permissions \
  [--model <model-slug>] \
  [--effort <low|medium|high>] \
  [--json-schema /tmp/agy-prompts/<task-id>.schema.json] \
  [--add-dir <workspace-dir>] \
  > /tmp/agy-logs/<task-id>.json \
  2> /tmp/agy-logs/<task-id>.err
```

Keep the envelope (stdout) and diagnostics (stderr) in separate files. A single
warning line merged into the `.json` file breaks `JSON.parse` and the Phase 4
gate reads it as a failure.

## CLI Flags Reference

| Flag | Purpose | Guidance |
|---|---|---|
| `-p "$(cat <file>)"` | Run one prompt non-interactively (`--print` / `--prompt`) | Store the prompt in a temp markdown file to avoid shell-quoting failures |
| `--output-format json` | Structured JSON envelope on stdout | Alternatives: `text` (default), `stream-json` |
| `--print-timeout <dur>` | Max wait for the run (default `5m`) | Raise it — `15m` for analysis / mechanical tasks, more for builds |
| `--disable-slash-commands` | A literal `/foo` token in the prompt text will not expand into a skill or command | Keeps the prompt body inert; the host owns all routing |
| `--dangerously-skip-permissions` | Auto-approves every tool call | **This skill's default** — see Permission Modes below |
| `--sandbox` + `--mode accept-edits` | Terminal commands sandboxed; file edits auto-accepted | The safer alternative — see Permission Modes |
| `--model <slug>` | Select a model, e.g. `gemini-3.8-flash-high` | See [model-routing.md](model-routing.md); omit to use the environment default |
| `--effort <low\|medium\|high>` | Override the reasoning tier | Only when the slug does not already name the tier you want — do **not** pair a `-high` slug with `--effort high` |
| `--json-schema <str\|path>` | Enforce a schema on the final result | Populates `structured_output` in the envelope — use it so Phase 4 parses fields, not prose |
| `--add-dir <path>` | Grant directory access | Pass when the task reads or writes outside the current directory |
| `--agent <name>` | Run a named agent profile | `agy agents` lists them; profiles live in `agents/*.yaml` |
| `--conversation <id>` | Resume a previous session by id | Follow-up revisions (`--continue` / `-c` resumes the most recent) |
| `--input-format <fmt>` | `text` (default) or `stream-json` | `stream-json` feeds multiple turns over stdin |

## Result Envelope Schema

`agy --output-format json` emits (fields per the official headless reference):

```json
{
  "conversation_id": "fe828b0d-ad7b-4cca-8159-207436a59721",
  "status": "SUCCESS",
  "response": "<final assistant markdown>",
  "error": "<error string — present on failures only>",
  "duration_seconds": 18.42,
  "num_turns": 3,
  "structured_output": {},
  "json_schema": {},
  "usage": {
    "input_tokens": 34120,
    "output_tokens": 842,
    "thinking_tokens": 410,
    "cache_read_tokens": 0,
    "total_tokens": 34962
  }
}
```

### Field Contracts
- `conversation_id` — stable id for resuming the session (`--conversation <id>`).
- `status` — one of `SUCCESS`, `ERROR`, `CANCELED`, `INTERRUPTED`, `INVALID`,
  `WAITING`, `RUNNING`. Only `SUCCESS` is a completed run; treat every other
  value, a missing envelope, or a truncated `response` as a failure.
- `response` — the subagent's textual conclusion and change summary.
- `error` — populated on failure only; read it (and the `.err` file) whenever
  `status != SUCCESS`.
- `duration_seconds`, `num_turns` — wall-clock seconds and turn count.
- `structured_output` — the schema-conforming object when `--json-schema` was
  passed; `json_schema` echoes the schema that was applied.
- `usage` — token totals across input, output, reasoning, and cache reads.

### Exit Codes
`0` success · `1` error · `2` validation error. Check the process exit code
**before** parsing the envelope.

## Permission Modes

- **Default for this skill: `--dangerously-skip-permissions`.** `agy-agent` is
  dispatched only on an explicit human ask, and its tasks routinely run
  tests / builds / tooling, so blanket approval is the pragmatic choice. This is
  a deliberate divergence from `agy-implement`, which defaults to the sandbox
  because it dispatches workers unattended.
- **Alternative: `--sandbox --mode accept-edits`.** Terminal commands stay
  sandboxed while file edits are still auto-accepted. Reach for this when the
  task is read-only analysis, or when you do not fully trust the scope the
  prompt actually grants.

## Structured Output (`--json-schema`)

Write the schema next to the prompt file and pass its path. End the prompt with
"return your result as JSON matching the schema." Phase 4 then reads
`structured_output` instead of scraping `response`. Example:

```json
{
  "type": "object",
  "required": ["verdict", "summary"],
  "properties": {
    "verdict": { "enum": ["DONE", "BLOCKED", "PARTIAL"] },
    "files_changed": { "type": "array", "items": { "type": "string" } },
    "commands_run": { "type": "array", "items": { "type": "string" } },
    "summary": { "type": "string" }
  }
}
```

## Progress & Stall Detection

`--output-format stream-json` emits newline-delimited events: `init` (session
start), `step_update` (per-step progress), `result` (turn completion). Use it to
watch a long run rather than block on a single envelope.

## Resumption

`--conversation <conversation_id>` resumes a specific prior session with its
context intact; `--continue` / `-c` resumes the most recent. Full loop and retry
budget in [multi-turn-workflow.md](multi-turn-workflow.md).
