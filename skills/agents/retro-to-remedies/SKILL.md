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

Inspect the working tree branch guardrail. Check for an unfinished Retro report first (`.scratch/<feature-slug>/retro.md`) and follow [references/resume.md](references/resume.md) (resuming at the pause when choices remain unanswered, resuming at Stage 2 when answers exist but applied Remedies lack commit SHAs while skipping Remedies with a recorded SHA, or replacing the report when `--fresh` is specified).

Read the project's durable `docs/retro-log.md` when present. For each Remedy still `handed-off`, ask the user once: done (Outcome becomes `applied`), still pending (stays `handed-off`), or drop (Outcome becomes `declined`). Complete these follow-ups before reading Primary sources.

Gather and read every Primary source present for the Run under `.scratch/<feature-slug>/` (`review-status.md`, implementer `status.md`, per-ticket reports or logs, and `design-review.md`) alongside git history on the integration branch since `review_point` (from `review-status.md`) or the merge-base with `main`. Read each run-state file by meaning across implementer formats, and edit none of them.

Extract each Miss with its concrete location (file plus id, line, or commit SHA) and a verbatim quote. For details on what constitutes a Miss across each source, consult [references/miss-sources.md](references/miss-sources.md).

Record all expected sources that are missing, and list them for the report's opening section. Read transcripts only when explicitly requested via `--transcript`, or after the user agrees when no `.scratch/<feature-slug>/` directory exists. When `--transcript` is passed, list matching sessions with dates and sizes, let the user pick which to read, and delegate extraction to a single read-only subagent that returns Misses only with verbatim quotes.

Detailed guidance:
- Primary sources and extraction rules: [references/miss-sources.md](references/miss-sources.md)
- Transcript discovery and selection: [references/transcript-mode.md](references/transcript-mode.md)
- Resuming or starting fresh: [references/resume.md](references/resume.md)

Completion criterion: every present source read, and every Miss has a location and quote.

### Stage 1 — Classify and report

Group related misses by root cause. Match each Remedy against the Retro Log before classifying: recognise same-occurrence Misses already listed in the log, identify recurrences from another Run or after an applied Remedy's commit (escalating an `applied` Remedy to a Failed Remedy), and ensure a `declined` Remedy returns only with a recurrence after the decline, showing both occurrences.

Classify each miss deterministically into one of six Remedy kinds following the ordered rule: Skill fix, Check, Standard, Pointer, Access, or Prune. Drop any candidate without evidence. Map every Carried finding to a Remedy or proposed decline, and route feature defects to `/diagnosing-bugs` as Open bugs. Rank remedies: Failed Remedy first, then recurring, then the cost ranking (blocker, `BLOCKED`, failed verification, no `SHIP`), then others. Consult [references/classification.md](references/classification.md) for detailed classification rules, destinations, and ranking.

Write the structured Retro report to `.scratch/<feature-slug>/retro.md` containing the required sections in order, with exact text changes for Text remedies and `/grill-to-tickets` prompts for Code remedies, as detailed in [references/retro-report.md](references/retro-report.md). Route Skill fixes between local repositories and upstream feedback based on [references/skill-fix-routing.md](references/skill-fix-routing.md).

Completion criterion: every Miss is covered by a Remedy, an Open bug, or a proposed decline; every Remedy is complete with a kind, a destination, evidence, a recommended answer, and either its exact text change or its prompt.

Pause execution immediately after writing the report to await human choices (`apply`, `hand off`, `decline`, or `defer`) for each proposed Remedy.

Detailed guidance:
- Classification rules and remedy kinds: [references/classification.md](references/classification.md)
- Report format and section structure: [references/retro-report.md](references/retro-report.md)
- Skill fix ownership and routing: [references/skill-fix-routing.md](references/skill-fix-routing.md)


### Stage 2 — Apply

Upon receiving human approval, apply each approved Text remedy at its assigned destination: a Standard into `CODING_STANDARDS.md` (created with a short header when absent) or into the Reuse Catalog's Rules for a reuse convention; a Pointer into `AGENTS.md`, else `CLAUDE.md`, else a new `AGENTS.md`; a Prune removed from the project instruction file holding it. Follow [references/apply-and-handoff.md](references/apply-and-handoff.md).

Create an individual `chore(retro): <remedy>` commit on the current working branch for each applied Remedy (committing both the change and its Retro Log entry in the same commit), recording its commit SHA in the Retro report. Record every other Outcome (`handed-off`, `declined`, `deferred`) in `docs/retro-log.md` and commit it as `chore(retro): log <feature-slug>`. After all commits are made, run each of the project's `validate`, `check`, `lint`, and `test` scripts that exists, once. A red result stops before the handoff and names the failing command and the Retro commit it follows.

Detailed guidance:
- Commit sequencing, verification, and handoff: [references/apply-and-handoff.md](references/apply-and-handoff.md)
- Log schema and outcome tracking: [references/retro-log.md](references/retro-log.md)

Completion criterion: every applied Text remedy is committed in its own `chore(retro): <remedy>` commit on the current working branch with its SHA recorded in the Retro report, and existing check scripts pass.

### Handoff

Present the handoff following [references/apply-and-handoff.md](references/apply-and-handoff.md). Print each Code remedy's ready-to-run prompt (such as `/grill-to-tickets`), followed by `/pr-to-dev`. A Code remedy answered `hand off` appears only as a prompt. The run pushes nothing to any remote branch, opens no pull request, and opens a GitHub issue only on an explicit human request.

Completion criterion: every Code remedy prompt is printed in order, followed by `/pr-to-dev`, with no git push or pull request created.

