# Grill to Tickets

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/grill-to-tickets/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

พา idea เดียวจากการสัมภาษณ์แบบ relentless ไปจนถึง ticket ที่พร้อมให้ agent หยิบทำ แล้ว **หยุด**
โดยรัน `grilling` และ `domain-modeling` แบบ inline ต่อเนื่องใน context เดียว
เขียน spec ตาม `references/spec-format.md` และ ticket ตาม `references/ticket-format.md`
ซึ่งเป็นรูปแบบที่ skill เป็นเจ้าของเอง (ดัดแปลงจาก upstream พร้อมแนบ `UPSTREAM-LICENSE.md`)
มี 2 ขั้นตอนที่ dispatch subagent: Stage 2 ส่ง `scrutinize` รีวิว spec ใน context ใหม่ และ Stage 3 ส่ง fresh reviewer ทำ Ticket review เพื่อหา ambiguity ในชุด ticket; skill ไม่ลงมือ implement และไม่แตะ `grill-with-docs` หรือ skill ของ Matt Pocock

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill grill-to-tickets
```

ต้องมี stage skill อีก 3 ตัว (`grilling`, `domain-modeling`, `scrutinize`) ตอนเริ่ม **Preflight** จะหาใน `.agents/skills/`, `.claude/skills/`, `~/.agents/skills/` และ `~/.claude/skills/` ตามลำดับ ถ้าขาดตัวไหนจะหยุดและพิมพ์คำสั่ง `npx skills add ...` ของตัวที่ขาด พร้อมบันทึกเฉพาะชื่อ skill และ path ที่พบ ใช้ `npx skills check` เช็ก update ไม่ต้องตั้งค่า issue tracker เพราะไฟล์ใน `.scratch/` คือ tracker

### ควรใช้เมื่อไร

- มี idea ใหม่และอยากได้ spec + ticket ที่ผ่าน design review ก่อนเริ่มเขียนโค้ด
- อยากให้ขั้น discovery, spec และ ticket อยู่ใน context window เดียวเพื่อรักษาคุณภาพการคิด
- ต้องการ design review gate พร้อมงบ review, การตรวจจับ stall และการแยก rework สองแบบ; ดูรายละเอียดในสัญญาหลัก

### ไม่ควรใช้เมื่อไร

- ถ้าต้องการแค่ discipline เดียว เรียก `/grilling`, `/scrutinize` ตรง ๆ

### วิธีทำงานหลัก

เรียก `/grill-to-tickets <idea>` หรือ `$grill-to-tickets <idea>` (ถ้า run ค้างกลางทาง เช่นหลัง `/clear` ให้เรียก `/grill-to-tickets continue <feature-slug>` เพื่อทำต่อจาก State ใน `decisions.md`) จากนั้น:

1. **Stage 0 — Grill**: สัมภาษณ์และทำ domain modeling เพื่อสร้าง `decisions.md`, `CONTEXT.md` และ `adr/`; blind-spot pass เตรียมสมมติฐานก่อนพักเพื่อยืนยัน คำศัพท์ `hard` / `easy`, `parked` และ `resolved: assumed` ใช้ตาม [glossary](../../../docs/glossary.md) และ contract links ด้านล่าง
2. **Stage 1 — Spec**: สังเคราะห์บันทึก Stage 0 เป็น `spec.md` ตาม `spec-format.md`; ดู [glossary](../../../docs/glossary.md) และสัญญาหลักสำหรับคำศัพท์ Scenario และ Test Seam
3. **Stage 2 — Design Review Gate**: ส่ง `scrutinize` มาตรวจ spec; ดู [สัญญา Design Review Gate](../../../skills/agents/grill-to-tickets/references/design-review-gate.md) สำหรับ routing, resume และทางออกของ gate
4. **Stage 3 — Tickets** (Ticket review / Stage 3.5): แตก spec เป็น vertical tickets ใน `.scratch/<feature-slug>/issues/`; tickets ใช้ Stories, Seam, Context และ Budget ตาม `ticket-format.md`; checker สรุป coverage, budget, DAG และ warnings และสร้าง manifest ที่ `.scratch/<feature-slug>/manifest.json` ตาม [สัญญา grill-to-tickets หลัก](../../../skills/agents/grill-to-tickets/SKILL.md)
   - **Ticket review (Stage 3.5)** ทำหลัง checker PASS และก่อน quiz; ดู [สัญญาหลัก](../../../skills/agents/grill-to-tickets/SKILL.md) และ [brief สำหรับผู้รีวิว ticket](../../../skills/agents/grill-to-tickets/references/ticket-review.md)
   - **เสนอ `Risk: high` ที่ quiz:** skill เสนอ `Risk: high` พร้อมเหตุผลตามกฎใน [ticket-format reference](../../../skills/agents/grill-to-tickets/references/ticket-format.md); ผู้ใช้ยืนยันหรือปฏิเสธทีละ ticket และเฉพาะ high ที่ยืนยันแล้วเท่านั้นที่ถูกเขียนลงไฟล์ ticket ส่วน ticket อื่นเขียนโดยไม่มีฟิลด์ Risk
5. **Stop**: `.scratch/` เป็นไฟล์ local ที่ git-ignore; handoff ส่ง `/clear`, DAG summary ที่มีบรรทัด `recommended implementer: implement-tickets`, `Manifest: .scratch/<feature-slug>/manifest.json` เมื่อมี และ `/implement-tickets .scratch/<feature-slug>/`; manifest ระบุ `recommendedImplementers: ["implement-tickets"]` ทุก wave width พร้อมรายการ parked questions ที่รับเป็นสมมติฐาน (ดู [สัญญาคำถามที่พักไว้](../../../skills/agents/grill-to-tickets/references/parked-questions.md))

สรุป Stage 0 ใช้คำศัพท์ `hard` / `easy`, `parked` และ `resolved: assumed`; glossary อธิบายศัพท์กลาง ส่วนกติกาและ state transitions อยู่ใน [สัญญา grill-to-tickets หลัก](../../../skills/agents/grill-to-tickets/SKILL.md), [Decision Log](../../../skills/agents/grill-to-tickets/references/decision-log.md), [สัญญาคำถามที่พักไว้](../../../skills/agents/grill-to-tickets/references/parked-questions.md), [สัญญา Blind-spot pass](../../../skills/agents/grill-to-tickets/references/blind-spot-pass.md), [สัญญา Design Review Gate](../../../skills/agents/grill-to-tickets/references/design-review-gate.md) และ [ตาราง rationalization](../../../skills/agents/grill-to-tickets/references/rationalizations.md)

### ตัวอย่าง prompt

```text
/grill-to-tickets เพิ่มการตั้งค่าขนาดฟอนต์ subtitle ในหน้า player settings ให้ผู้ใช้ปรับเองได้และจำค่าไว้ต่อเครื่อง
```

### ไฟล์ที่เกี่ยวข้อง

- `references/spec-format.md` — รูปแบบ spec ที่ skill เป็นเจ้าของ ดัดแปลงจาก upstream พร้อมบรรทัดแหล่งที่มาและ MIT notice
- `references/ticket-format.md` — รูปแบบ ticket ที่ skill เป็นเจ้าของ พร้อมฟิลด์ Seam, Context และ Budget ดัดแปลงจาก upstream พร้อมบรรทัดแหล่งที่มาและ MIT notice
- `references/ticket-review.md` — brief และ return format `READY` / `ASK` ของ Ticket review ใน Stage 3.5
- `.scratch/<feature-slug>/manifest.json` — derived planning snapshot สำหรับ handoff; สัญญา grill-to-tickets หลักอธิบายเนื้อหาและกฎที่เกี่ยวข้อง
- `references/UPSTREAM-LICENSE.md` — MIT notice ของ upstream ที่รูปแบบทั้งสองแนบไว้
- `references/decision-log.md` — รูปแบบของ Decision Log (`decisions.md`) เวลาที่ต้องเขียน และขั้นตอน `continue <feature-slug>`
- `references/blind-spot-pass.md` — วิธีบันทึกช่องว่างและสมมติฐานใน Stage 0; ดูขั้นตอนใน reference หลัก
- `references/design-review-gate.md` — source เดียวของ routing table เต็ม, cycle accounting, stall detection, gate report format (SKILL.md Stage 2 เก็บแค่สรุปสั้น ๆ ต่อ verdict แล้วชี้มาที่นี่)
- `scripts/check-tickets.mjs` — สคริปต์ Node สำหรับตรวจ ticket set; ดูวิธีเรียกใช้และผลลัพธ์ใน [สัญญา grill-to-tickets หลัก](../../../skills/agents/grill-to-tickets/SKILL.md)
- `evals/evals.json` — เคสพฤติกรรมในรูปแบบ benchmark ของ `skill-creator`: อย่างน้อยหนึ่งเคสต่อ routing branch ของ Design Review Gate, หนึ่งเคสต่อกลไกป้องกัน (decision log, `continue`, blind-spot pass, reviewer ใน context ใหม่, การไล่แก้หลัง `FIX_THEN_SHIP`, สคริปต์ตรวจ ticket) และเคส `quality:` ที่วัดคุณภาพของคำถาม spec และ ticket รันแบบ on-demand ไม่ได้อยู่ใน CI เวลา benchmark ให้ใช้ snapshot ของ skill เวอร์ชันก่อนหน้าเป็น baseline แบบ `old_skill` ของ `skill-creator`
- `evals/trigger-evals.json` — กันไม่ให้ description ของ skill อ่านเหมือนเป็น model-invocable (skill นี้เป็น `disable-model-invocation`)

## English / ภาษาอังกฤษ

### Purpose

Carry one idea from a relentless discovery interview through to published,
ticket-ready work, then stop. It inline-executes `grilling` and `domain-modeling`
in a single continuous context window, writes `spec.md` from its owned
`references/spec-format.md` and tickets from its owned
`references/ticket-format.md` (adapted upstream, notice carried in
`UPSTREAM-LICENSE.md`). Two steps dispatch a subagent: Stage 2 sends
`scrutinize` for the spec review, and Stage 3 sends a fresh reviewer for the
ticket review. It never implements, and it never touches `grill-with-docs` or
any Matt Pocock-sourced skill.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill grill-to-tickets
```

The three stage skills — `grilling`, `domain-modeling`, `scrutinize` — must be
installed too. A **Preflight** looks for each in `.agents/skills/`,
`.claude/skills/`, `~/.agents/skills/`, then `~/.claude/skills/`, and stops
before Stage 0 with the `npx skills add` line of any that is missing. For each
one it finds, it records only the skill name and path found; `npx skills check`
is the update tool. No issue tracker is needed: the files under `.scratch/` are the tracker.

### Use it when

- You have a fresh idea and want a design-reviewed spec plus tickets before any code.
- You want discovery, specification, and ticket breakdown to share one context
  window so reasoning stays sharp across the whole planning pass.
- You want a design-review gate with a review budget, stall detection, and a
  spec-level / decision-level rework split.

### Do not use it when

- You only need one discipline — call `/grilling` or `/scrutinize` directly.

### Main workflow

Invoke `/grill-to-tickets <idea>` or `$grill-to-tickets <idea>`; resume an
interrupted run with `/grill-to-tickets continue <feature-slug>`. The skill runs
four stages — Grill, Spec, Design Review Gate, Tickets — and writes feature
artifacts under `.scratch/<feature-slug>/`. Stage 0 interviews the user and
does domain modeling; Stage 1 turns the recorded decisions into a spec; Stage 2
reviews that spec; Stage 3 creates ticket-ready work.

The workflow uses the terms `hard`, `easy`, `parked`, and `resolved: assumed`.
See the [glossary](../../../docs/glossary.md) for shared vocabulary and the
[canonical skill contract](../../../skills/agents/grill-to-tickets/SKILL.md),
[Decision Log](../../../skills/agents/grill-to-tickets/references/decision-log.md),
[parked-question contract](../../../skills/agents/grill-to-tickets/references/parked-questions.md),
[blind-spot pass contract](../../../skills/agents/grill-to-tickets/references/blind-spot-pass.md),
[Design Review Gate contract](../../../skills/agents/grill-to-tickets/references/design-review-gate.md),
and [rationalization table](../../../skills/agents/grill-to-tickets/references/rationalizations.md)
for workflow rules and state transitions.

```text
Stage 0: Grill
   │ pause · confirm + ask review maximum
   ▼
Stage 1: Spec
   ▼
Stage 2: Design Review Gate
   ▼
Stage 3: Tickets → Stage 3.5: Ticket review
   ▼
Stop: handoff
```
The handoff carries planning context needed by the next run; see the parked-question contract for status details.

Stage 1 writes a testable spec using the owned `references/spec-format.md`; the
[glossary](../../../docs/glossary.md) defines shared terms such as Scenario and
Test Seam. Stage 2 sends
`scrutinize` to a fresh reviewer; see the [canonical Design Review Gate
contract](../../../skills/agents/grill-to-tickets/references/design-review-gate.md)
for review routing and resume.

Stage 3 writes vertical tickets using the owned
`references/ticket-format.md`; each ticket names its Stories, Seam, Context,
and Budget. The checker summarizes coverage, budget, DAG, and warnings; the
manifest lives at `.scratch/<feature-slug>/manifest.json`. See the
[canonical grill-to-tickets contract](../../../skills/agents/grill-to-tickets/SKILL.md)
for checker and manifest rules. Stage 3.5 Ticket review runs after checker
PASS and before the quiz; see the [ticket-review brief](../../../skills/agents/grill-to-tickets/references/ticket-review.md).

At the ticket quiz the skill proposes `Risk: high`, with a reason, under the rule in the
[ticket-format reference](../../../skills/agents/grill-to-tickets/references/ticket-format.md). The person confirms or
rejects each proposed high. Only a confirmed high is written to its ticket file;
every other ticket is written without a Risk field.

Then the skill prints a handoff in this order: `/clear`, the DAG summary with
`recommended implementer: implement-tickets`, a `Manifest: .scratch/<feature-slug>/manifest.json` line when available, and the implementer command
`/implement-tickets .scratch/<feature-slug>/`. The manifest's
`recommendedImplementers` array is `["implement-tickets"]` at every wave
width. It lists parked questions carried as assumptions; see the
[parked-question contract](../../../skills/agents/grill-to-tickets/references/parked-questions.md)
for details. The `.scratch/` files are local and git-ignored, so the next run
can start from the ticket directory without a commit, and the skill stops.

### Example prompt

```text
/grill-to-tickets Add a local subtitle font-size preference to the player settings panel, adjustable by the user and remembered per device.
```

### Related files

- `references/spec-format.md` — the owned spec format, adapted upstream with its
  source line and the MIT notice
- `references/ticket-format.md` — the owned ticket format with the Seam,
  Context, and Budget fields, adapted upstream with its source line and the MIT
  notice
- `references/ticket-review.md` — the fresh reviewer's brief and `READY` / `ASK`
  return format for the Stage 3.5 ambiguity review
- `.scratch/<feature-slug>/manifest.json` — the derived planning snapshot used by the handoff; `recommendedImplementers` is `["implement-tickets"]` at every wave width, and the canonical grill-to-tickets contract documents its contents and rules
- `references/UPSTREAM-LICENSE.md` — the upstream MIT notice both formats carry
- `references/blind-spot-pass.md` — the Stage 0 process for recording planning
  gaps and assumptions; see the canonical reference for the procedure
- `references/decision-log.md` — the Decision Log format, when to write it, and
  the `continue <feature-slug>` resume procedure
- `references/design-review-gate.md` — the single source for the full routing
  table, cycle accounting, stall detection, and the per-cycle gate report format;
  SKILL.md Stage 2 keeps only a brief per-verdict summary and points here
- `scripts/check-tickets.mjs` — the dependency-free Node checker; see the [canonical grill-to-tickets contract](../../../skills/agents/grill-to-tickets/SKILL.md) for usage and results
- `evals/evals.json` — behavioral cases in `skill-creator`'s benchmark format:
  at least one per Design Review Gate routing branch, one
  per planning safeguard (decision log, `continue`, blind-spot pass, fresh
  reviewer, the `FIX_THEN_SHIP` sweep, the ticket checker), and `quality:` cases
  that grade the interview, the spec, and the tickets; run on demand, not in CI,
  benchmarked against a snapshot of the previous skill version as
  `skill-creator`'s `old_skill` baseline
- `evals/trigger-evals.json` — guards that the skill's description does not read
  as model-invocable (the skill is `disable-model-invocation`)

### Feature-scoped Storage

```text
.scratch/<feature-slug>/
├── decisions.md
├── parked.md
├── CONTEXT.md
├── adr/
├── spec.md
├── design-review.md
├── issues/
└── manifest.json
```
