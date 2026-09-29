# ADR 0017: Drop reuse, and let the user bound the design review

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-09-29
- Supersedes / แทนที่: ADR 0008
- Amends / แก้ไข: ADR 0010 (replaces only its fixed six-cycle bound)

## Context / บริบท

[ADR 0008](0008-reuse-catalog-cross-skill-contract.md) made the Reuse Catalog a
contract shared by five skills: a Stage 0 Reuse survey, a Reuse Plan in every
spec, a `**Reuse:**` line on every ticket, a reuse lens in every design review,
and a project-level `docs/reuse-catalog.md`. Keeping the wording in step needed
a drift test, and every run paid for a survey and a catalog to maintain. For the
person running `grill-to-tickets` this was weight without a matching payoff, and
it made the skill harder to learn.

The Stage 2 gate was a fixed six-cycle loop with automatic stall detection. The
person could not decline the review, choose how many rounds to spend, or decide
what happens when the rounds run out; exhaustion needed "explicit human
authorization" they had no cheap way to give.

[ADR 0008](0008-reuse-catalog-cross-skill-contract.md) ทำให้ Reuse Catalog เป็น
contract ที่ใช้ร่วมกัน 5 skill (survey, Reuse Plan, บรรทัด `**Reuse:**`, reuse
lens และ `docs/reuse-catalog.md`) ต้องมี drift test คอยล็อกถ้อยคำ และทุก run
ต้องจ่ายค่า survey กับดูแล catalog ซึ่งหนักเกินคุณค่าที่ได้ ส่วน gate ใน Stage 2
เป็นวนตายตัว 6 รอบ ผู้ใช้เลือกไม่รีวิว เลือกจำนวนรอบ หรือเลือกว่าจะทำอย่างไร
เมื่อรอบหมดไม่ได้

## Decision / การตัดสินใจ

1. **Remove reuse from the whole pipeline.** No Reuse survey, Reuse Plan,
   `**Reuse:**` field, reuse lens, or catalog in `grill-to-tickets`, the three
   implementers, `review-to-pr`, `retro-to-remedies`, their guides, tests, and
   evals. `docs/reuse-catalog.md` is deleted from this repository. Catalogs in
   other projects are theirs and are not touched. `scrutinize`'s own "use
   something that already exists" pass is unaffected.
2. **Old tickets stay valid.** `check-tickets.mjs` and the implementers ignore a
   leftover `**Reuse:**` line without an error or a warning.
3. **The user bounds the design review.** On entering Stage 2 the skill asks
   once whether to review and at most how many rounds (proposed default 3; `0`
   skips the review; `--review N` answers it up front). The maximum and the
   rounds used live in the State of `decisions.md`, so `continue` resumes
   without asking again and without refilling the budget.
4. **One exit for exhaustion and stall.** When the last round closes without
   `SHIP`, or the same blocking finding survives two rounds with no progress,
   ask once: add rounds (the user names the number, no default) or go on to
   Stage 3. Going on is the default, and the open blocking findings are recorded
   in `design-review.md` and in the spec's Further Notes. `REJECT` still stops
   the run.
5. **ADR 0010's fresh-context reviewer stands.** Only its six-cycle bound is
   replaced.

1. **ถอด reuse ทั้ง pipeline** ไม่มี survey, Reuse Plan, `**Reuse:**`, reuse lens
   หรือ catalog ใน `grill-to-tickets`, implementer ทั้งสาม, `review-to-pr`,
   `retro-to-remedies`, guide, test และ eval ลบ `docs/reuse-catalog.md` ของ repo
   นี้ catalog ของ project อื่นไม่แตะ ส่วนขั้น "use something that already
   exists" ของ `scrutinize` เองไม่เกี่ยว
2. **ticket เก่ายังใช้ได้** checker และ implementer เพิกเฉยบรรทัด `**Reuse:**`
   ที่ค้างอยู่โดยไม่ error ไม่เตือน
3. **ผู้ใช้กำหนดรอบรีวิวเอง** ตอนเข้า Stage 2 ถามครั้งเดียวว่าจะรีวิวไหมและสูงสุด
   กี่รอบ (เสนอ 3, ตอบ `0` คือข้าม, `--review N` ตอบล่วงหน้า) ค่าที่เลือกและรอบที่
   ใช้ไปเก็บใน State ของ `decisions.md` เพื่อให้ `continue` ทำต่อโดยไม่ถามซ้ำและ
   ไม่เติมรอบที่ใช้ไปแล้ว
4. **ทางออกเดียวสำหรับรอบหมดและ stall** ถามครั้งเดียวว่าจะเพิ่มรอบ (ผู้ใช้ระบุ
   จำนวนเอง ไม่มีค่าเริ่มต้น) หรือไป Stage 3 default คือไป Stage 3 พร้อมบันทึก
   finding ที่ค้างใน `design-review.md` และ Further Notes ของ spec ส่วน `REJECT`
   หยุดเสมอ
5. **การรีวิวใน context ใหม่ของ ADR 0010 ยังใช้ต่อ** แทนที่เฉพาะเพดาน 6 รอบ

## Consequences / ผลที่ตามมา

### Positive / ข้อดี

- `grill-to-tickets` is shorter: Stage 0 goes straight to the interview, specs
  and tickets carry no reuse section or field, and the handoff has no catalog
  commit.
- The person decides how much review a spec is worth, and is asked, not
  blocked, when it runs out.
- One fewer cross-skill contract to keep in step; the reuse wording drift test
  is gone.

### Trade-offs / ข้อแลกเปลี่ยน

- Nothing surveys existing code for reusable modules any more, so duplication of
  code outside the diff is no longer caught by this pipeline; only the
  implementer's own judgement and `scrutinize` remain.
- Going on to Stage 3 with open findings is now a one-keypress default; the
  findings are recorded, not fixed.

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- Remove reuse from `grill-to-tickets` only: leaves the implementers and
  `review-to-pr` reading a field and a catalog nothing writes.
- Keep the six-cycle default and add a way to skip: still leaves the person no
  say over the number of rounds or what happens at the end.
- Ask before every round: interrupts a review that returns `SHIP` on round one.
