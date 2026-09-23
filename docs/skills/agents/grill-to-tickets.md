# Grill to Tickets

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/grill-to-tickets/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

พา idea เดียวจากการสัมภาษณ์แบบ relentless ไปจนถึง ticket ที่พร้อมให้ agent หยิบทำ แล้ว **หยุด**
โดยรัน `grilling`, `domain-modeling`, `to-spec` และ `to-tickets` แบบ inline
ต่อเนื่องใน context เดียว ส่วน `scrutinize` รีวิว spec ใน subagent ตัวใหม่ ไม่ลงมือ implement และไม่แตะ `grill-with-docs` หรือ skill ของ Matt Pocock

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill grill-to-tickets
```

### ควรใช้เมื่อไร

- มี idea ใหม่และอยากได้ spec + ticket ที่ผ่าน design review ก่อนเริ่มเขียนโค้ด
- อยากให้ขั้น discovery, spec และ ticket อยู่ใน context window เดียวเพื่อรักษาคุณภาพการคิด
- ต้องการ design review gate ที่มี budget จำกัด (6 รอบ), ตรวจจับ stall และแยก rework สองแบบ

### ไม่ควรใช้เมื่อไร

- ถ้าต้องการให้ทำถึงขั้น implement และ review โค้ดใน run เดียว ใช้ `/engineering-workflow` (หรือทำต่อจาก ticket ด้วย `/subagent-implement` แล้วตามด้วย `/review-to-pr`)
- ถ้าต้องการแค่ discipline เดียว เรียก `/grilling`, `/to-spec`, `/scrutinize` หรือ `/to-tickets` ตรง ๆ

### วิธีทำงานหลัก

เรียก `/grill-to-tickets <idea>` หรือ `$grill-to-tickets <idea>` (ถ้า run ค้างกลางทาง เช่นหลัง `/clear` ให้เรียก `/grill-to-tickets continue <feature-slug>` เพื่อทำต่อจาก State ใน `decisions.md`) จากนั้น:

1. **Stage 0 — Grill**: เริ่มด้วย **Reuse survey** อ่าน `docs/reuse-catalog.md` ของ project ตรวจว่าทุกรายการยังมีอยู่จริง แล้วสำรวจเฉพาะส่วนที่ยังไม่เคยสำรวจหรือไฟล์ที่เปลี่ยนหลังวันที่ใน Coverage (ถ้ายังไม่มี catalog จะสร้างให้พร้อมเพิ่มบรรทัดชี้ใน `AGENTS.md`) ทางเลือกเรื่อง reuse เช่น ขยายของเดิมหรือสร้างใหม่ จะกลายเป็นคำถามให้คุณตัดสิน จากนั้นสัมภาษณ์แบบ design tree พร้อมทำ domain modeling เขียน `CONTEXT.md` / `adr/` ทันทีที่ term นิ่ง บันทึกทุกคำถามและคำตอบลง **Decision Log** (`decisions.md`) ก่อนถามรอบถัดไป เมื่อ frontier ว่างจะทำ **Blind-spot pass** ไล่ 9 หมวด (scope, data, flow, quality attributes, integrations, edge cases, constraints, terminology, completion signals) ช่องว่างที่เปลี่ยน spec ได้จะถูกถามเป็นรอบสุดท้ายไม่เกิน 5 ข้อ ที่เหลือเขียนเป็นสมมติฐานให้เห็น แล้วหยุดขอ confirmation
2. **Stage 1 — Spec**: รัน `to-spec` สังเคราะห์ `decisions.md`, glossary และ ADR เป็น `spec.md` โดยไม่สัมภาษณ์ซ้ำ ทุกการตัดสินใจใน log ต้องอยู่ใน spec พร้อม **Reuse Plan** ที่ระบุว่าแต่ละ module จะใช้ของเดิม ขยาย สร้างเป็น shared (ต้องมีผู้ใช้ตั้งแต่ 2 ราย) สร้างเป็น candidate promote หรือแยกไว้โดยตั้งใจ
3. **Stage 2 — Design Review Gate**: แต่ละรอบส่ง `scrutinize` ไปรันใน subagent ตัวใหม่ที่เห็นแค่ไฟล์และไม่แก้ไฟล์ใด ๆ (อ่าน spec แบบเดียวกับ implementer) แล้ว context หลัก normalize verdict เป็น `SHIP` / `FIX_THEN_SHIP` / `REWORK` / `REJECT` (`FIX_THEN_SHIP` แก้แล้วต้องไล่แก้ทุกประโยคใน spec ที่พูดเรื่องเดียวกันให้ตรงกัน) เก็บรายงานไว้ไฟล์เดียว `design-review.md` อัปเดตทุกรอบ และตรวจ **reuse lens** ทุกรอบ (ของที่ซ้ำกับ catalog, logic ที่ไม่มีเจ้าของ, shared ที่เผื่ออนาคตเกินไป)
4. **Stage 3 — Tickets**: เมื่อได้ `SHIP` รัน `to-tickets` เขียน ticket ลง `.scratch/<feature-slug>/issues/` shared module ใหม่แต่ละตัวมี ticket เจ้าของใบเดียวและ ticket ที่ใช้ต้องรอ ticket เจ้าของ ทุก ticket มีบรรทัด `**Reuse:**` (`use` / `extend` / `create-shared` / `create-candidate` / `promote`) ซึ่งไม่ใช่ acceptance criterion และมีบรรทัด `**Stories:**` บอกเลข user story ที่ ticket นั้นส่งมอบ ก่อน quiz ต้องรัน `scripts/check-tickets.mjs` ให้ผ่าน (ทุก story มี ticket, Blocked by ชี้ ticket ที่มีจริงและเลขต่ำกว่า, Reuse ถูกที่และใช้คำกริยาถูก, create-shared/promote มีเจ้าของใบเดียวที่ block ผู้ใช้รายอื่น) แล้วแสดงตาราง story coverage ใน quiz
5. **Stop**: บอกให้ commit ไฟล์วางแผนและ `docs/reuse-catalog.md` แล้วพิมพ์ `/clear` ตามด้วย `/subagent-implement .scratch/<feature-slug>/` (หรือ `/agy-implement` / `/opencode-implement`) ไม่เรียก implementer เอง

`REWORK` แบบ spec-level รัน `to-spec` ใหม่และอยู่ใน Stage 2 ส่วน decision-level กลับไป Stage 0 เพื่อ grill
การตัดสินใจนั้นใหม่ โดย cycle counter ไม่ถูก reset

### ตัวอย่าง prompt

```text
/grill-to-tickets เพิ่มการตั้งค่าขนาดฟอนต์ subtitle ในหน้า player settings ให้ผู้ใช้ปรับเองได้และจำค่าไว้ต่อเครื่อง
```

### ไฟล์ที่เกี่ยวข้อง

- `references/decision-log.md` — รูปแบบของ Decision Log (`decisions.md`) เวลาที่ต้องเขียน และขั้นตอน `continue <feature-slug>`
- `references/blind-spot-pass.md` — 9 หมวดที่ต้องไล่ก่อนหยุดพักท้าย Stage 0 (ดัดแปลงจาก `/clarify` ของ Spec Kit) วิธีให้คะแนน และเพดาน 5 คำถาม
- `references/design-review-gate.md` — source เดียวของ routing table เต็ม, cycle accounting, stall detection, gate report format (SKILL.md Stage 2 เก็บแค่สรุปสั้น ๆ ต่อ verdict แล้วชี้มาที่นี่)
- `references/reuse-pass.md` — กฎ reuse ของแต่ละ stage เริ่มจาก Reuse survey ใน Stage 0 (drift check, Coverage, bootstrap, pointer)
- `references/reuse-catalog-template.md` — template ของ `docs/reuse-catalog.md` ที่ใช้สร้างครั้งแรก header ของไฟล์อธิบายวิธีดูแลตัวเอง
- `scripts/check-tickets.mjs` — สคริปต์ Node (ไม่มี dependency) ตรวจ ticket ก่อน quiz: story coverage, Blocked by, Reuse field และเจ้าของ create-shared/promote พร้อมพิมพ์ตาราง story coverage (exit 0 ผ่าน, 1 มี error)
- `evals/evals.json` — เคสพฤติกรรม อย่างน้อยหนึ่งเคสต่อ routing branch ของ Design Review Gate และเคสของ Reuse survey ในรูปแบบ benchmark ของ `skill-creator` รันแบบ on-demand ไม่ได้อยู่ใน CI
- `evals/trigger-evals.json` — กันไม่ให้ description ของ skill อ่านเหมือนเป็น model-invocable (skill นี้เป็น `disable-model-invocation`)

## English / ภาษาอังกฤษ

### Purpose

Carry one idea from a relentless discovery interview through to published,
ticket-ready work, then stop. It inline-executes `grilling`, `domain-modeling`,
`to-spec`, and `to-tickets` in a single continuous context window, and runs
`scrutinize` in a fresh reviewer subagent.
It never implements, and it never touches `grill-with-docs` or any Matt
Pocock-sourced skill.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill grill-to-tickets
```

### Use it when

- You have a fresh idea and want a design-reviewed spec plus tickets before any code.
- You want discovery, specification, and ticket breakdown to share one context
  window so reasoning stays sharp across the whole planning pass.
- You want a design-review gate with a hard six-cycle budget, stall detection, and
  a spec-level / decision-level rework split.

### Do not use it when

- You want one run to continue into implementation and code review — use
  `/engineering-workflow` (or continue from the tickets with
  `/subagent-implement`, then `/review-to-pr`).
- You only need one discipline — call `/grilling`, `/to-spec`, `/scrutinize`, or
  `/to-tickets` directly.

### Main workflow

Invoke `/grill-to-tickets <idea>` or `$grill-to-tickets <idea>`; resume an
interrupted run with `/grill-to-tickets continue <feature-slug>`. The skill runs
four stages — Grill, Spec, Design Review Gate, Tickets — writing every feature
artifact under `.scratch/<feature-slug>/`. Stage 0 opens with a Reuse survey
against the project's Reuse Catalog (`docs/reuse-catalog.md`): it drift-checks
every entry, surveys only uncovered areas and files changed since their Coverage
date, bootstraps the catalog (with a pointer line in `AGENTS.md` or
`CLAUDE.md`) when it is missing, and turns genuine reuse choices into grilling
questions. Every question and answer is logged in the Decision Log
(`decisions.md`) before the next round, together with the run's State, so a
resumed run and Stage 1 read decisions from a file rather than from recall.
Before the Stage 0 pause, a blind-spot pass marks nine fixed categories (scope,
data, flow, quality attributes, integrations, edge cases, constraints,
terminology, completion signals); gaps that would change the spec become one
final round of at most five questions, and the rest become stated assumptions
shown in the pause summary.
Stage 1 writes the spec from that log, and a Reuse Plan into it — use as-is, extend, create
shared (two or more real consumers), create candidate, promote, or kept separate
on purpose — and every gate cycle applies a reuse lens that flags duplicated,
unowned, and speculative shared modules. Each Design Review Gate cycle dispatches
`scrutinize` to a fresh, read-only reviewer subagent that sees the files and not
the interview, so it reads the spec the way the implementer will (ADR 0010); the
main thread normalizes each verdict into `SHIP`, `FIX_THEN_SHIP`, `REWORK`, or
`REJECT`, keeps one stable `design-review.md` report, and bounds itself to six cycles with early
stops for stalls and a required human authorization on budget exhaustion. A
`FIX_THEN_SHIP` fix is followed by a sweep that aligns every other passage of the
spec restating the same fact. A spec-level `REWORK` re-runs `to-spec` without leaving the gate; a decision-level
`REWORK` returns to Stage 0 to re-grill, and the cycle counter carries over. On
`SHIP`, tickets are published — each new shared module with exactly one owner
ticket that its other consumers are blocked by, and every ticket with a
`**Reuse:**` line of fixed verbs that stays out of the acceptance criteria, plus a
`**Stories:**` line naming the spec stories it delivers. Before the quiz, the
bundled `scripts/check-tickets.mjs` must pass: every story has a ticket, every
blocker exists with a lower number, the Reuse field sits after Blocked by with
the fixed verbs, and every create-shared or promote symbol has one ticket that
blocks its other users; the quiz shows its story-coverage table. Then the skill
prints a handoff (commit the planning files, `/clear`, then
`/subagent-implement .scratch/<feature-slug>/` or its `agy` / `opencode`
siblings) and stops.

### Example prompt

```text
/grill-to-tickets Add a local subtitle font-size preference to the player settings panel, adjustable by the user and remembered per device.
```

### Related files

- `references/blind-spot-pass.md` — the nine categories checked before the
  Stage 0 pause (adapted from Spec Kit's `/clarify`), the marks, and the
  five-question cap
- `references/decision-log.md` — the Decision Log format, when to write it, and
  the `continue <feature-slug>` resume procedure
- `references/design-review-gate.md` — the single source for the full routing
  table, cycle accounting, stall detection, and the per-cycle gate report format;
  SKILL.md Stage 2 keeps only a brief per-verdict summary and points here
- `references/reuse-pass.md` — the reuse rules per stage, starting with the
  Stage 0 Reuse survey (drift check, Coverage, bootstrap, pointer)
- `references/reuse-catalog-template.md` — the bootstrap template for
  `docs/reuse-catalog.md`, whose header makes the file self-describing
- `scripts/check-tickets.mjs` — a dependency-free Node checker run before the
  Stage 3 quiz: story coverage, blockers, the Reuse field, and create-shared /
  promote ownership, with a story-coverage table (exit 0 pass, 1 errors)
- `evals/evals.json` — behavioral cases, at least one per Design Review Gate
  routing branch plus the Reuse survey cases, in `skill-creator`'s benchmark
  format; run on demand, not in CI
- `evals/trigger-evals.json` — guards that the skill's description does not read
  as model-invocable (the skill is `disable-model-invocation`)
