# Architecture

`engineering-workflow` is the control plane. It owns classification, routing,
durable state, transitions, gate budgets, bounded loops, resume, and the final
`COMPLETE`/`BLOCKED` decision. Installed specialist skills retain sole ownership of
their respective disciplines.

```text
explicit user request
        |
engineering-workflow
        |-- status.md -------------> Markdown artifact state & gate records
        |-- references/ -----------> Progressive disclosure routing and gate rules
        `-- external engineering skill --> repository artifacts/evidence
```

The external skill remains the source of truth. The orchestrator supplies the
request, bounded artifact references, and repository context, then normalizes
the returned result into state. It maintains external dependencies as distinct
packages. A missing dependency pauses the route until installed.

## Runtime adapters and capability model

The orchestrator operates universally across AI agent harnesses (Antigravity, Cursor, Roo Code, Aider, Claude Code, Codex) by probing dynamic environment capabilities:

- **Subagent-capable runtimes (`has_subagents: true`)**: In `IMPLEMENTATION`, the orchestrator iterates through ordered tickets, dispatching an isolated transient subagent (`self`) per ticket. This isolates context windows and preserves peak Smart Zone reasoning.
- **Single-session CLI runtimes (`has_subagents: false`)**: The orchestrator outputs explicit phase boundary instructions (`/clear`) and resumption commands (`/implement <ticket>`).
- **Codex adapter**: Audits and loads the exact resolved `SKILL.md` path when model-loadable; records `$skill-name` user handoff when explicit-only.
- **Claude Code adapter**: Dispatches model-invocable plugin skills via `Skill` tool; records `USER_INVOCATION_REQUIRED` with `/skill-name` for user-only skills.

## Persistence boundary

State contains identity, classification, stage/mode, compact transition
history, dependency resolutions/status, dependency-install pause/permission
records, independent design/system scrutinize counters and compact cycle
history, code gate counters, child IDs, and fingerprinted artifact references.
Full specs, tickets, reviews, and reports reside as repository files.
State updates apply directly to `.scratch/<feature-slug>/status.md`.
Completed state is retained for audit and idempotency.

Design and system scrutinize each have `MAX_SCRUTINIZE_CYCLES=6`; cycle counts
track completed reviews. A non-`SHIP` result on cycle 6, or demonstrable
no-progress earlier, transitions to `BLOCKED`. Final-system fixes return through
validation and code review before the next system review.

## Large-project composition

The parent stores a destination, frontier references, and child workflow IDs.
Each bounded feature maintains independent state and gates. Assumption
changes return to the external `wayfinder` skill before new child scopes are created.

## Distribution

The repository remains CLI-first under ADR 0001. This change adds one
orchestrator skill directly, maintaining external specialist packages as dependencies.
