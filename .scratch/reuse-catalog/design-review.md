# Design Review — reuse-catalog spec.md

One stable report, updated per cycle. Gate budget: six cycles. `SHIP` is the
only passing verdict.

Intent, restated cold: make agents build on a project's existing code by
persisting what exists in a per-project Reuse Catalog and threading reuse
decisions through plan → implement → review, without the catalog ever claiming
code that is not there.

## Cycle 1

- **cycle:** 1
- **reviewedSpecRef:** git blob `d61cd46b5f16a5f34a0caf8f3f0e077f6801b688`
  (first draft)
- **verdict:** `FIX_THEN_SHIP`
- **reworkKind:** n/a (not `REWORK`)
- **reworkReasoning:** n/a
- **blockingFindings:**
  - `reuse-plan-section-not-passed` — every implementer's scaffold passes the
    worker only *named* spec sections. Nothing makes the orchestrator name the
    Reuse Plan, so the owner ticket's worker sees `create-shared useReportFilters`
    but not the interface the spec settled for all consumers. It builds an
    interface tailored to itself; the next consumer's worker, finding it does not
    fit, writes its own variant — the exact duplication the feature exists to
    stop (story 9).
- **newFindings:** `reuse-plan-section-not-passed` (blocker),
  `worker-may-write-catalog` (minor — the scaffold line says "search it" but
  does not make the catalog read-only for workers; a worker edit in a parallel
  wave would collide with the orchestrator's integration write, breaking ADR
  0002's no-conflict premise), `plan-table-display-unneeded` (simplification —
  parsing the Reuse line for the implementers' Plan table adds surface to three
  `planning.md` files and their tests for display only; the ticket files are
  already shown at the Plan pause), `entry-symbol-format` (nit — `<DataTable>` in
  an entry cannot be grepped as-is by the drift check or the integration step)
- **resolvedFindings:** none (cycle 1)
- **repeatedFindings:** none (cycle 1)
- **route:** `FIX_THEN_SHIP` — smallest correct edits made directly to
  `spec.md`; control stays in Stage 2; re-review.
- **validationCommands:**
  - `grep -n "read only these sections" skills/agents/{subagent,agy,opencode}-implement/references/prompt-scaffold.md`
    — confirms workers receive only named spec sections.
  - `grep -n "Files changed" skills/agents/{subagent,agy,opencode}-implement/references/prompt-scaffold.md`
    — confirms every worker Return lists changed files, so the integration-step
    grep (ADR 0002) has its input without reading code.
  - `grep -n "ticks that ticket file" skills/agents/{subagent,agy,opencode}-implement/references/*.md`
    — confirms, in all three, the squash commit already carries orchestrator
    bookkeeping edits.
  - `grep -n "uncommitted changes\|dirty tree" skills/agents/*-implement/references/*.md`
    — confirms all three preflights stop on a dirty tree, hence the handoff's
    commit reminder.
  - `git log --since=2026-09-10 --first-parent --diff-merges=first-parent --name-only --format= -- docs`
    — confirms the Coverage re-survey command runs on the repo's git (2.50.1).

### Corrections applied

| finding | edit |
| --- | --- |
| `reuse-plan-section-not-passed` | Implementers: when the Reuse line has any verb other than `use`, the orchestrator adds the Reuse Plan to the worker's named spec sections. |
| `worker-may-write-catalog` | Scaffold catalog line reads "read-only for you"; integration step states the orchestrator is the catalog's only writer during a run. |
| `plan-table-display-unneeded` | Dropped. Implementer planning is unchanged; the Reuse line is read only at prompt-writing and integration. |
| `entry-symbol-format` | Catalog section: an entry's symbol is the bare identifier as it appears in code. |

### Simpler alternatives considered (mandatory pass)

- **No catalog — survey fresh every run, Reuse Plan + Reuse field only.** Fails
  the stated goal (agents re-read the codebase every run) and makes Candidates
  undiscoverable: they live in feature directories, which a shared-directory
  survey never reads. Rejected.
- **No implementer changes — let the next survey pick up new modules
  (self-heal only).** Viable and smaller, but the survey cannot recover the
  *intent* the plan held — which modules are candidates, their use-when — only
  the code. The owner chose integration-time updates. Kept as the fallback path
  for non-catalog-aware implementers (ADR 0001).
- **Worker returns a catalog-entry block.** More accurate descriptions, but
  changes three Return contracts and their verification. Replaced by deriving
  entries from text the orchestrator already holds (ADR 0002).
- **Commit SHA for Coverage.** Breaks under squash-merged PRs. Replaced by a
  date (ADR 0003).
- **Reuse as acceptance criteria.** Breaks the one-test-per-criterion gate in
  all three implementers (ADR 0005).

## Cycle 2

- **cycle:** 2
- **reviewedSpecRef:** git blob `b47f6d718b8bef7c0f78118dea427ae390a35969`
  (post-review Markdown-only fix — escaped backticks in one code span → blob
  `945734c7423e3cdbe8a3e6f9ecefdb3f8dc09808`, no content change)
- **verdict:** `SHIP`
- **reworkKind:** n/a
- **reworkReasoning:** n/a
- **blockingFindings:** none
- **newFindings:** none
- **resolvedFindings:** `reuse-plan-section-not-passed`,
  `worker-may-write-catalog`, `plan-table-display-unneeded`,
  `entry-symbol-format`
- **repeatedFindings:** none
- **route:** `SHIP` — advance to Stage 3 (tickets).
- **Traced this cycle:** owner ticket → worker prompt now carries the Reuse line
  and the Reuse Plan section → worker builds the settled interface → integration
  grep finds the symbol in the reported files → entry written in the squash
  commit → consumer ticket (blocked by owner, later wave) gets `use` + the
  catalog line; parallel wave-mates only read the catalog, so the serial
  integration writes cannot conflict; a project with no catalog skips every
  catalog step; upstream `/implement` leaves the catalog stale until the next
  survey's changed-files pass re-reads the area.
