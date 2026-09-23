# ADR 0008: Reuse Catalog is a cross-skill contract

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-09-23

## Context / บริบท

Code built through `grill-to-tickets` → `subagent-implement` / `agy-implement` /
`opencode-implement` duplicated existing code: planning never surveyed the code,
specs and tickets had no place to say "this already exists", workers were told
not to scan the repository, and `code-review` compares duplication only within
the diff. A fix that re-surveys the codebase on every run pays that cost every
time. Planning artifacts and the design discussion live in
`.scratch/reuse-catalog/`.

โค้ดที่ได้จาก pipeline นี้ซ้ำกับของเดิม เพราะไม่มีขั้นไหนรู้ว่าโค้ดเดิมมีอะไร และการสำรวจใหม่ทุกรอบก็เปลืองเกินไป

## Decision / การตัดสินใจ

Five standalone skills share one contract, each owning its own copy of the
wording it needs (ADR 0003's standalone rule still holds; no upstream-sourced
file changes):

1. **Catalog path:** the target project's `docs/reuse-catalog.md`, pointed to by
   one line in its `AGENTS.md` (else `CLAUDE.md`). The file's header comment is
   self-describing — entry format, writers, Coverage — so writers follow the
   file rather than a copy of its rules.
2. **Invariant:** every line of the catalog describes code that exists now.
   Planned modules live in the feature spec until the ticket that creates them is
   integrated.
3. **Reuse Plan:** `grill-to-tickets` writes `### Reuse Plan` under the spec's
   Implementation Decisions.
4. **Reuse field:** every ticket carries `**Reuse:**` after `Blocked by`, with
   the fixed verbs `use`, `extend`, `create-shared`, `create-candidate`,
   `promote` (or `none`). It is never an acceptance criterion, because every
   criterion must map to a new test in the implementers' verification gates.
5. **Writers and readers:**
   - `grill-to-tickets` Stage 0 Reuse survey — bootstraps, drift-repairs, adds
     entries for existing code it finds, moves Coverage dates;
   - `subagent-implement`, `agy-implement`, `opencode-implement` — pass the
     Reuse field and a read-only catalog pointer to workers; the orchestrator
     writes entries for `create-shared` / `create-candidate` / `extend` /
     `promote` in the ticket's own squash commit;
   - `review-to-pr` — reads the catalog as a documented standards source.

## Consequences / ผลที่ตามมา

### Positive / ข้อดี

- Reuse is decided once, at planning, where every ticket is visible and the user
  can settle trade-offs; implementation follows the plan.
- Each run reads only what changed since the last survey.
- A run through a catalog-unaware implementer self-heals at the next survey.

### Trade-offs / ข้อแลกเปลี่ยน

- The contract's wording lives in five skills and can drift; the contract tests
  of each skill assert its part, and `tests/implementer-reuse-drift.test.mjs`
  fails when the blocks the three implementers share stop matching word for word.
- `grill-to-tickets` now writes one project file outside `.scratch/`.

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- A generated index: stack-specific, and blind to rules and candidates.
- The catalog inline in `AGENTS.md`: paid for on every turn of every task.
- Reuse statements as acceptance criteria: fail the one-test-per-criterion gate.
