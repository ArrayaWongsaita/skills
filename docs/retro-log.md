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


### R-grill-to-tickets-production-01 · Check · handed-off
Remedy: fail when identical prose spans across implementer skills are unregistered in SHARED_BLOCKS
Misses:
- grill-to-tickets-production · review-status.md#std-2 · 2026-09-25 · "catalog Rule 7: identical planning.md blocks unregistered in SHARED_BLOCKS — 094136b"
- grill-to-tickets-production · review-status.md#std-18 · 2026-09-25 · "(blocker, catalog Rule 7) — two blocks the tickets added are word for word identical across the three implementers but unregistered in SHARED_BLOCKS: ticket 08's Context files template lines (prompt-scaffold.md) and ticket 09's budget_estimate sentence (status-and-resume.md)"
- grill-to-tickets-production · review-status.md#std-24 · 2026-09-25 · "blocker, catalog Rule 7 — fixed in b593fa8... Three prose blocks the tickets rewrote are word for word identical in all three implementers and unregistered in SHARED_BLOCKS: the "Select a test seam per ticket" step in each SKILL.md (ticket 07), the "Numbering consistent with a topological order" bullet in each planning.md (ticket 07), the Parent spec: line in each prompt-scaffold.md (ticket 08)."
History:
- 2026-09-25 handed-off: /grill-to-tickets prompt in .scratch/grill-to-tickets-production/retro.md

### R-grill-to-tickets-production-02 · Check · handed-off
Remedy: validate Context and ticket snippets in eval test cases using check-tickets.mjs
Misses:
- grill-to-tickets-production · review-status.md#spec-13 · 2026-09-25 · "(blocker) — the three "Context drives the worker's read list" evals (subagent id 40, agy id 30, opencode id 49) were self-contradicting: a ticket 01 Context with (edit from 00) (no ticket 00 can exist; the checker rejects it) and an expected output naming a (from 00) read path the prompt never carried."
- grill-to-tickets-production · review-status.md#std-28 · 2026-09-25 · "92b309c test "on a lower-numbered blocker" asserts only blocker < carrier; it does not check the "blocked by" text or that ticket NN creates the path, and nothing runs the checker on the eval's Context line (the verifier did once, by hand)"
History:
- 2026-09-25 handed-off: /grill-to-tickets prompt in .scratch/grill-to-tickets-production/retro.md

### R-grill-to-tickets-production-06 · Skill fix · handed-off
Remedy: require a decision completeness gate in grill-to-tickets Stage 0 before Stage 1
Misses:
- grill-to-tickets-production · design-review.md#Cycle-1 · 2026-09-25 · "verdict: REWORK, reworkKind: decision-level, reworkReasoning: context-read-vs-touch-conflated, reuse-undecided-checkFeature, scope-budget-enforcement-before-data, stage-skill-hash-check-low-value, and retro-usage-scalar-undefined each need a choice nobody made — a fresh writer holding decisions.md would have to ask before fixing the spec."
- grill-to-tickets-production · design-review.md#Budget-exhaustion-report · 2026-09-25 · "Cycles: 1 REWORK (decision-level → round 5), 2–6 FIX_THEN_SHIP... route: budget exhausted — cycle 6 closed without SHIP; the gate stops."
History:
- 2026-09-25 handed-off: /grill-to-tickets prompt in .scratch/grill-to-tickets-production/retro.md

### R-grill-to-tickets-production-07 · Skill fix · handed-off
Remedy: automated grep sweep in grill-to-tickets Stage 1 ensuring all changed tests are enumerated
Misses:
- grill-to-tickets-production · design-review.md#Cycle-2 · 2026-09-25 · "blockingFindings: unlisted-test-and-wording-churn (major, repeated, narrowed)"
- grill-to-tickets-production · design-review.md#Cycle-3 · 2026-09-25 · "blockingFindings: unlisted-test-and-wording-churn (major, repeated, narrowed again)"
- grill-to-tickets-production · design-review.md#Cycle-4 · 2026-09-25 · "blockingFindings: unlisted-test-and-wording-churn (smaller set again; this cycle adds a grep completion check so it cannot recur by omission)"
History:
- 2026-09-25 handed-off: /grill-to-tickets prompt in .scratch/grill-to-tickets-production/retro.md

### R-grill-to-tickets-production-08 · Skill fix · handed-off
Remedy: inspect and recover uncommitted work in subagent-implement worker branches upon session drop
Misses:
- grill-to-tickets-production · status.md#04-checker-measures-budget · 2026-09-25 · "attempts: 2 (attempt 1: worker 7aa7cdfc-1983-40a6-b1fc-56940681823e lost with the prior orchestrator session; its uncommitted partial work was discarded before the re-dispatch)"
- grill-to-tickets-production · reports/04.md#3 · 2026-09-25 · "Worker: ses_f2bbc9859ffehgb9Aq2tW4l3gJ (attempt 2; first task call returned empty, resumed in place and completed)"
- grill-to-tickets-production · status.md#03-checker-validates-seam-and-context · 2026-09-25 · "attempts: 2"
History:
- 2026-09-25 handed-off: /grill-to-tickets prompt in .scratch/grill-to-tickets-production/retro.md
