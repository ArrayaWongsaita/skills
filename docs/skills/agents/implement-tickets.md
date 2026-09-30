# implement-tickets

## ภาษาไทย / Thai

`implement-tickets` วางแผนชุด ticket ที่ publish แล้วใน
`.scratch/<feature-slug>/issues/` ก่อน dispatch native harness subagents
คำนวณ wave แบบ deterministic จาก blocker และ touch set แล้วส่ง verifier สดใหม่
มาตรวจงานของ worker ก่อน integrate งานที่ผ่าน

### ใช้เมื่อไร

- มี ticket ที่ publish แล้วและต้องการวางแผนทั้งชุดก่อนเริ่มเขียนโค้ด
- ต้องการให้ ticket ที่ไม่มี blocker และแก้คนละ path ทำงานใน wave เดียวกัน
- ต้องการเห็น touch set, blocker, warning, backend และ concurrency cap ใน Plan
- ต้องการให้ผู้ใช้อนุมัติ Plan ก่อนเปลี่ยนไฟล์นอก feature directory

เรียก `/implement-tickets <dir|slug>` หรือ `$implement-tickets <dir|slug>`
โดยตรง การเรียกแบบ implicit ปิดไว้สำหรับ Claude Code และ Codex

### ติดตั้ง

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

### วิธีทำงานหลัก

1. อ่าน ticket และ planning context จาก feature directory
2. คำนวณ blocker, touch set, warnings และ waves ด้วย `scripts/waves.mjs`
3. แสดง Plan ราย ticket พร้อม wave, blocker, touch set, seam, matched agent และ
   retry budget พร้อม backend, concurrency cap และ warnings
4. หยุดรอ explicit approval โดยไม่มีไฟล์นอก feature directory เปลี่ยนก่อนอนุมัติ
5. หลัง approval จึง dispatch worker และ verifier ตาม wave แล้ว integrate งานที่ผ่าน

ค่าเริ่มต้นเป็น native harness subagents และ concurrency cap เท่ากับ 4
`--concurrency N` เปลี่ยน cap โดยไม่เปลี่ยน waves ส่วน `--serial` แยก ticket
ทุกใบเป็น wave ของตัวเอง Ticket ที่ไม่มี touch set จะได้ wave เดี่ยวและ warning
เมื่อ marker เป็น `status: not validated` Plan จะแสดง `parallel not yet validated`

### Seam และ Context

**Seam:** worker ใช้ `**Seam:**` ของ ticket แบบ verbatim เป็นขอบเขตที่ใช้ทดสอบ
**Context:** orchestrator สร้างรายการอ่านของ worker จาก `**Context:**`; plain path
และ `(from NN)` เป็น read-only ส่วน `(edit)`, `(new)` และ `(edit from NN)`
กำหนด touch set ที่ส่งให้ wave planner

## English / ภาษาอังกฤษ

### Purpose and use

`implement-tickets` turns a published ticket set into a read-only Plan followed
by test-first implementation with native harness subagents. It computes
deterministic waves from blocker and touch-set data, dispatches a fresh verifier
for each worker result, integrates verified work, and stops before review or a
pull request.

Invoke it explicitly with `/implement-tickets <dir|slug>` or
`$implement-tickets <dir|slug>`. Implicit invocation is disabled for Claude Code
and Codex. The Plan lists each ticket's wave, blockers, touch set, seam, matched
agent, and retry budget, along with the backend, concurrency cap, and warnings.
It pauses for explicit approval; no file outside the feature directory changes
until approval.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

The default backend is native harness subagents, with a concurrency cap of four.
`--concurrency N` changes the in-flight cap without changing wave placement;
`--serial` gives each ticket its own wave. Unknown touch sets get an exclusive
wave and a warning. When the marker says `status: not validated`, the Plan prints
`parallel not yet validated`.

### Seam and Context

**Seam:** The worker uses the ticket's `**Seam:**` verbatim as its test boundary.
**Context:** The orchestrator converts `**Context:**` into the worker's read list;
plain paths and `(from NN)` are read-only, while `(edit)`, `(new)`, and
`(edit from NN)` paths define the touch set passed to the wave planner.

### Canonical files

- [`SKILL.md`](../../../skills/agents/implement-tickets/SKILL.md) — invocation
  and workflow contract
- [`planning.md`](../../../skills/agents/implement-tickets/references/planning.md)
  — Stage 0 parsing, waves, and Plan rules
- [`parallel-validation.md`](../../../skills/agents/implement-tickets/references/parallel-validation.md)
  — the initial validation marker
- [`waves.mjs`](../../../skills/agents/implement-tickets/scripts/waves.mjs) —
  deterministic ticket wave planner
