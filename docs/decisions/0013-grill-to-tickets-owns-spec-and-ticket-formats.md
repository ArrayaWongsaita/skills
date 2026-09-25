# ADR 0013: grill-to-tickets owns the spec and ticket formats

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-09-25
- Amends / แก้ไขบริบทของ: ADR 0003

## Context / บริบท

`grill-to-tickets` inline-followed two skills whose output it parses: one wrote
`spec.md`, the other wrote the ticket files under `issues/`. The checker and all
three implementers read those two formats, and grill-to-tickets already
overrode most of both skills — the tracker step, the labels, and most of the
ticket template fields. Two templates fighting one local contract produces
contradictory instructions, and the new ticket fields (`Seam`, `Context`,
`Budget`) cannot be added to a template the model reads from another skill's
directory.

The remaining stage skills — `grilling`, `domain-modeling`, and `scrutinize` —
produce no parsed output: their value is the method the model follows inline, so
their upstream updates are wanted.

`grill-to-tickets` เดินตาม skill สองตัวที่มันอ่านผลลัพธ์เป็นรูปแบบของตัวเองอยู่แล้ว
(spec และ ticket) และได้ override เกือบทั้งหมดของทั้งคู่ (tracker, label, template)
การมี template สองชุดขัดกันทำให้คำสั่งสับสน และ field ใหม่ของ ticket (`Seam`,
`Context`, `Budget`) ไม่สามารถเพิ่มลง template ที่อ่านจาก skill อื่นได้
ส่วน stage skill ที่เหลือไม่มี output ที่ถูก parse จึงยังต้องการ update จาก upstream

## Decision / การตัดสินใจ

1. This skill adapts the two formats into its own
   `references/spec-format.md` and `references/ticket-format.md`, carrying the
   upstream notice and source line (see `references/UPSTREAM-LICENSE.md`), and
   stops depending on the two skills that wrote the formats.
2. `grilling`, `domain-modeling`, and `scrutinize` stay installed dependencies,
   as ADR 0003 requires, and Stages 0 and 2 follow them inline.
3. Preflight locates the three stage skills, and for each found records the path
   where it was found and the hash its lock holds, exactly as the lock holds it —
   no recomputation, no comparison, no warning. `npx skills check` is the tool
   for updates.
4. Stage 1 writes `spec.md` from `references/spec-format.md`; Stage 3 writes
   tickets from `references/ticket-format.md`. The ticket format can now grow
   (Seam, Context, Budget) without contradicting an upstream template.
5. This amends ADR 0003 decision 1, whose inline-execution list named five
   followed skills: two of the five are now owned formats, not followed skills.

## Consequences / ผลที่ตามมา

### Positive / ข้อดี

- One source for each parsed format: the checker and the implementers read the
  same fields grill-to-tickets writes.
- The ticket format can grow without contradicting the template the model reads.
- Upstream updates to the interview and review methods still arrive; only the
  two parsed formats are frozen.

### Trade-offs / ข้อแลกเปลี่ยน

- Upstream improvements to spec and ticket writing no longer arrive automatically.
- The repository now carries both formats and their MIT notice itself.

## Rejected alternatives / ทางเลือกที่ไม่เลือก

- **Vendor all five stage skills.** It would freeze the interview and review
  methods too — exactly the upstream updates the remaining stage skills are
  wanted for.
- **Vendor none.** The new ticket fields would contradict the upstream template
  the model reads, and the upstream tracker steps would keep fighting the local
  files.
- **A hash check against known-good versions.** It would warn on the very
  updates this ADR wants, and lock hash formats vary between project and global
  installs; recording the hash as found keeps Preflight informative without a
  policy.
