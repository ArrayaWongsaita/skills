# implement-tickets

## ภาษาไทย / Thai

`implement-tickets` นำชุด ticket ที่ publish แล้วผ่านการวางแผน การ implement
การตรวจสอบ และการรวมงาน โดยให้ผู้ใช้ทบทวนแผนก่อนเริ่ม execute

### ใช้เมื่อไร

- มีชุด ticket ที่ต้องการวางแผนและทำงานเป็นลำดับ
- ต้องการให้มีการตรวจผลก่อนรวมงาน
- ต้องการทบทวนแผนก่อนเริ่ม implement

### การเรียกใช้งาน

เรียก skill โดยตรงด้วย:

```text
/implement-tickets <dir|slug>
$implement-tickets <dir|slug>
```

รายละเอียด invocation และตัวเลือกอยู่ใน [core skill contract](../../../skills/agents/implement-tickets/SKILL.md)

### ติดตั้ง

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

### วิธีทำงานหลัก

1. อ่าน ticket และเตรียมแผน
2. หยุดให้ผู้ใช้ทบทวนและอนุมัติแผน
3. หลังอนุมัติ ให้ worker ทำงานและ verifier ตรวจผลก่อน integration
4. ส่งต่อ integration branch และ review commands แล้วหยุดก่อน review, push หรือเปิด PR

การค้นหา adapter, lock fallback, แนวทางติดตั้ง และ worktree ownership อ้างอิง
[adapter contract](../../../skills/agents/implement-tickets/references/adapter-contract.md)
ส่วนกฎ touch set และ wave planning อ้างอิง
[planning reference](../../../skills/agents/implement-tickets/references/planning.md)
marker ของ parallel execution อยู่ใน
[parallel-validation reference](../../../skills/agents/implement-tickets/references/parallel-validation.md)

ตัวอ่าน manifest เปรียบเทียบ spec และชุด ticket. Plan แสดงคำเตือน spec-hash และคำเตือน ticket-set
ส่วนคอลัมน์ Budget แสดง Budget ของ ticket แต่ละใบ คำเตือนเป็นข้อมูลประกอบและไม่หยุดการวางแผน
[planning reference](../../../skills/agents/implement-tickets/references/planning.md) อธิบายวิธีแก้คำเตือน spec-hash.

### Dispatch, verifier และ timeout

หลัง approval ให้ทำตาม [dispatch contract](../../../skills/agents/implement-tickets/references/dispatch-contract.md),
[worker prompt scaffold](../../../skills/agents/implement-tickets/references/prompt-scaffold.md)
และ [verification contract](../../../skills/agents/implement-tickets/references/verification.md).

### Integration gate, status, and resume

รายละเอียด integration และ recovery อยู่ใน
[integration gate contract](../../../skills/agents/implement-tickets/references/integration-gate.md).
สำหรับ run state และคำสั่ง status/list/continue ให้ดู
[status and resume contract](../../../skills/agents/implement-tickets/references/status-and-resume.md).
ความหมายของ [`usage_total`](../../glossary.md) อยู่ใน glossary กลาง
ใช้ `/implement-tickets status [slug]`, `/implement-tickets list` หรือ
`/implement-tickets continue [slug]` เพื่อดูหรือ resume run

เมื่อ run สำเร็จ ให้ส่งต่อ integration branch และ review commands แล้วหยุดก่อน
review, push หรือเปิด PR

### โหมดการรันและ extras

ค่าเริ่มต้นคือโหมด serial (หนึ่ง ticket ต่อ wave) ใช้ `--parallel` เพื่อเปิด parallel
สถานะ marker ของการ validate อยู่ใน
[parallel-validation reference](../../../skills/agents/implement-tickets/references/parallel-validation.md)
ไฟล์ที่ worker แตะนอก touch set (extras) ยอมรับอัตโนมัติและรายงานให้ทราบ
ยกเว้นชน deny-list, เกิน cap หรือ conflict จริง ดู
[planning reference](../../../skills/agents/implement-tickets/references/planning.md)

ใช้ `--strict` (ตั้งครั้งเดียวต่อการรัน และไม่ขึ้นกับ option อื่น) เพื่อให้หยุดรอการอนุมัติ Plan
ก่อน dispatch worker หรือเขียน run state Plan ระบุ strictness ไว้ในบรรทัด `Strictness:` ถัดจาก
`Run mode:` และการเปลี่ยน strictness ไม่ถือเป็นการเปลี่ยน wave
จนกว่าจะเปลี่ยนค่าเริ่มต้น การรันที่ไม่มี flag ยังเป็น strict ส่วนพฤติกรรมของ default strictness ใช้เมื่อไม่มี `--strict`
run record เก็บ strictness และคอลัมน์ Risk กับ Verifier ของแต่ละ ticket (`Verifier: skipped` คือ ticket ที่ข้าม verifier)
`continue` resume ตาม strictness ที่บันทึกไว้ ส่วน `continue --strict` เปลี่ยนเป็น strict และขออนุมัติ Plan ใหม่ และ handoff ระบุเลข ticket ที่ข้าม verifier
หลังเปลี่ยนค่าเริ่มต้นแล้ว Planning error หยุดการรันทั้งสองค่า และ strict ไม่เพิ่มการถาม extras,
warning pause หรือลด retry budget
และ [ADR 0021](../../decisions/0021-touch-set-drift-without-reapproval.md)

### Seam และ Context

การใช้ฟิลด์ Seam และ Context อ้างอิง
[planning reference](../../../skills/agents/implement-tickets/references/planning.md)

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

See the [core skill contract](../../../skills/agents/implement-tickets/SKILL.md)
for invocation details and available options.

Install the core skill with:

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

Adapter lookup, lock fallback, install guidance, and worktree ownership are covered by the
[adapter contract](../../../skills/agents/implement-tickets/references/adapter-contract.md).
Touch-set and wave planning are covered by the
[planning reference](../../../skills/agents/implement-tickets/references/planning.md).
The parallel-validation marker is covered by the
[parallel-validation reference](../../../skills/agents/implement-tickets/references/parallel-validation.md).

The manifest reader compares the spec and ticket set. The Plan reports a spec-hash
warning and a ticket-set warning. The Budget column shows each ticket's Budget;
warnings are advisory and do not stop planning. The [planning reference](../../../skills/agents/implement-tickets/references/planning.md)
explains how to clear the spec-hash warning.

### Main workflow

1. Read the tickets and prepare a plan.
2. Pause for the user to review and approve the plan.
3. After approval, workers implement and a verifier checks the results before integration.
4. Hand off the integration branch and review commands, then stop before review, push, or a pull request.

### Dispatch and verification

After approval, follow the [dispatch contract](../../../skills/agents/implement-tickets/references/dispatch-contract.md),
[worker prompt scaffold](../../../skills/agents/implement-tickets/references/prompt-scaffold.md),
and [verification contract](../../../skills/agents/implement-tickets/references/verification.md).

### Run status, integration, and resume

The [integration gate contract](../../../skills/agents/implement-tickets/references/integration-gate.md)
covers integration and recovery. The [status and resume contract](../../../skills/agents/implement-tickets/references/status-and-resume.md)
covers saved runs and status, list, and continue. See the shared glossary entry
for [`usage_total`](../../glossary.md) semantics.
Run `/implement-tickets continue [slug]` to resume a saved run.

After a successful run, hand off the integration branch and review commands,
then stop before review, push, or opening a pull request.

### Run modes and extras

Serial mode (one ticket per wave) is the default. Pass `--parallel` to opt in to
parallel mode. The validation marker is described in the
[parallel-validation reference](../../../skills/agents/implement-tickets/references/parallel-validation.md).

Pass `--strict` (set once per run, independent of the other options) to pause for Plan
approval before any worker is dispatched or any run state is written. The Plan names
the strictness on a `Strictness:` line next to `Run mode:`, and a change of strictness
is not a change of waves. Until the default is flipped a run with no flag stays strict;
default-strictness behavior applies without `--strict` once the default has been flipped.
The run record stores the strictness and each ticket's Risk and Verifier columns
(`Verifier: skipped` marks a ticket judged on evidence alone). `continue` resumes in
the recorded strictness, `continue --strict` makes the run strict and asks for
approval again, and the handoff lists the tickets that skipped the verifier.
Planning errors stop the run in both strictness values, and strict adds no extras
approval, warning pause, or smaller retry budget.

Files a worker touches beyond its touch set (extras) are accepted automatically
and reported, unless they hit the deny-list, the per-ticket cap, or a real
conflict. See the
[planning reference](../../../skills/agents/implement-tickets/references/planning.md)
and [ADR 0021](../../decisions/0021-touch-set-drift-without-reapproval.md).

### Seam and Context

See the [planning reference](../../../skills/agents/implement-tickets/references/planning.md)
for the ticket's Seam and Context fields.

### Canonical files

- [`SKILL.md`](../../../skills/agents/implement-tickets/SKILL.md) — invocation and workflow contract
- [`planning.md`](../../../skills/agents/implement-tickets/references/planning.md) — ticket parsing, waves, and Plan rules
- [`parallel-validation.md`](../../../skills/agents/implement-tickets/references/parallel-validation.md) — validation marker
- [`dispatch-contract.md`](../../../skills/agents/implement-tickets/references/dispatch-contract.md) — worker scheduling, shared cap, and infrastructure retries
- [`prompt-scaffold.md`](../../../skills/agents/implement-tickets/references/prompt-scaffold.md) — worker prompt and integration sync step
- [`verification.md`](../../../skills/agents/implement-tickets/references/verification.md) — verifier evidence, fallback, and timeout contract
- [`integration-gate.md`](../../../skills/agents/implement-tickets/references/integration-gate.md) — ticket-order integration, full-suite gate, and recovery
- [`status-and-resume.md`](../../../skills/agents/implement-tickets/references/status-and-resume.md) — status, list, and resume behavior
- [`waves.mjs`](../../../skills/agents/implement-tickets/scripts/waves.mjs) — deterministic wave planner
- [`adapter-contract.md`](../../../skills/agents/implement-tickets/references/adapter-contract.md) — adapter input, outcomes, envelope, and worktree rules
