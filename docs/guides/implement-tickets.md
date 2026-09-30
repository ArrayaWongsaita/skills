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

### Integration gate, status, and resume

หลัง ticket ทุกใบใน wave ผ่าน verifier แล้ว จะ squash-merge ตามลำดับ ticket
เป็นหนึ่ง commit ต่อ ticket จากนั้นรัน full typecheck และ suite บน integration
branch หาก gate ไม่ผ่าน ระบบตรวจแต่ละ merge เพื่อหาต้นเหตุ ย้อน branch ไปยัง
commit ล่าสุดที่ยังผ่านด้วย branch checkout แล้วเก็บ ticket ที่ verify แล้ว
หลังต้นเหตุไว้ก่อนส่งต้นเหตุให้ลองใหม่แบบ serial

หนึ่ง run บันทึกใน `.scratch/<feature-slug>/status.md` โดยบรรทัดแรกต้องเป็น
`skill: implement-tickets` พร้อมตารางสถานะของทุก ticket และ usage ที่รายงาน
โดย `usage_total` อาจรวม cache และจะเป็น `unknown` เมื่อไม่มีรายงาน
`/implement-tickets status [slug]` และ `/implement-tickets list` อ่านอย่างเดียว
ส่วน `/implement-tickets continue [slug]` ตรวจสถานะกับ Git แสดง Plan อีกครั้ง
และทำต่อจาก frontier

### Dispatch, verifier และ timeout

หลัง approval orchestrator dispatch worker หนึ่งตัวต่อ ticket ใน wave และทุก
worker prompt เริ่มด้วย sync step: checkout worker branch ที่ integration SHA
แล้ว assert ว่า `HEAD` เท่ากับ SHA นั้น ถ้าไม่ตรงให้รายงาน `failed_infra`
โดยไม่ใช้ ticket attempt

ค่าเริ่มต้น concurrency cap คือ 4 และ `--concurrency N` ใช้แทนได้ cap นับ worker
และ verifier ที่ทำงานอยู่รวมกัน Verifier มี priority ก่อน worker ใหม่ และเมื่อ
worker ตัวใดคืนผลให้ dispatch fresh native verifier ทันทีโดยไม่รอ worker ตัวอื่น
ใน wave verifier เริ่มด้วย `Explore`; ถ้ารายงานตื้นเกินตัดสิน orchestrator ใช้
verifier ใหม่แบบ `general-purpose` ที่อ่านอย่างเดียว Verifier ส่ง raw evidence
โดยไม่ให้ verdict แล้ว orchestrator เป็นผู้ตัดสิน

Worker และ verifier ทำงาน background โดย orchestrator ตั้ง background wait
แยกต่อ dispatch: worker 2700 วินาที (45 นาที) และ verifier 900 วินาที (15 นาที)
ถ้า wait จบก่อน ให้ `TaskStop` subagent และบันทึก `failed_infra` โดยไม่คิดเป็น
attempt การ crash หรือ subagent หายก็เป็น infrastructure failure เช่นกัน
อนุญาต infra retries สองครั้ง แล้ว ticket จะเป็น
`BLOCKED (TICKET_PROVIDER_FAILED)` หาก spawn แจ้ง `Concurrent subagent limit reached`
ให้รอ slot ว่างแล้ว retry โดยไม่หัก infra retry

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

The orchestrator dispatches one background worker per ticket. Every worker
prompt begins with a sync step that checks out the worker branch at the
integration SHA and asserts that `HEAD` equals it; a mismatch is `failed_infra`
and does not count as a ticket attempt. The concurrency cap covers workers and
verifiers together, and verifiers are started before new workers. As soon as a
worker returns, dispatch a fresh native verifier without waiting for the rest
of its wave. Start with `Explore`; if that report is too shallow to judge, use
a fresh read-only `general-purpose` verifier. The verifier returns raw evidence
and no verdict for the orchestrator to judge.

Workers and verifiers run in the background, with one background wait per
dispatch: 2700 seconds for a worker and 900 seconds for a verifier. If its wait
ends first, stop the subagent with `TaskStop` and record `failed_infra` without
counting an attempt. A crash or lost subagent is also an infrastructure failure.
After two infra retries, the ticket is `BLOCKED (TICKET_PROVIDER_FAILED)`. When
spawn reports `Concurrent subagent limit reached`, wait for a free slot and
retry without using an infra retry.

### Integration gate, status, and resume

After every ticket in a wave passes verification, squash-merge the verified
branches in ticket order as one commit per ticket, then run the full project
typecheck and suite on the integration branch. If the gate fails, test each
replayed merge to find the first failing ticket, rewind with a branch checkout,
keep later verified tickets without re-verifying them, and retry the culprit
alone as one serial attempt.

Store each run in `.scratch/<feature-slug>/status.md`; its first line is
`skill: implement-tickets`. The per-ticket table includes wave, backend, touch
set, status, session ID, attempts, branch, commit, budget estimate,
`usage_total`, and `verifier_usage_total`. Sum reported worker usage across
each dispatch and resume on the delivering path; it may be cache-inclusive, or
is `unknown` when none was reported. `/implement-tickets status [slug]` and
`/implement-tickets list` only read state and change nothing.

`/implement-tickets continue [slug]` refuses old status files without the
identity line, reconciles valid state against Git, rewinds on drift, presents
the Plan again, and resumes from the frontier. After three failed
verifications, mark the ticket `BLOCKED (TICKET_VERIFICATION_FAILED)`, hold its
dependants, and report independent tickets as an available partial path with
the resume command. When every ticket is integrated and the final suite is
green, print the integration branch and review commands as a handoff; do not
run review, push, or open a pull request.

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
