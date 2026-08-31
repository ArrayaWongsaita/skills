# ADR 0003: grill-to-tickets is a standalone composite, not a refactor of grill-with-docs

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-08-31

## Context / บริบท

`grill-with-docs` (sourced from `mattpocock/skills`) already runs discovery →
domain modeling → spec → design gate → tickets as Phases 1–3 of its six-phase
full lifecycle. A new skill that stops at tickets could be built by having
`grill-with-docs` delegate its first three phases to it, removing the duplicated
Design Review Gate logic — but that requires editing an upstream-tracked
`SKILL.md`. `skills-lock.json` also already misrepresents `grill-with-docs`
(hash drift from a prior local rewrite), and the owner does not want any further
change to Matt Pocock-sourced skills.

`grill-with-docs` ทำ Phase 1–3 ที่ทับซ้อนอยู่แล้ว แต่การรวมโค้ดต้องแก้ไฟล์ upstream

## Decision / การตัดสินใจ

1. Build `grill-to-tickets` as a fully standalone skill under
   `skills/agents/grill-to-tickets/`, mirrored to
   `.agents/skills/grill-to-tickets/`, that inline-executes `grilling`,
   `domain-modeling`, `to-spec`, `scrutinize`, and `to-tickets` and owns its own
   copy of the Design Review Gate rules (verdict routing, six-cycle budget,
   stall detection, spec-level vs decision-level rework).
2. Do not modify `grill-with-docs/SKILL.md`, any other `mattpocock/skills`-sourced
   file, or the `grill-with-docs` entry in `skills-lock.json`.
3. The skill stops at published tickets and never invokes `implement`.

## Consequences / ผลที่ตามมา

### Positive / ข้อดี

- Zero risk to the working `grill-with-docs` orchestrator or its lock provenance.
- `grill-to-tickets` can evolve its gate independently for the interview-to-tickets
  use case.

### Trade-offs / ข้อแลกเปลี่ยน

- The Design Review Gate rules now exist twice in the repo (`grill-with-docs`
  Phase 2 prose and `grill-to-tickets/references/design-review-gate.md`) and can
  drift apart. `grill-to-tickets` uses `scrutinize`'s uppercase verdict tokens
  (`SHIP` / `FIX_THEN_SHIP` / `REWORK` / `REJECT`), while `grill-with-docs` uses
  its own `Pass` / `Minor Correction` / `Rework` / `Reject` wording.

### Follow-up (deferred) / งานที่เลื่อนออกไป

- Correcting the `grill-with-docs` provenance in `skills-lock.json` is a separate,
  explicitly deferred task.

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- Refactor `grill-with-docs` to delegate Phases 1–3 to `grill-to-tickets`:
  rejected because it edits an upstream-tracked skill.
- A thin wrapper that calls `grill-with-docs` and aborts after Phase 3: rejected
  because `disable-model-invocation: true` blocks programmatic invocation and the
  abort point is not a supported contract.
