---
name: agy-agent
description: Delegate well-scoped coding, large-context analysis, search, testing, or mechanical tasks to an Antigravity CLI (`agy`) subagent. Use when offloading work to save host context and quota, when leveraging Gemini's 1M+ token context window for massive file/log or codebase exploration, or when the user says "use agy", "delegate to agy", "run in agy", or "ask antigravity". Do NOT use for tasks requiring conversational context from this chat, ambiguous architecture decisions, or interactive human clarification.
disable-model-invocation: true
---

# agy-agent

Delegate well-scoped, self-contained coding, analysis, and execution tasks to
Google Antigravity running headless via the `agy` CLI using the file-based I/O
protocol.

This pattern frees up the host agent's context window, preserves quota, enables
task-specific model routing, and unlocks Gemini's 1M+ token context window for
deep reading and execution.

## Invocation

Explicit invocation only — this skill dispatches a headless agent with blanket
tool approval, so it runs when the human asks for it by name:

- Universal / slash command: `/agy-agent <task description>`
- Codex command: `$agy-agent <task description>`
- Natural language: "use agy", "delegate this to agy", "run this in agy",
  "ask antigravity to …"

For an autonomous execution wave over a directory of `grill-to-tickets` tickets,
use `agy-implement` instead.

---

## Core Operating Workflow

Execute delegation through five sequential phases:

```
Phase 1: Assess & Route    evaluate context, reasoning depth, and select model
   │
   ▼
Phase 2: Scaffold Prompt   write self-contained prompt to /tmp/agy-prompts/<id>.md
   │
   ▼
Phase 3: Dispatch          run agy -p "$(cat ...)" > <id>.json 2> <id>.err
   │
   ▼
Phase 4: Verify Gate       check exit code, parse envelope, confirm SUCCESS, test diffs
   │
   ▼
Phase 5: Resume / Handoff  iterate via --conversation <id> if needed, else integrate
```

---

## Phase 1 — Task Assessment & Model Selection

Assess the task and select a model **tier** before dispatching. The reasoning
tier is part of the model slug (`-high` / `-medium` / `-low`); pass `--effort`
only to override a slug that lacks the tier you want, and skip it when the slug
already names the tier.

| Task Archetype | Recommended Tier (slug as of 2026-09-03) | Best Suited For |
|---|---|---|
| **Large-Context Ingestion** | Flash / high — `gemini-3.8-flash-high` | Whole-codebase surveys, 50MB+ log processing, multi-package mapping |
| **Deep Reasoning & Hard Bugs** | Pro / high — `gemini-3.1-pro-high` | Subtle race conditions, multi-boundary logic, complex architectural fixes |
| **Fast Mechanical Tasks** | Flash / medium — `gemini-3.8-flash-medium` | Bulk scaffolding, repetitive method renaming, boilerplate generation |
| **Independent Second Opinion** | A family different from the host — `gemini-3.1-pro-high` when the host is Claude; `claude-sonnet-4-6` when it is not | Cross-provider code audits and architecture critique |

Run `agy models` to confirm current slugs — the Flash line moves fast, so route
by tier, not by version string. For standard tasks without a specialized
constraint, omit `--model` and let `agy` use the environment's configured
default. Full matrix in [model-routing.md](references/model-routing.md).

---

## Phase 2 — File-Based Prompt Scaffolding

Store the subagent instructions in a temporary markdown file
(`/tmp/agy-prompts/<task-id>.md`) instead of passing inline strings. This
prevents shell quoting failures and escaped characters.

Ensure every prompt includes:
- Absolute paths for every input and output file (`/Users/...`).
- Explicit inputs, outputs, and checkable acceptance criteria.
- Target boundaries specifying whether files should be edited or only reported.
- Completely self-contained instructions, carrying no references to previous turns.

For a machine-checkable return, also write a JSON schema to
`/tmp/agy-prompts/<task-id>.schema.json`, end the prompt with "return your result
as JSON matching the schema", and pass `--json-schema` in Phase 3 — Phase 4 then
reads the envelope's `structured_output` instead of scraping prose.

Reference templates live in [prompt-scaffold.md](references/prompt-scaffold.md).

---

## Phase 3 — File-Based Dispatch

Execute `agy` using file-based prompt substitution, redirecting the envelope and
diagnostics to **separate** files:

```bash
agy -p "$(cat /tmp/agy-prompts/<task-id>.md)" \
  --dangerously-skip-permissions \
  --output-format json \
  --print-timeout 15m \
  --disable-slash-commands \
  [--model <model-slug>] \
  [--effort <low|medium|high>] \
  [--json-schema /tmp/agy-prompts/<task-id>.schema.json] \
  > /tmp/agy-logs/<task-id>.json \
  2> /tmp/agy-logs/<task-id>.err
```

Keeping stderr out of the `.json` file matters — one warning line merged in
breaks the Phase 4 parse.

`--dangerously-skip-permissions` is the default here because the dispatch was
explicitly requested and delegated tasks routinely run tests and builds. When the
task is read-only analysis, or the prompt's scope is broader than you would want
unattended, swap it for `--sandbox --mode accept-edits` (terminal sandboxed, file
edits still auto-accepted). Complete CLI options live in
[agy-contract.md](references/agy-contract.md).

---

## Phase 4 — Output Verification Gate

1. Check the process **exit code** first: `0` success, `1` error, `2` validation
   error. A non-zero code means read `/tmp/agy-logs/<task-id>.err` and stop.
2. Parse `/tmp/agy-logs/<task-id>.json` with the host's native file tools.
3. Confirm `status == "SUCCESS"`. Any of `ERROR`, `CANCELED`, `INTERRUPTED`,
   `INVALID`, `WAITING`, `RUNNING`, a missing envelope, or a truncated `response`
   is a failure — read the `error` field and the `.err` file.
4. Extract `response` for the summary, or `structured_output` when a schema was
   enforced. Retain `conversation_id` for follow-ups.
5. Run local tests and inspect git diffs in the host harness to verify the
   acceptance criteria — the host stays the authority on correctness.

---

## Phase 5 — Resumption & Multi-Turn Iteration

When modifications or compiler fixes are required, resume the active subagent
session rather than re-reading the entire project:

```bash
agy --conversation "<conversation_id>" \
  -p "$(cat /tmp/agy-prompts/<task-id>-followup.md)" \
  --dangerously-skip-permissions \
  --output-format json \
  --print-timeout 15m \
  --disable-slash-commands \
  > /tmp/agy-logs/<task-id>-followup.json \
  2> /tmp/agy-logs/<task-id>-followup.err
```

Full resumption rules, error recovery, and retry budgets live in
[multi-turn-workflow.md](references/multi-turn-workflow.md).

---

## Progressive References

- [model-routing.md](references/model-routing.md) — Heuristic matrix for task-aware model selection and reasoning effort
- [agy-contract.md](references/agy-contract.md) — Full CLI flags, permission modes, JSON envelope schema, exit codes, and timeout rules
- [prompt-scaffold.md](references/prompt-scaffold.md) — Self-contained templates for surveys, log crunching, bulk refactors, and tests
- [multi-turn-workflow.md](references/multi-turn-workflow.md) — Resuming conversations, verification loops, and retry budgets

---

## One-Time Harness Setup

Add a Bash allow rule in your harness settings (e.g. `~/.claude/settings.json`)
to run delegated subagent sessions without repeated interactive permission
prompts:

```json
{
  "permissions": {
    "allow": ["Bash(agy:*)"]
  }
}
```

## Boundaries

Keep tasks requiring interactive user clarification, deep unwritten
conversational context, or trivial single-line changes within the host agent
directly.
