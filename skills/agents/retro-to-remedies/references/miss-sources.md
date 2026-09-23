# Miss Sources

Primary sources capture what occurred in a completed Run: run-state artifacts stored under `.scratch/<feature-slug>/` (such as `review-status.md`, implementer `status.md`, per-ticket reports or logs, and `design-review.md`), git commits since `review_point` or the branch's merge-base with `main`, and optional session transcripts.

## Read-Only Invariant

Run-state files are read, never edited. The Retro extracts evidence and writes its analysis exclusively to `.scratch/<feature-slug>/retro.md` and subsequent commits to the environment, preserving all primary source files untouched.

Every Miss extracted carries its concrete location (file plus id, line, or commit SHA) and a verbatim quote from the source, establishing verifiable evidence.

## What Counts as a Miss per Source

The Retro reads each run-state file by meaning across different implementer layouts, extracting the following signals:

### 1. `review-status.md`
- **Blocking findings**: Every finding marked as a blocker or resolved blocker (such as `std-1`).
- **Carried findings**: Every finding with status `open` and non-blocking (such as `std-2` through `std-5`).
- **Unfixable or stalled findings**: Every finding marked `unfixable` or `stalled`.
- **Budget exhaustion**: Any code-review cycle or scrutinize budget spent past one cycle (for example, multiple code cycles or scrutinize cycles).

### 2. Implementer `status.md`
- **Retried tickets**: Any ticket requiring more than one attempt to implement.
- **BLOCKED tickets**: Any ticket marked `BLOCKED`.
- **Lessons in notes**: Every lesson, harness note, gotcha, or incident recorded in the run state or notes section (for example, fixed worktree base assumptions, ref-naming collisions, or un-isolated dispatches).

### 3. Implementer Reports or Logs (`reports/<NN>.md`, `logs/<NN>.json`, `logs/<NN>.jsonl`)
- **Verification failures**: Every failed verification attempt, rejected verifier check, or red test cycle within a worker run.
- **Failure reasons**: The underlying reason or error message associated with each verification failure.

### 4. `design-review.md`
- **Cycles without SHIP**: Every design review cycle that ended without a `SHIP` verdict (for example, `FIX_THEN_SHIP` or `REWORK`).
- **REWORK kinds**: The specific rework kind and actionable findings associated with non-SHIP verdicts.

### 5. Git History
- **Review fixes and reverts**: Every `fix(review):` commit and revert commit on the branch since `review_point` (from `review-status.md`), or since the merge-base with `main` when `review_point` is absent.

### 6. Session Transcripts (Transcript Mode)
- Read only when explicitly requested via `--transcript` or when no `.scratch/<feature-slug>/` exists (see below). Captures repeated tool failures, slow searches for files, missing information, and expensive tool use. Every transcript Miss carries its session id and a verbatim quote.

## Missing Expected Sources

The Retro inspects which standard sources are present. Any expected sources that are missing (such as an absent `status.md` when reviewing an upstream `/implement` run, or missing `design-review.md`) are recorded and listed in the opening section of the Retro report (`.scratch/<feature-slug>/retro.md`). The Retro proceeds with whatever partial records exist.

When a Run has no `.scratch/<feature-slug>/` directory at all, the Retro pauses and asks the user for explicit confirmation before reading the current session's transcript.
