# ADR 0006: review-to-pr is engineering-workflow's feature-flow §8–9 split out standalone

- Date / วันที่: 2026-09-04

## Status / สถานะ

Accepted / ยอมรับแล้ว

ยอมรับแล้ว — `review-to-pr` เป็น skill มาตรฐานแบบ standalone ไม่ผูกกับ
`engineering-workflow`

## Context / บริบท

`engineering-workflow`'s `feature-flow.md` already describes phase 8 (two-axis
`code-review` from a fixed point, blockers routed to a review-fix loop, stop
after the third code cycle) and phase 9 (a conditional final `scrutinize` on its
own six-cycle budget, with the `scrutinize → implementation fix → tests or
typecheck → code-review → scrutinize` sub-loop). A skill that drives an
unreviewed integration branch — the branch `implement`, `agy-implement`, and
`subagent-implement` all hand off — to a PR-ready state is exactly those two
phases. It could be built as an `engineering-workflow` delegate, reusing its
state machine and gate accounting, which would couple the two skills and add a
`review-to-pr` entry to the dependency registry.

`implement`, `agy-implement`, และ `subagent-implement` ต่างหยุดที่จุดเดียวกัน:
integration branch ที่ verify แล้วแต่ยังไม่มีใคร review ทุกตัว hand off ด้วยบรรทัด
`/code-review since <merge-base with main>` แล้ว `/scrutinize` เหมือนกัน งานที่เหลือ
คือ loop เดิมที่รันซ้ำแบบเดียวกันทุกครั้ง

The owner wants the standalone splits decoupled and may remove
`engineering-workflow` entirely later. This mirrors the standalone stance ADR
0003 took for the `grill-to-tickets` §1–3 split; the `subagent-implement` = §7
split lands on its own branch with its own repo ADR, so `review-to-pr` refers to
it by skill name only and builds from `main` regardless of merge order.

## Decision / การตัดสินใจ

1. Build `review-to-pr` as a fully standalone skill under
   `skills/agents/review-to-pr/`, mirrored byte-identical to
   `.agents/skills/review-to-pr/`, with the symlink
   `.claude/skills/review-to-pr → ../../.agents/skills/review-to-pr`. It is
   invoked directly as the step that runs after `implement`, `agy-implement`, or
   `subagent-implement` stop.
2. It owns its own copy of the review-point, review-loop, fix-dispatch,
   scrutiny-gate, and state/resume machinery
   (`references/review-point.md`, `references/review-loop.md`,
   `references/fix-dispatch.md`, `references/scrutiny-gate.md`,
   `references/status-and-resume.md`), so it can diverge from the implement
   siblings freely.
3. It does not modify or depend on `engineering-workflow`, `grill-to-tickets`,
   `agy-implement`, `subagent-implement`, any `mattpocock/skills`-sourced file,
   or `skills-lock.json`. Its references to the implement siblings are
   skill-name mentions, not file links, so it builds and validates from `main`
   regardless of merge order.
4. It stops before the PR — the handoff prints the `/pr-to-dev` command and the
   run performs no PR step: no `git push`, no `gh`, no `/pr-to-dev`.

การตัดสินใจ: สร้าง `review-to-pr` เป็น skill standalone เต็มตัว เป็นเจ้าของ machinery
ของตัวเอง ไม่แก้และไม่พึ่ง skill อื่น และหยุดก่อนเปิด PR

## Consequences / ผลที่ตามมา

### Positive / ข้อดี

- Zero coupling to `engineering-workflow`, which the owner may remove. A
  `grill-to-tickets → subagent-implement → review-to-pr` short path needs no
  orchestrator and no dependency-registry entry.
- `review-to-pr` can evolve its review-loop, fix-dispatch, and scrutiny-gate
  logic independently.
- A drop-in next step after any of the three implement siblings, with no change
  to any upstream skill.

### Trade-offs / ข้อแลกเปลี่ยน

- The code-review three-cycle budget, the scrutinize six-cycle budget, the stall
  rule, and the `status.md` + Reality reconciliation discipline now exist in a
  fourth place in the repo and can drift. A shared-`references/` refactor across
  the implement/review siblings is a deferred follow-up, the same posture the
  earlier standalone-split ADRs take.
- The "cross-cutting or risky" judgment for the system gate is the orchestrator's
  call from a checklist rather than a formula; the mitigation is that the handoff
  always states whether the gate ran and why.

budget สามชุด, stall rule, และวินัย state + Reality reconciliation อยู่ในที่ที่สี่
ของ repo และ drift ได้ — shared-`references/` refactor เป็น follow-up ที่เลื่อนไว้

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- **Build `review-to-pr` as `engineering-workflow`'s §8–9 delegate.** Rejected
  because it couples the skill to one the owner may remove and adds a
  dependency-registry entry the standalone short path does not need.
- **Always run the system `scrutinize` gate.** Rejected in favour of the ADR 0003
  conditional checklist — `scrutinize` is an expensive end-to-end trace, and on a
  self-contained feature it mostly restates the code-review Spec axis.
