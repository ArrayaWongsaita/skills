# คู่มือการติดตั้งและใช้งาน Skill: implement-tickets

- **หมวดหมู่ (Category):** `agents`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/implement-tickets/SKILL.md`](../../skills/agents/implement-tickets/SKILL.md)

## ภาษาไทย / Thai

### implement-tickets คืออะไร?

`implement-tickets` รับชุด ticket ใน `.scratch/<feature-slug>/issues/` แล้ววางแผน
การ implement ตาม blocker และ touch set จากนั้น dispatch native harness subagents
เป็น wave มี verifier สดใหม่ตรวจผล และรวมงานที่ผ่านการตรวจสอบทีละ ticket

ค่าเริ่มต้นใช้ native subagents ไม่ต้องติดตั้ง adapter เพิ่ม การวางแผนเป็นแบบ
อ่านอย่างเดียวและแสดง **Plan** ก่อนเริ่ม dispatch ทุกครั้ง โดยหยุดรอ approval อย่าง
ชัดเจน และไม่มีไฟล์นอก feature directory เปลี่ยนแปลงก่อน approval

### การเรียกใช้งาน

เรียกอย่างชัดเจนด้วย slash command หรือ Codex command:

```text
/implement-tickets <dir|slug>
$implement-tickets <dir|slug>
```

ระบุ feature root, โฟลเดอร์ `issues/` หรือ slug ใต้ `.scratch/` ได้ ตัวเลือกที่ใช้ได้:

- `--with <backend>` เลือก adapter; ถ้าไม่ระบุใช้ native harness subagents
- `--agent <name>` pin worker agent สำหรับ native backend
- `--model <id>` ส่งต่อ model ให้ backend ที่เลือก
- `--concurrency N` จำกัดจำนวน worker และ verifier ที่ทำงานพร้อมกัน ค่าเริ่มต้น 4
- `--serial` แยก ticket ทุกใบเป็นคนละ wave

Implicit invocation ปิดไว้ทั้ง Claude Code (`disable-model-invocation: true`)
และ Codex (`allow_implicit_invocation: false`) จึงเริ่มได้เมื่อผู้ใช้เรียก skill
โดยตรงเท่านั้น

### ติดตั้ง

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

### ขั้นตอนหลัก

1. **Plan:** อ่าน ticket และบริบทที่เกี่ยวข้อง ตรวจ blocker และลำดับหมายเลข แล้วรัน
   `scripts/waves.mjs` เพื่อคำนวณ touch set, warnings และ waves
2. **Pause:** แสดง ticket ทุกใบพร้อม wave, blockers, touch set, seam, matched agent
   และ retry budget รวม backend, concurrency cap และ warnings แล้วรอ approval
3. **Execute:** หลัง approval จึง dispatch workers และ verifiers ตาม wave จากนั้น
   integrate งานที่ผ่าน verification
4. **Handoff:** หยุดก่อน review, push หรือเปิด PR และส่งชื่อ integration branch ให้ผู้ใช้

ถ้า marker ระบุ `status: not validated` แผนจะแสดงบรรทัด
`parallel not yet validated` เพื่อให้เห็นสถานะการตรวจสอบ parallel execution

### การคำนวณ wave

`waves.mjs` อ่าน `Blocked by` และ `Context` จาก ticket files โดย `(edit)`, `(new)`
และ `(edit from NN)` เป็น touch set ส่วน path ที่อ่านอย่างเดียวไม่นำมาคำนวณ
Ticket ที่ไม่มี change path หรือมี glob จะได้ wave เดี่ยวและ warning

ระบบวาง ticket ตามหมายเลขใน wave แรกที่อยู่หลัง blocker ทั้งหมดและไม่มี touch-set
overlap ถ้า path ซ้ำหรือเป็น directory ที่ครอบอีก path จะถือว่า overlap ตัว checker
ปฏิเสธ Context path ที่เป็น directory อยู่แล้ว ดังนั้น fixture ของ directory overlap
จึงระบุว่าเข้าไม่ถึงจาก ticket set ที่ checker ยอมรับ

`--concurrency N` ถูกสะท้อนใน JSON แต่ไม่เปลี่ยน wave; orchestrator บังคับ cap ตอน
dispatch ส่วน `--serial` จะให้ ticket ละ wave

### Seam และ Context

**Seam:** worker ใช้ `**Seam:**` ของ ticket แบบ verbatim เป็นขอบเขตสำหรับทดสอบ
**Context:** orchestrator แปลง `**Context:**` เป็นรายการอ่านของ worker; รายการปกติ
และ `(from NN)` เป็น read-only ส่วน `(edit)`, `(new)` และ `(edit from NN)` กำหนด
touch set ที่ใช้แยก wave

## English / ภาษาอังกฤษ

### Purpose and use

`implement-tickets` plans a published ticket set before dispatching native
harness subagents. It groups tickets by blockers and touch-set overlap, runs a
fresh verifier for each worker, and integrates verified work in ticket order.
The default concurrency cap is four; `--concurrency N` sets a different cap and
`--serial` gives each ticket its own wave.

Invoke it explicitly with `/implement-tickets <dir|slug>` or
`$implement-tickets <dir|slug>`. Implicit invocation is disabled for Claude Code
and Codex. The Plan names each ticket's wave, blockers, touch set, seam, matched
agent, and retry budget, along with the backend, concurrency cap, and warnings.
It pauses for explicit approval; no file outside the feature directory changes
until approval.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

When the marker says `status: not validated`, the Plan prints the line
`parallel not yet validated`. A ticket with no declared change path or a glob
gets an exclusive wave and a warning. `--concurrency N` does not change wave
placement; the orchestrator enforces the in-flight cap across workers and
verifiers.

### Seam and Context

**Seam:** The worker uses the ticket's `**Seam:**` verbatim as its test boundary.
**Context:** The orchestrator turns `**Context:**` into the worker's read list;
plain and `(from NN)` items are read-only, while `(edit)`, `(new)`, and
`(edit from NN)` items define the touch set used for wave planning.

### Related files

- `skills/agents/implement-tickets/SKILL.md` — invocation and workflow contract
- `references/planning.md` — ticket parsing, wave calculation, and Plan rules
- `references/parallel-validation.md` — the validation marker
- `scripts/waves.mjs` — deterministic wave planner
