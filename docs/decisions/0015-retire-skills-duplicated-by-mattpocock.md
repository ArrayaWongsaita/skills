# ADR 0015: Retire the skills duplicated by mattpocock/skills

- Status / สถานะ: Superseded by ADR 0016 / ถูกแทนที่โดย ADR 0016 (was: Accepted / ยอมรับแล้ว)
- Date / วันที่: 2026-09-28
- Supersedes / แทนที่: ADR 0002, 0003, 0004, 0005, 0006, 0007, 0008, 0010, 0012, 0013, 0014

## Context / บริบท

The planning-to-PR workflow ran on skills this repository owned:
`grill-to-tickets` → `subagent-implement` (or `agy-implement` /
`opencode-implement`) → `review-to-pr` → `retro-to-remedies`, or in one run
through `engineering-workflow`. Most of each stage restated a
`mattpocock/skills` skill that is already installed: `grill-with-docs`,
`to-spec`, `to-tickets`, `implement`, and `code-review`.

Keeping owned copies cost tokens and maintenance in three ways. The owned
formats (Reuse, Seam, Context, Budget lines) and their checker had to be read
and re-read by every stage. The fresh-context design review and the per-ticket
verifier ran extra model passes on every run. And the skills were bound to
each other by shared formats and by contract and eval tests that pinned their
wording, so one change became an edit in many places.

workflow เดิมใช้ skill ของ repo นี้ทุกขั้น ซึ่งส่วนใหญ่ซ้ำกับ skill ของ
`mattpocock/skills` ที่ติดตั้งอยู่แล้ว การดูแลสำเนาของตัวเองกิน token ทั้งจาก
format ที่ต้องอ่านซ้ำทุกขั้น, pass ของ reviewer และ verifier ที่เพิ่มขึ้นทุกรัน
และจาก test ที่ตรึงถ้อยคำไว้จนการแก้ครั้งเดียวต้องแก้หลายที่

## Decision / การตัดสินใจ

1. Remove `grill-to-tickets`, `subagent-implement`, `engineering-workflow`,
   `agy-implement`, `opencode-implement`, `review-to-pr`, and
   `retro-to-remedies`, with their guides, skill pages, and test suites, and
   the Reuse Catalog.
2. Use the upstream skills instead:
   `/grill-with-docs` → `/to-spec` → `/to-tickets` in one context, `/clear`,
   `/implement` one ticket at a time with `/clear` between tickets, then one
   `/code-review` over the branch. Run `/scrutinize` by hand when the work is
   risky.
3. Keep `agy-agent` and `pr-to-dev`: neither duplicates an upstream skill.
4. Keep the superseded ADRs unchanged apart from their status line, as the
   record of why the skills existed.

ลบ skill ทั้งเจ็ดตัวพร้อมคู่มือ, หน้า skill, test และ Reuse Catalog แล้วใช้
skill ของ Matt แทน เก็บ `agy-agent` กับ `pr-to-dev` ไว้เพราะไม่ซ้ำกับ upstream
ADR ที่ถูกแทนที่ยังเก็บไว้เป็นประวัติ แก้เฉพาะบรรทัดสถานะ

## Consequences / ผลที่ตามมา

- Multi-ticket runs are no longer automated: each ticket is one `/implement`
  run in a fresh context. Upstream's `implement-spec` (still in progress) is the
  candidate for parallel implementation once it is released.
- Delegating implementation to another provider (`agy`, `opencode`) now goes
  through `agy-agent` per task, not a ticket-set orchestrator.
- There is no deterministic ticket checker, no Reuse field, and no Budget
  measurement; `to-tickets` owns the ticket format.
- The repository's tests cover only the remaining skills and the repository
  contract.

**Reverted by ADR 0016**: after trying upstream's `implement-spec` in
practice, the owned multi-ticket implementers were preferred over it. See
[ADR 0016](0016-restore-skills-retired-by-adr-0015.md).

**ถูก revert โดย ADR 0016**: หลังจากลองใช้ `implement-spec` ของ upstream จริง
พบว่า implementer แบบหลาย ticket ของ repo เองยังดีกว่า ดู
[ADR 0016](0016-restore-skills-retired-by-adr-0015.md)

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- **Rewrite `grill-to-tickets` as a thin wrapper over the upstream skills.** It
  would still own a ticket format, a checker, and tests, which are the costs
  this decision removes.
- **Add a separate `planning-verifier` / `planning-resolver` skill pair.** It
  adds a stage and a format contract; `/scrutinize` run on demand covers the
  same review without either.
