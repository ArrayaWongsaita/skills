# implement-tickets

## ภาษาไทย / Thai

`implement-tickets` นำชุด ticket ที่ publish แล้วผ่านการวางแผน การ implement
การตรวจสอบ และการรวมงาน โดยพิมพ์ Plan ก่อนเริ่ม และให้ผู้ใช้ทบทวนก่อน execute เมื่อใช้ `--strict`

### ใช้เมื่อไร

- มีชุด ticket ที่ต้องการวางแผนและทำงานเป็นลำดับ
- ต้องการให้มีการตรวจผลก่อนรวมงาน (ทุก ticket ใน strict run หรือเฉพาะ ticket ที่เสี่ยง)
- ต้องการทบทวนแผนก่อนเริ่ม implement (ใช้ `--strict`)

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
2. ถ้าใช้ `--strict` ให้หยุดให้ผู้ใช้ทบทวนและอนุมัติแผน (ค่าเริ่มต้นพิมพ์ Plan แล้วเริ่มเลย)
3. worker ทำงาน และ verifier ตรวจผลก่อน integration ทุก ticket ใน strict run หรือเฉพาะ ticket ที่เสี่ยงในค่าเริ่มต้น
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

เมื่อเริ่ม execute (หลัง approval ใน strict run) ให้ทำตาม [dispatch contract](../../../skills/agents/implement-tickets/references/dispatch-contract.md),
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
ก่อน dispatch worker Plan ระบุ strictness ในบรรทัด `Strictness:` ถัดจาก `Run mode:`
การรันที่ไม่มี flag อยู่ใน default strictness: พิมพ์ Plan แล้วเริ่มทำงานโดยไม่หยุดรออนุมัติ และใช้ verifier เฉพาะ ticket ที่เสี่ยง
กติกา risk signal ดู [verification reference](../../../skills/agents/implement-tickets/references/verification.md#risk-based-verification)
ส่วน `Verifier: skipped`, `continue` และ `continue --strict` ดู [status-and-resume reference](../../../skills/agents/implement-tickets/references/status-and-resume.md)
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
2. With `--strict`, pause for the user to review and approve the plan; by default the plan is printed and the run starts.
3. Workers implement, and a verifier checks the results before integration for every ticket in a strict run or for risky tickets only by default.
4. Hand off the integration branch and review commands, then stop before review, push, or a pull request.

### Dispatch and verification

Once execution starts (after approval in a strict run), follow the [dispatch contract](../../../skills/agents/implement-tickets/references/dispatch-contract.md),
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
approval before any worker is dispatched. The Plan names the strictness on a `Strictness:`
line next to `Run mode:`. A run with no flag is in default strictness: it prints the Plan,
starts without waiting for approval, and verifies only risky tickets.
The risk signals are defined in the [verification reference](../../../skills/agents/implement-tickets/references/verification.md#risk-based-verification);
`Verifier: skipped`, `continue`, and `continue --strict` are defined in the
[status-and-resume reference](../../../skills/agents/implement-tickets/references/status-and-resume.md).

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
