# คู่มือการติดตั้งและใช้งาน Skill: implement-tickets

- **หมวดหมู่ (Category):** `agents`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/implement-tickets/SKILL.md`](../../skills/agents/implement-tickets/SKILL.md)

## ภาษาไทย / Thai

### implement-tickets คืออะไร?

`implement-tickets` ช่วยนำชุด ticket ที่ publish แล้วไปสู่แผนงาน การ implement
และการตรวจสอบก่อนรวมงาน โดยมีจุดหยุดให้ผู้ใช้ทบทวนก่อนเริ่ม execute เมื่อใช้ `--strict`

### การเรียกใช้งาน

เรียก skill โดยตรงด้วย slash command หรือ Codex command:

```text
/implement-tickets <dir|slug>
$implement-tickets <dir|slug>
```

รายละเอียด invocation และตัวเลือกอยู่ใน [core skill contract](../../skills/agents/implement-tickets/SKILL.md)

### ติดตั้ง

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

การค้นหา adapter, lock fallback, แนวทางติดตั้ง และ worktree ownership อยู่ใน
[adapter contract](../../skills/agents/implement-tickets/references/adapter-contract.md)

### ขั้นตอนหลัก

1. **Plan:** อ่าน ticket และเตรียมแผนสำหรับชุดงาน
2. **Pause:** ให้ผู้ใช้ทบทวนและอนุมัติแผนเมื่อรันแบบ `--strict` (ค่าเริ่มต้นไม่หยุดรอ)
3. **Execute:** ทำงาน และตรวจผลด้วย verifier ทุก ticket ใน strict run หรือเฉพาะ ticket ที่เสี่ยงในค่าเริ่มต้น ก่อนรวมงาน
4. **Handoff:** ส่งต่อ integration branch และ review commands แล้วหยุดก่อน review, push หรือเปิด PR

### Integration gate, status, and resume

การ integrate และ recovery อ้างอิง
[integration gate contract](../../skills/agents/implement-tickets/references/integration-gate.md)
ส่วน run state และการ resume อ้างอิง
[status and resume contract](../../skills/agents/implement-tickets/references/status-and-resume.md).
ความหมายของ [`usage_total`](../glossary.md) อยู่ใน glossary กลาง ใช้
`/implement-tickets status [slug]`, `/implement-tickets list` หรือ
`/implement-tickets continue [slug]` เพื่อดูหรือ resume run

### Dispatch, verifier และ timeout

เมื่อเริ่ม execute (หลังอนุมัติใน strict run) ให้อ้างอิง [dispatch contract](../../skills/agents/implement-tickets/references/dispatch-contract.md),
[worker prompt scaffold](../../skills/agents/implement-tickets/references/prompt-scaffold.md)
และ [verification contract](../../skills/agents/implement-tickets/references/verification.md).

### Planning and validation

กฎของ touch set และการวาง wave อยู่ใน [planning reference](../../skills/agents/implement-tickets/references/planning.md).
marker ของ parallel execution อยู่ใน
[parallel-validation reference](../../skills/agents/implement-tickets/references/parallel-validation.md).
ฟิลด์ Seam และ Context ของ ticket อ้างอิง planning reference เดียวกัน

### โหมดการรันและ extras

ค่าเริ่มต้นคือโหมด serial (หนึ่ง ticket ต่อ wave) ใช้ `--parallel` เพื่อเปิด parallel
สถานะ marker ของการ validate อยู่ใน
[parallel-validation reference](../../skills/agents/implement-tickets/references/parallel-validation.md)
ไฟล์ที่ worker แตะนอก touch set (extras) ยอมรับอัตโนมัติและรายงานให้ทราบ
ยกเว้นชน deny-list, เกิน cap หรือ conflict จริง ดู
[planning reference](../../skills/agents/implement-tickets/references/planning.md)

ใช้ `--strict` (ตั้งครั้งเดียวต่อการรัน และไม่ขึ้นกับ option อื่น) เพื่อให้หยุดรอการอนุมัติ Plan
ก่อน dispatch worker Plan ระบุ strictness ในบรรทัด `Strictness:` ถัดจาก `Run mode:`
การรันที่ไม่มี flag อยู่ใน default strictness: พิมพ์ Plan แล้วเริ่มทำงานโดยไม่หยุดรออนุมัติ และใช้ verifier เฉพาะ ticket ที่เสี่ยง
กติกา risk signal ดู [verification reference](../../skills/agents/implement-tickets/references/verification.md#risk-based-verification)
ส่วน `Verifier: skipped`, `continue` และ `continue --strict` ดู [status-and-resume reference](../../skills/agents/implement-tickets/references/status-and-resume.md)
และ [ADR 0021](../decisions/0021-touch-set-drift-without-reapproval.md)

ตัวอ่าน manifest เปรียบเทียบ spec และชุด ticket. Plan แสดงคำเตือน spec-hash และคำเตือน ticket-set
ส่วนคอลัมน์ Budget แสดง Budget ของ ticket แต่ละใบ คำเตือนเป็นข้อมูลประกอบและไม่หยุดการวางแผน
[planning reference](../../skills/agents/implement-tickets/references/planning.md) อธิบายวิธีแก้คำเตือน spec-hash.

### Seam และ Context

รายละเอียดฟิลด์ Seam และ Context อยู่ใน
[planning reference](../../skills/agents/implement-tickets/references/planning.md)

## English / ภาษาอังกฤษ

### Purpose and use

`implement-tickets` takes a published ticket set through planning,
implementation, verification, and integration, with a user review point before
execution.

Invoke the skill directly with either command:

```text
/implement-tickets <dir|slug>
$implement-tickets <dir|slug>
```

See the [core skill contract](../../skills/agents/implement-tickets/SKILL.md)
for invocation details and available options.

Install the core skill with:

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

Adapter lookup, lock fallback, install guidance, and worktree ownership are covered by the
[adapter contract](../../skills/agents/implement-tickets/references/adapter-contract.md).

### Main workflow

1. **Plan:** read the tickets and prepare a plan.
2. **Pause:** let the user review and approve the plan.
3. **Execute:** implement the work and verify the results before integration.
4. **Handoff:** provide the integration branch and review commands, then stop before review, push, or a pull request.

### Run status, integration, and resume

Use the [integration gate contract](../../skills/agents/implement-tickets/references/integration-gate.md)
for integration and recovery, and the [status and resume contract](../../skills/agents/implement-tickets/references/status-and-resume.md)
for saved runs. See the shared glossary entry for
[`usage_total`](../glossary.md). Use `/implement-tickets status [slug]`, `/implement-tickets list`, or
`/implement-tickets continue [slug]` to inspect or resume a run.

### Dispatch and verification

Once execution starts (after approval in a strict run), follow the [dispatch contract](../../skills/agents/implement-tickets/references/dispatch-contract.md),
[worker prompt scaffold](../../skills/agents/implement-tickets/references/prompt-scaffold.md),
and [verification contract](../../skills/agents/implement-tickets/references/verification.md).

### Planning and validation

Touch-set and wave planning are covered by the
[planning reference](../../skills/agents/implement-tickets/references/planning.md).
The parallel-validation marker is covered by the
[parallel-validation reference](../../skills/agents/implement-tickets/references/parallel-validation.md).
See the planning reference for the ticket's Seam and Context fields.

### Run modes and extras

Serial mode (one ticket per wave) is the default. Pass `--parallel` to opt in to
parallel mode. The validation marker is described in the
[parallel-validation reference](../../skills/agents/implement-tickets/references/parallel-validation.md).

Pass `--strict` (set once per run, independent of the other options) to pause for Plan
approval before any worker is dispatched. The Plan names the strictness on a `Strictness:`
line next to `Run mode:`. A run with no flag is in default strictness: it prints the Plan,
starts without waiting for approval, and verifies only risky tickets.
The risk signals are defined in the [verification reference](../../skills/agents/implement-tickets/references/verification.md#risk-based-verification);
`Verifier: skipped`, `continue`, and `continue --strict` are defined in the
[status-and-resume reference](../../skills/agents/implement-tickets/references/status-and-resume.md).

Files a worker touches beyond its touch set (extras) are accepted automatically
and reported, unless they hit the deny-list, the per-ticket cap, or a real
conflict. See the
[planning reference](../../skills/agents/implement-tickets/references/planning.md)
and [ADR 0021](../decisions/0021-touch-set-drift-without-reapproval.md).

The manifest reader compares the spec and ticket set. The Plan reports a spec-hash
warning and a ticket-set warning. The Budget column shows each ticket's Budget;
warnings are advisory and do not stop planning. The [planning reference](../../skills/agents/implement-tickets/references/planning.md)
explains how to clear the spec-hash warning.

### Seam and Context

See the [planning reference](../../skills/agents/implement-tickets/references/planning.md)
for the ticket's Seam and Context fields.
