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

### Dispatch, verifier และ timeout

หลัง approval orchestrator dispatch worker หนึ่งตัวต่อ ticket ใน wave prompt
ของ worker ทุกใบเริ่มด้วย sync step เพื่อ checkout worker branch ที่ integration
SHA และ assert ว่า `HEAD` เท่ากับ SHA นั้น หากไม่ตรงให้คืน `failed_infra` โดยไม่
นับ ticket attempt

Concurrency cap เริ่มต้นเป็น 4; `--concurrency N` เปลี่ยนค่าได้ cap นับ worker และ
verifier รวมกัน โดยเริ่ม verifier ก่อน worker ใหม่ เมื่อ worker คืนผลให้ dispatch
fresh native verifier ทันที ไม่รอ worker ที่เหลือใน wave เริ่มจาก `Explore`; ถ้า
รายงานยังตื้นเกินตัดสิน ให้ orchestrator dispatch `general-purpose` ตัวใหม่แบบ
read-only Verifier ส่ง raw evidence โดยไม่ให้ verdict

Worker และ verifier ทำงาน background โดยมี background wait หนึ่งชุดต่อ dispatch:
worker 2700 วินาที และ verifier 900 วินาที ถ้า wait จบก่อนให้หยุด subagent ด้วย
`TaskStop` และบันทึก `failed_infra` โดยไม่คิด attempt การ crash หรือ subagent ที่
หายไปจัดเป็น infrastructure failure ด้วย หลัง infra retries สองครั้ง ticket เป็น
`BLOCKED (TICKET_PROVIDER_FAILED)`; เมื่อ spawn แจ้ง
`Concurrent subagent limit reached` ให้รอ slot ว่างแล้วลอง spawn ใหม่โดยไม่คิด
infra retry

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

After approval, the orchestrator dispatches one background worker per ticket.
Every worker prompt starts with a sync step: check out the worker branch at the
integration SHA and assert that `HEAD` equals it. A mismatch returns
`failed_infra` without counting a ticket attempt. The concurrency cap counts
workers and verifiers together, with verifiers starting before new workers. As
soon as a worker returns, dispatch a fresh native verifier without waiting for
the rest of the wave. Start it as `Explore`; when its report is too shallow to
judge, dispatch a fresh read-only `general-purpose` verifier. The verifier
returns raw evidence and no verdict for the orchestrator to judge.

Workers and verifiers run in the background. Arm one background wait per
dispatch: 2700 seconds for a worker and 900 seconds for a verifier. If a wait
ends first, stop the subagent with `TaskStop` and record `failed_infra` without
counting an attempt. A crash or lost subagent is also an infrastructure failure.
After two infra retries, mark the ticket `BLOCKED (TICKET_PROVIDER_FAILED)`. If
spawn reports `Concurrent subagent limit reached`, wait for a free slot and
retry without using an infra retry.

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
- [`dispatch-contract.md`](../../../skills/agents/implement-tickets/references/dispatch-contract.md)
  — worker scheduling, shared concurrency cap, and infrastructure retries
- [`prompt-scaffold.md`](../../../skills/agents/implement-tickets/references/prompt-scaffold.md)
  — the worker prompt and required integration sync step
- [`verification.md`](../../../skills/agents/implement-tickets/references/verification.md)
  — verifier dispatch, evidence, and timeout contract
- [`waves.mjs`](../../../skills/agents/implement-tickets/scripts/waves.mjs) —
  deterministic ticket wave planner
