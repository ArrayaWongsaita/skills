# ADR 0016: Restore the skills retired by ADR 0015

- Status / สถานะ: Superseded by ADR 0027 / ถูกแทนที่โดย ADR 0027 (was: Accepted / ยอมรับแล้ว)
- Date / วันที่: 2026-09-29
- Supersedes / แทนที่: ADR 0015

## Context / บริบท

[ADR 0015](0015-retire-skills-duplicated-by-mattpocock.md) removed
`grill-to-tickets`, `subagent-implement`, `engineering-workflow`,
`agy-implement`, `opencode-implement`, `review-to-pr`, and
`retro-to-remedies` in favor of the upstream `mattpocock/skills` workflow,
naming upstream's in-progress `implement-spec` as the candidate for
automated multi-ticket runs once released.

`implement-spec` has since been tried in practice. The owned multi-ticket
implementers were preferred over it.

[ADR 0015](0015-retire-skills-duplicated-by-mattpocock.md) ลบ
`grill-to-tickets`, `subagent-implement`, `engineering-workflow`,
`agy-implement`, `opencode-implement`, `review-to-pr` และ
`retro-to-remedies` เพื่อไปใช้ workflow ของ `mattpocock/skills` แทน โดยระบุว่า
`implement-spec` ของ upstream (ยังไม่เสร็จตอนนั้น) เป็นตัวเลือกสำหรับรันหลาย
ticket พร้อมกันเมื่อออกแล้ว

ตอนนี้ได้ลองใช้ `implement-spec` จริงแล้ว และยังชอบ implementer ของ repo เอง
มากกว่า

## Decision / การตัดสินใจ

1. Restore the seven skills, their guides, skill pages, test suites, and the
   Reuse Catalog exactly as they stood before ADR 0015 (revert of commits
   `b469fc8`, `817b054`, `5850172`).
2. Mark ADR 0015 as superseded rather than deleting it, keeping it as the
   record of why the retirement was tried.
3. Keep `implement-spec` (and the rest of upstream's flow) available as an
   option; it is not removed, just no longer the default for multi-ticket
   runs.

กู้ skill ทั้งเจ็ดตัวพร้อมคู่มือ, หน้า skill, test และ Reuse Catalog กลับมา
เหมือนก่อน ADR 0015 (revert commit `b469fc8`, `817b054`, `5850172`) เก็บ ADR
0015 ไว้เป็นประวัติแทนการลบ และยังเก็บ `implement-spec` ไว้เป็นตัวเลือกได้ เพียง
แต่ไม่ใช่ default สำหรับรันหลาย ticket อีกต่อไป

## Consequences / ผลที่ตามมา

- Multi-ticket runs are automated again through `subagent-implement` (or
  `agy-implement` / `opencode-implement`), as before ADR 0015.
- The owned ticket format (Reuse, Seam, Context, Budget lines), its checker,
  and the contract/eval tests that pin their wording are back in the
  maintenance surface.
- The token and maintenance cost ADR 0015 removed returns; that trade-off is
  accepted in exchange for the preferred implementer behavior.
- Local installs under `.agents/skills/` and `skills-lock.json` are
  gitignored and were pruned when ADR 0015 landed; they need reinstalling
  separately to pick these skills back up.
