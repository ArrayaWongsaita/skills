# ADR 0009: Restore grill-with-docs to its upstream version

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-09-23
- Amends / แก้ไขบริบทของ: ADR 0003

## Context / บริบท

Commit `7fda919` rewrote the installed `.agents/skills/grill-with-docs/SKILL.md`
into a six-phase full-lifecycle orchestrator (218 lines). Upstream
`mattpocock/skills` keeps it as a seven-line skill that calls `grilling` and
`domain-modeling`. Since then the lifecycle has been rebuilt as standalone
skills: `grill-to-tickets` (ADR 0003), `agy-implement`, `subagent-implement`,
`opencode-implement` (ADRs 0004, 0005, 0007), and `review-to-pr` (ADR 0006).

Keeping the fork cost four things:

- `npx skills update` tracks the upstream source in `skills-lock.json` and can
  overwrite the fork without warning.
- `engineering-workflow` routes `DISCOVERY` to the upstream contract (grilling
  plus domain modeling), but the fork ran the whole lifecycle from that stage.
- The Design Review Gate rules existed twice, with different verdict words
  (ADR 0003 trade-off).
- The same slash command meant something different here than in every other
  install of `mattpocock/skills`.

`grill-with-docs` ที่แก้ไว้ซ้ำกับ `grill-to-tickets` และ skill ชุด implement/review แล้ว
และเสี่ยงถูกเขียนทับตอน `npx skills update`

## Decision / การตัดสินใจ

1. `.agents/skills/grill-with-docs/` is byte-identical to upstream
   `skills/engineering/grill-with-docs/`.
2. The fork's contract test (`tests/orchestrator-contract.test.mjs`) and its
   lifecycle assertions in `tests/pipeline-verification.test.mjs` are removed;
   the pipeline test now checks only that the skills upstream `grill-with-docs`
   calls are installed.
3. The full lifecycle lives in the standalone chain
   `grill-to-tickets` → `subagent-implement` (or `agy-implement` /
   `opencode-implement`) → `review-to-pr` → `pr-to-dev`, or in one run through
   `engineering-workflow`.

## Consequences / ผลที่ตามมา

### Positive / ข้อดี

- `npx skills update` is safe for `grill-with-docs` again: the installed files
  match upstream byte for byte, which removes the local drift behind ADR 0003's
  deferred lock follow-up.
- The Design Review Gate has one source of truth:
  `grill-to-tickets/references/design-review-gate.md`.
- `engineering-workflow`'s `DISCOVERY` stage gets the contract it was written
  against.

### Trade-offs / ข้อแลกเปลี่ยน

- `/grill-with-docs` no longer carries a feature through to code. Going from
  idea to implementation now takes three commands with a `/clear` between them,
  or `engineering-workflow`.
