---
name: retro-to-remedies
description: Review a finished Run's primary sources to classify misses into environment remedies, commit applied text remedies, record outcomes in the Retro Log, and hand off code remedies before pr-to-dev.
disable-model-invocation: true
---

# Retro To Remedies

Review a finished Run's primary sources, classify its misses into environment remedies, commit approved text remedies on the integration branch, update the persistent Retro Log, and hand off code remedies before opening a pull request.

Start this skill exclusively on explicit human invocation via `/retro-to-remedies` or `$retro-to-remedies`.

## Invocation Surface

```text
/retro-to-remedies [<feature-slug>] [--transcript] [--fresh]
```

Codex shortcut: `$retro-to-remedies`

### Target Resolution

Resolve the target feature slug using the following precedence:

1. **Explicit argument**: Use `<feature-slug>` when supplied on the command line.
2. **Integration branch stem**: Derive the slug from the checked-out branch name (for example, `subagent-implement/<slug>` yields `<slug>`).
3. **Most recently modified scratch directory**: Inspect `.scratch/*/` and select the most recently modified directory, naming it back to the user for explicit confirmation before proceeding.

### Branch Guardrail

Run exclusively from a working feature or integration branch. When currently on `main`, `master`, or `dev`, stop execution before reading any primary source or log file, and prompt the user with the exact name of a branch to create.

## Stages Overview

### Stage 0 — Collect (read-only)

Inspect the working tree branch guardrail. Read the project's durable `docs/retro-log.md` when present, following up on any pending items.

Gather and read every Primary source present for the Run under `.scratch/<feature-slug>/` (`review-status.md`, implementer `status.md`, per-ticket reports or logs, and `design-review.md`) alongside git history on the integration branch since `review_point` (from `review-status.md`) or the merge-base with `main`. Read each run-state file by meaning across implementer formats, and edit none of them.

Extract each Miss with its concrete location (file plus id, line, or commit SHA) and a verbatim quote. For details on what constitutes a Miss across each source, consult [references/miss-sources.md](references/miss-sources.md).

Record all expected sources that are missing, and list them for the report's opening section. When a Run has no `.scratch/<feature-slug>/` directory at all, ask the user for explicit confirmation before reading the current session's transcript. When `--transcript` is passed, list matching sessions and extract quotes through a read-only subagent.

Detailed guidance:
- Primary sources and extraction rules: [references/miss-sources.md](references/miss-sources.md)
- Transcript discovery and selection: [references/transcript-mode.md](references/transcript-mode.md)
- Resuming or starting fresh: [references/resume.md](references/resume.md)

Completion criterion: every present source read, and every Miss has a location and quote.

### Stage 1 — Classify and report

Group related misses by root cause and reconcile them against prior entries in `docs/retro-log.md`. Classify each miss deterministically into one of six Remedy kinds: Check, Standard, Pointer, Skill fix, Prune, or Access. Escalate recurring misses from previously applied remedies into stronger kinds. Route Skill fixes between local repositories and upstream feedback based on package lock files. Write the complete proposal to `.scratch/<feature-slug>/retro.md` with verbatim quotes and concrete changes or prompts.

Pause execution immediately after writing the report to await human choices (`apply`, `hand off`, `decline`, or `defer`) for each proposed Remedy.

Detailed guidance:
- Classification rules and remedy kinds: [references/classification.md](references/classification.md)
- Report format and section structure: [references/retro-report.md](references/retro-report.md)
- Skill fix ownership and routing: [references/skill-fix-routing.md](references/skill-fix-routing.md)

### Stage 2 — Apply and hand off

Upon receiving human approval, apply each approved Text remedy directly to the environment. Create a separate `chore(retro): <remedy>` commit on the current branch for each applied change alongside its updated log entry. Record all remaining outcomes in `docs/retro-log.md` with a concluding `chore(retro): log <feature-slug>` commit. Execute the project's test and validation commands once to verify environment integrity. Conclude by displaying ready-to-run prompts for all Code remedies, followed by `/pr-to-dev`.

Detailed guidance:
- Commit sequencing, verification, and handoff: [references/apply-and-handoff.md](references/apply-and-handoff.md)
- Log schema and outcome tracking: [references/retro-log.md](references/retro-log.md)
