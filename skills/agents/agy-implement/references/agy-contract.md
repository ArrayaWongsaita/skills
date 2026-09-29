# The `agy` worker contract

`agy` is a headless multi-model agent CLI (Claude-Code-shaped) at
`~/.local/bin/agy`. The orchestrator dispatches one `agy` process per ticket as a
**worker** and reads its JSON envelope.

## Invocation

```bash
agy -p "$(cat .scratch/<slug>/prompts/<NN>.md)" \
  --add-dir "<absolute path to the ticket's worktree>" \
  --output-format json \
  --print-timeout 45m \
  --disable-slash-commands \
  <permission mode> \
  [--model <id>] \
  > .scratch/<slug>/logs/<NN>.json 2>&1
```

| flag | why |
|---|---|
| `-p "<prompt>"` | non-interactive single task; the prompt is the worker prompt file's contents |
| `--add-dir <worktree>` | grant the worker its worktree; the process's working directory is that worktree, where the prompt's relative paths resolve |
| `--output-format json` | structured result envelope (below) |
| `--print-timeout 45m` | real implementation tasks exceed the 5m default; raise generously (default 45m, editable in the Plan) |
| `--disable-slash-commands` | a ticket body token like `/implement` cannot trigger anything inside the worker; the orchestrator owns all skill routing |
| `--model <id>` | passed **only** when the run has a model list; assigned at dispatch time by round-robin over dispatch order (see below) |

Paths in the prompt follow the path rule: a path inside the worker's working
directory is written relative to it; a path outside it — the parent `spec.md`,
an ADR, an untracked read-only Context file — is absolute. A read-only path
that `git ls-files --error-unmatch` does not match is untracked, so it resolves
by absolute path in the project root's main checkout.

### Permission mode

- **Default:** `--sandbox --mode accept-edits` — edits auto-accepted, terminal
  restrictions on. Each run confirms the sandbox permits the project's
  typecheck / test commands (validation probe 2).
- **Opt-in per run:** `--dangerously-skip-permissions`, confined to the ticket's
  `git worktree`. The user chooses this at Plan approval; it is logged in
  `status.md`.

Run each worker in the background (harness `run_in_background`) so the
orchestrator is re-invoked as each finishes and parses `logs/<NN>.json`.

## Result envelope

`agy --output-format json` returns:

```json
{
  "conversation_id": "f66501be-510d-4c0f-a0c1-2a0fde3d25f7",
  "status": "SUCCESS",
  "response": "<final assistant text — the worker's structured return>",
  "duration_seconds": 2.35,
  "num_turns": 1,
  "usage": {
    "input_tokens": 14151, "output_tokens": 1, "thinking_tokens": 0,
    "cache_read_tokens": 0, "total_tokens": 14152
  }
}
```

- `conversation_id` → feed to `agy --conversation <id> -p "<feedback>"` to resume
  the same worker for a retry.
- `status` → `SUCCESS` is confirmed by a probe. **The failure and timeout `status`
  values are provisional** — confirmed by **validation probe 1** (run `agy -p`
  with an impossible task and a short `--print-timeout`, record the tokens)
  before shipping. Treat any non-`SUCCESS` value, a missing envelope, or a
  truncated `response` as a worker failure.
- `response` → the worker's structured return: pre-implementation failing-test
  output, post-implementation passing output, the list of changed files, and a
  table mapping each new test to the acceptance criterion it covers.
- `usage` → rolled into `status.md` per provider. Budget each task as roughly
  `14k + ticket + spec sections + ADRs + files it reads + its own turns` — `agy`
  has a ~14k-token input floor for its own system prompt and project context.

## Retry, failover, and budgets

Two independent budgets:

- **`MAX_TICKET_ATTEMPTS = 3`** — verification failures (tests missing, not
  actually red first, still red, vacuous, or not covering the criteria). Each
  retry resumes the same worker: `agy --conversation <conversation_id> -p
  "<the specific failure detail>"`. The third failure yields
  `BLOCKED (TICKET_VERIFICATION_FAILED)`, the failure output is recorded in
  `status.md`, and the ticket's worktree is kept for inspection.
- **`MAX_FAILOVER_ATTEMPTS = 3`** — provider / infrastructure failures
  (rate-limit, timeout, crash). `Failover` re-runs the ticket on the next model
  in the run's list, or the same default model again when there is no list.
  Failover attempts are **not** counted against `MAX_TICKET_ATTEMPTS` — a
  provider outage is not the ticket's fault. Exhausting this budget yields
  `BLOCKED (TICKET_PROVIDER_FAILED)`.

## Model assignment at dispatch time

Model is assigned when a worker slot starts, not at planning. Each dispatched
worker takes the next model from the run's list by round-robin over **dispatch
order** (not ticket number — assigning by ticket number lets two simultaneous
workers land on the same provider, the rate-limit burst this exists to avoid).
With no list, every worker uses `agy`'s own default model. There is no per-ticket
reasoning about which model suits which ticket. The assignment is recorded in
`status.md` and reported in the handoff.

## Provisional values pending validation probes

| value | source of truth | probe |
|---|---|---|
| failure / timeout `status` tokens | validation probe 1 | `agy -p` impossible task, short `--print-timeout` |
| `--sandbox` permits typecheck/test | validation probe 2 | throwaway worktree, run the suite |
| `--conversation` retry carries context | validation probe 3 | one task, then a follow-up turn |
| whether a `--conversation` resume's `usage` is cumulative | validation probe 3 follow-up | one task, then a resume; compare the two envelopes' `usage` — `usage_total` sums each envelope, so a cumulative figure would double-count |
| `--json-schema` on the final result | validation probe 4 | enforce `{verdict, files[], red, green, coverage[]}` |
| real parallel worktree collisions | validation probe 5 | two edge-free tickets, two workers, dry-run merge |
| `stream-json` progress events | validation probe 6 | `agy --output-format stream-json` for stall detection |
