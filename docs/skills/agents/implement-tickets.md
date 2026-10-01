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

ตัวอ่าน manifest (manifest reader) ใช้ตรวจว่าข้อมูลใน manifest ยังตรงกับ spec และชุด ticket ปัจจุบันหรือไม่
ถ้า spec เปลี่ยนหลังตรวจ ticket Plan จะแสดง spec-hash warning พร้อมวิธีแก้: รัน ticket checker ด้วย
`--write-budget` เพื่อเขียน manifest ใหม่ ถ้าชุด ticket ปัจจุบันต่างจากที่บันทึกไว้ Plan จะแสดง
ticket-set warning ด้วย คำเตือนเหล่านี้มีไว้ให้ทบทวนและไม่หยุดการวางแผน คอลัมน์ Budget ใน Plan
แสดง Budget ของ ticket แต่ละใบ

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

The manifest reader checks whether the manifest still matches the spec and current ticket set.
If the spec changed after the tickets were checked, the Plan shows the spec-hash warning and its cure:
rerun the ticket checker with `--write-budget` to write a fresh manifest. If the current tickets differ
from the recorded set, the Plan shows a ticket-set warning. These warnings are advisory and do not stop
planning. The Budget column shows each ticket's Budget value in the Plan.

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
