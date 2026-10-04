# คู่มือการติดตั้งและใช้งาน Skill: implement-tickets

- **หมวดหมู่ (Category):** `agents`
- **ไฟล์นิยามหลัก (Definition):** [`skills/agents/implement-tickets/SKILL.md`](../../skills/agents/implement-tickets/SKILL.md)

## ภาษาไทย / Thai

`implement-tickets` นำชุด ticket ที่ publish แล้วไปสู่โค้ดที่ผ่านการตรวจ โดยทำทีละ ticket ตามเลข:
worker (native subagent) สร้างงานแบบ test-first ใน worktree แยก, verifier ใหม่ตรวจเฉพาะ ticket ที่เสี่ยง,
แล้ว squash-merge ลง `implement-tickets/<slug>` หลังผ่าน typecheck และ test suite เต็ม

### การเรียกใช้งาน

```text
/implement-tickets <dir|slug>
$implement-tickets <dir|slug>
/implement-tickets continue [slug]
```

ไม่มี option: ไม่มีโหมดขนาน, ไม่มี adapter และไม่มีการหยุดรออนุมัติ run พิมพ์ Plan แล้วเริ่มทำงาน
backend อื่นใช้ `agy-implement` หรือ `opencode-implement` ดู [ADR 0023](../decisions/0023-implement-tickets-minimal-core.md)

### ติดตั้ง

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

### ขั้นตอนหลัก

1. **Plan:** อ่าน ticket ตรวจด้วย `plan.mjs` แล้วพิมพ์ Plan ตาม [planning reference](../../skills/agents/implement-tickets/references/planning.md)
2. **Build ทีละ ticket:** [dispatch](../../skills/agents/implement-tickets/references/dispatch-contract.md) ด้วย [prompt scaffold](../../skills/agents/implement-tickets/references/prompt-scaffold.md)
   แล้ววัด extras และตัดสินใจเรื่อง verifier ตาม [verification](../../skills/agents/implement-tickets/references/verification.md)
3. **Integrate:** squash-merge และรัน gate ตาม [integration gate](../../skills/agents/implement-tickets/references/integration-gate.md)
4. **Cleanup:** ลบ worktree ตามด้วย Worker branch ของ ticket (รวมทุก attempt ก่อนหน้า) ทันทีหลัง gate เขียวและบันทึกแถวแล้ว ก่อนเริ่ม ticket ถัดไป ตาม [Cleanup](../../skills/agents/implement-tickets/references/integration-gate.md#cleanup)
   ไม่ลบ worktree ของ attempt ที่ gate ไม่ผ่าน, verifier หรือ extras ปฏิเสธ, merge conflict ที่ต้องส่งใหม่ และของ ticket ที่ BLOCKED; ถ้าลบไม่สำเร็จจะบันทึกใน `report.md` (Step `cleanup`) แล้วไปต่อ และ handoff จะระบุ worktree ที่เหลือ
5. **Handoff:** ส่งต่อ integration branch และ review commands แล้วหยุดก่อน review, push หรือเปิด PR

run state, `continue` และ `report.md` (บันทึกปัญหาระหว่าง run เพื่อนำไปปรับปรุง skill) อยู่ใน [status and resume](../../skills/agents/implement-tickets/references/status-and-resume.md)
extras คือไฟล์ที่ worker แตะนอก touch set: ถ้าเกณฑ์ยอมรับอธิบายไม่ได้ จะถูกปฏิเสธ นอกนั้นรับไว้ ทำให้ ticket เสี่ยง และแสดงใน handoff

### Seam และ Context

รายละเอียดฟิลด์ Seam และ Context อยู่ใน [planning reference](../../skills/agents/implement-tickets/references/planning.md)

## English / ภาษาอังกฤษ

`implement-tickets` takes a published ticket set to verified code, one ticket at a
time in ticket order: a worker (native subagent) builds the ticket test-first in
an isolated worktree, a fresh verifier checks only risky tickets, and the work is
squash-merged onto `implement-tickets/<slug>` behind a green full typecheck and
test suite.

### Invocation

```text
/implement-tickets <dir|slug>
$implement-tickets <dir|slug>
/implement-tickets continue [slug]
```

There are no options: no parallel mode, no adapters, and no approval pause. The
run prints the Plan and starts. For other backends use `agy-implement` or
`opencode-implement`; see [ADR 0023](../decisions/0023-implement-tickets-minimal-core.md).

### Install

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

### Main workflow

1. **Plan:** read the tickets, validate them with `plan.mjs`, and print the Plan per the [planning reference](../../skills/agents/implement-tickets/references/planning.md).
2. **Build each ticket:** [dispatch](../../skills/agents/implement-tickets/references/dispatch-contract.md) a worker with the [prompt scaffold](../../skills/agents/implement-tickets/references/prompt-scaffold.md), measure extras, and decide on a verifier per the [verification contract](../../skills/agents/implement-tickets/references/verification.md).
3. **Integrate:** squash-merge and run the gate per the [integration gate](../../skills/agents/implement-tickets/references/integration-gate.md).
4. **Cleanup:** after a green gate and a written row, remove the ticket's worktree, then the Worker branch (every earlier kept attempt too), before the next ticket starts, per [Cleanup](../../skills/agents/implement-tickets/references/integration-gate.md#cleanup).
   The worktree of an attempt that failed the gate, was rejected by the verifier or for extras, or was redispatched after a merge conflict is kept, as is every worktree of a BLOCKED ticket. A failed removal is noted in `report.md` (Step `cleanup`) and the run continues; the handoff names each leftover worktree.
5. **Handoff:** print the integration branch and review commands, then stop before review, push, or a pull request.

The run record, `continue`, and `report.md` (problems noted during the run, for improving the skill) are in [status and resume](../../skills/agents/implement-tickets/references/status-and-resume.md).
Extras are files a worker changed beyond its touch set: one the acceptance
criteria do not explain is rejected; otherwise it is accepted, makes the ticket
risky, and is listed in the handoff.

### Seam and Context

See the [planning reference](../../skills/agents/implement-tickets/references/planning.md) for the ticket's Seam and Context fields.
