# ADR 0004: agy-implement is a standalone skill, not wired into engineering-workflow

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-09-02

## Context / บริบท

`engineering-workflow`'s `feature-flow.md` already describes a "Sequential Ticket
Execution Loop" that dispatches a subagent per ticket, but delegates it. A new
skill that turns a `grill-to-tickets` ticket directory into working code by
farming each ticket to a headless `agy` worker could be built as that skill's
`IMPLEMENTATION` delegate, reusing its state/resume machinery. That would couple
the two skills and add an `agy-implement` entry to `engineering-workflow`'s
dependency registry.

`agy-implement` เป็นทางเลือกแทนบรรทัด `/implement` ใน handoff ของ `grill-to-tickets`
แต่การผูกกับ `engineering-workflow` ทำให้สอง skill พึ่งพากัน

The owner wants the two skills decoupled and may remove `engineering-workflow`
entirely later. This mirrors ADR 0003's standalone stance for `grill-to-tickets`.

## Decision / การตัดสินใจ

1. Build `agy-implement` as a fully standalone skill under
   `skills/agents/agy-implement/`, mirrored to `.agents/skills/agy-implement/`,
   invoked directly as the alternative to the `/implement` line in the
   `grill-to-tickets` handoff.
2. It owns its own copy of the planning, worktree, verification, TDD, and
   state/resume machinery (`references/planning.md`,
   `references/agy-contract.md`, `references/prompt-scaffold.md`,
   `references/worktree-integration.md`, `references/status-and-resume.md`), so a
   future `qwen-implement` or `codex-implement` sibling can diverge from it
   freely.
3. It does not modify or depend on `grill-to-tickets`, `engineering-workflow`,
   any `mattpocock/skills`-sourced file, or `skills-lock.json`.
4. It stops before review — it hands off the `/code-review` and `/scrutinize`
   commands and runs neither, and it never pushes or opens a pull request.

## Consequences / ผลที่ตามมา

### Positive / ข้อดี

- Zero coupling to `engineering-workflow`, which the owner may remove.
- `agy-implement` can evolve its worker-dispatch, verification, and integration
  logic independently for the multi-provider use case.
- A drop-in replacement for one line of the `grill-to-tickets` handoff, with no
  change to any upstream skill.

### Trade-offs / ข้อแลกเปลี่ยน

- The frontier / wave-execution pattern and the `status.md` + Reality
  reconciliation discipline now exist in more than one place in the repo and can
  drift apart.
- Each future provider sibling owns a full copy of the shared machinery in v1; a
  shared-`references/` refactor is a deferred follow-up (adr/0001 in the feature
  directory).

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- **Build `agy-implement` as `engineering-workflow`'s `IMPLEMENTATION` delegate.**
  Rejected because it couples `agy-implement` to a skill the owner may remove and
  adds a dependency-registry entry and an audited-install contract that the
  standalone `grill-to-tickets` → `agy-implement` short path does not need.
- **Extract the shared machinery into a common base skill now.** Deferred until a
  second provider sibling actually exists, so the shared surface is designed
  against two real consumers rather than one.
