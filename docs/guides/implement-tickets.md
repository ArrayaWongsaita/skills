# คู่มือการติดตั้งและใช้งาน Skill: implement-tickets

- **หมวดหมู่ (Category):** `agents`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/implement-tickets/SKILL.md`](../../skills/agents/implement-tickets/SKILL.md)

## ภาษาไทย / Thai

### implement-tickets คืออะไร?

`implement-tickets` ช่วยนำชุด ticket ที่ publish แล้วไปสู่แผนงาน การ implement
และการตรวจสอบก่อนรวมงาน โดยมีจุดส่งต่อให้ผู้ใช้ทบทวนก่อนเริ่ม execute

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
2. **Pause:** ให้ผู้ใช้ทบทวนและอนุมัติแผน
3. **Execute:** ทำงานและตรวจผลก่อนรวมงาน
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

หลังอนุมัติ ให้อ้างอิง [dispatch contract](../../skills/agents/implement-tickets/references/dispatch-contract.md),
[worker prompt scaffold](../../skills/agents/implement-tickets/references/prompt-scaffold.md)
และ [verification contract](../../skills/agents/implement-tickets/references/verification.md).

### Planning and validation

กฎของ touch set และการวาง wave อยู่ใน [planning reference](../../skills/agents/implement-tickets/references/planning.md).
marker ของ parallel execution อยู่ใน
[parallel-validation reference](../../skills/agents/implement-tickets/references/parallel-validation.md).
ฟิลด์ Seam และ Context ของ ticket อ้างอิง planning reference เดียวกัน

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

After approval, follow the [dispatch contract](../../skills/agents/implement-tickets/references/dispatch-contract.md),
[worker prompt scaffold](../../skills/agents/implement-tickets/references/prompt-scaffold.md),
and [verification contract](../../skills/agents/implement-tickets/references/verification.md).

### Planning and validation

Touch-set and wave planning are covered by the
[planning reference](../../skills/agents/implement-tickets/references/planning.md).
The parallel-validation marker is covered by the
[parallel-validation reference](../../skills/agents/implement-tickets/references/parallel-validation.md).
See the planning reference for the ticket's Seam and Context fields.

### Seam and Context

See the [planning reference](../../skills/agents/implement-tickets/references/planning.md)
for the ticket's Seam and Context fields.
