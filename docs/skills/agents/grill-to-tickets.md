# Grill to Tickets

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/grill-to-tickets/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

พา idea เดียวจากการสัมภาษณ์แบบ relentless ไปจนถึง ticket ที่พร้อมให้ agent หยิบทำ แล้ว **หยุด**
โดยรัน `grilling`, `domain-modeling`, `to-spec`, `scrutinize` และ `to-tickets` แบบ inline
ต่อเนื่องใน context เดียว ไม่ลงมือ implement และไม่แตะ `grill-with-docs` หรือ skill ของ Matt Pocock

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill grill-to-tickets
```

### ควรใช้เมื่อไร

- มี idea ใหม่และอยากได้ spec + ticket ที่ผ่าน design review ก่อนเริ่มเขียนโค้ด
- อยากให้ขั้น discovery, spec และ ticket อยู่ใน context window เดียวเพื่อรักษาคุณภาพการคิด
- ต้องการ design review gate ที่มี budget จำกัด (6 รอบ), ตรวจจับ stall และแยก rework สองแบบ

### ไม่ควรใช้เมื่อไร

- ถ้าต้องการให้ทำถึงขั้น implement และ review โค้ดด้วย ใช้ `/grill-with-docs` หรือ `/engineering-workflow`
- ถ้าต้องการแค่ discipline เดียว เรียก `/grilling`, `/to-spec`, `/scrutinize` หรือ `/to-tickets` ตรง ๆ

### วิธีทำงานหลัก

เรียก `/grill-to-tickets <idea>` หรือ `$grill-to-tickets <idea>` จากนั้น:

1. **Stage 0 — Grill**: สัมภาษณ์แบบ design tree พร้อมทำ domain modeling เขียน `CONTEXT.md` / `adr/` ทันทีที่ term นิ่ง แล้วหยุดขอ confirmation เมื่อ frontier ว่าง
2. **Stage 1 — Spec**: รัน `to-spec` สังเคราะห์บทสนทนาเป็น `spec.md` โดยไม่สัมภาษณ์ซ้ำ
3. **Stage 2 — Design Review Gate**: รัน `scrutinize` แล้ว normalize verdict เป็น `SHIP` / `FIX_THEN_SHIP` / `REWORK` / `REJECT` เก็บรายงานไว้ไฟล์เดียว `design-review.md` อัปเดตทุกรอบ
4. **Stage 3 — Tickets**: เมื่อได้ `SHIP` รัน `to-tickets` เขียน ticket ลง `.scratch/<feature-slug>/issues/`
5. **Stop**: พิมพ์คำสั่ง `/clear` แล้ว `/implement <ticket แรก>` ไม่เรียก `implement` เอง

`REWORK` แบบ spec-level รัน `to-spec` ใหม่และอยู่ใน Stage 2 ส่วน decision-level กลับไป Stage 0 เพื่อ grill
การตัดสินใจนั้นใหม่ โดย cycle counter ไม่ถูก reset

### ตัวอย่าง prompt

```text
/grill-to-tickets เพิ่มการตั้งค่าขนาดฟอนต์ subtitle ในหน้า player settings ให้ผู้ใช้ปรับเองได้และจำค่าไว้ต่อเครื่อง
```

### ไฟล์ที่เกี่ยวข้อง

- `references/design-review-gate.md` — source เดียวของ routing table เต็ม, cycle accounting, stall detection, gate report format (SKILL.md Stage 2 เก็บแค่สรุปสั้น ๆ ต่อ verdict แล้วชี้มาที่นี่)
- `evals/evals.json` — 7 เคสพฤติกรรม หนึ่งเคสต่อ routing branch ของ Design Review Gate ในรูปแบบ benchmark ของ `skill-creator` รันแบบ on-demand ไม่ได้อยู่ใน CI
- `evals/trigger-evals.json` — กันไม่ให้ description ของ skill อ่านเหมือนเป็น model-invocable (skill นี้เป็น `disable-model-invocation`)

## English / ภาษาอังกฤษ

### Purpose

Carry one idea from a relentless discovery interview through to published,
ticket-ready work, then stop. It inline-executes `grilling`, `domain-modeling`,
`to-spec`, `scrutinize`, and `to-tickets` in a single continuous context window.
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

- You want the run to continue into implementation and code review — use
  `/grill-with-docs` or `/engineering-workflow`.
- You only need one discipline — call `/grilling`, `/to-spec`, `/scrutinize`, or
  `/to-tickets` directly.

### Main workflow

Invoke `/grill-to-tickets <idea>` or `$grill-to-tickets <idea>`. The skill runs
four stages — Grill, Spec, Design Review Gate, Tickets — writing every artifact
under `.scratch/<feature-slug>/`. The Design Review Gate normalizes each
`scrutinize` verdict into `SHIP`, `FIX_THEN_SHIP`, `REWORK`, or `REJECT`, keeps
one stable `design-review.md` report, and bounds itself to six cycles with early
stops for stalls and a required human authorization on budget exhaustion. A
spec-level `REWORK` re-runs `to-spec` without leaving the gate; a decision-level
`REWORK` returns to Stage 0 to re-grill, and the cycle counter carries over. On
`SHIP`, tickets are published and the skill prints a `/clear` + `/implement`
handoff and stops.

### Example prompt

```text
/grill-to-tickets Add a local subtitle font-size preference to the player settings panel, adjustable by the user and remembered per device.
```

### Related files

- `references/design-review-gate.md` — the single source for the full routing
  table, cycle accounting, stall detection, and the per-cycle gate report format;
  SKILL.md Stage 2 keeps only a brief per-verdict summary and points here
- `evals/evals.json` — seven behavioral cases, one per Design Review Gate routing
  branch, in `skill-creator`'s benchmark format; run on demand, not in CI
- `evals/trigger-evals.json` — guards that the skill's description does not read
  as model-invocable (the skill is `disable-model-invocation`)
