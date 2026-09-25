<!--
docs/retro-log.md
Durable log of Environment Remedies proposed across Retros.

Entry format:
### <id> · <kind> · <outcome>
Remedy: <summary>
Misses:
- <slug> · <source#location> · <date> · "<quote>"
History:
- <date> <outcome>: <detail>

Outcome states:
- applied: the change is in place, made by a Retro or confirmed done after a hand-off.
- handed-off: a Code remedy's prompt was given and the change is not confirmed yet.
- declined: the user rejected the proposed Remedy.
- deferred: the user postponed decision on the proposed Remedy.

Id rule:
- R-<feature-slug>-<NN>, numbered within the Run that first proposed the Remedy, and never change.

Only a Retro reads this file to recognize recurrence and avoid re-proposing declined Remedies.
No Pointer to the Retro Log is added to AGENTS.md / CLAUDE.md; it costs context only while a Retro runs.
-->

### R-grill-to-tickets-production-03 · Standard · applied
Remedy: reference canonical glossary and contract files in docs and guides to avoid drift
Misses:
- grill-to-tickets-production · review-status.md#std-3 · 2026-09-25 · "subagent guide said usage_total excludes cache reads — c922b31"
- grill-to-tickets-production · review-status.md#spec-2 · 2026-09-25 · "guides put the DAG summary before /clear — c922b31"
- grill-to-tickets-production · review-status.md#spec-4 · 2026-09-25 · "implementer guides said the worker builds its read list — c922b31"
- grill-to-tickets-production · review-status.md#std-21 · 2026-09-25 · "usage_total cache semantics are restated across the glossary, three guides, three skill pages (two languages), three status-and-resume.md, the evals, and regex-pinned Thai wording; several fix commits existed only to re-align those copies — every future rewording is an N-place edit"
History:
- 2026-09-25 applied: added Single Source of Truth rule to CODING_STANDARDS.md


### R-grill-to-tickets-production-04 · Standard · applied
Remedy: write to sibling temporary files and rename atomically when modifying files in-place
Misses:
- grill-to-tickets-production · review-status.md#scr-1 · 2026-09-25 · "--write-budget writes ticket files in place (writeFile); tickets are git-ignored, so an interrupted write is unrecoverable — prefer temp file + rename"
- grill-to-tickets-production · review-status.md#scr-3 · 2026-09-25 · "replaceFile (cluster 4) renames over the ticket: a read-only (0444) ticket the old writeFile refused is now replaced, and a symlinked ticket is replaced by a regular file instead of being written through"
History:
- 2026-09-25 applied: added Atomic File Rewrites rule to CODING_STANDARDS.md


### R-grill-to-tickets-production-05 · Standard · applied
Remedy: assert against sliced sections or AST structures instead of whole files or hardcoded line numbers
Misses:
- grill-to-tickets-production · review-status.md#std-4 · 2026-09-25 · "new contract tests assert wording on whole files (catalog Rule 5)... vacuous regex assertions"
- grill-to-tickets-production · review-status.md#std-9 · 2026-09-25 · "tests/repo-contract.test.mjs hard-codes lineNumber === 27"
- grill-to-tickets-production · review-status.md#std-22 · 2026-09-25 · "some contract tests still assert against whole files (/seam/i, /quiz/i, /explore/i, /unique/i on spec-format.md/ticket-format.md; /spec-format\.md/ on the SKILL.md intro) — catalog Rule 5, soft"
History:
- 2026-09-25 applied: added Scoped Assertions rule to CODING_STANDARDS.md
