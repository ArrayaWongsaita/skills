# Design Task Spec

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/design-task-spec/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

เปลี่ยนคำขอพัฒนา Software ที่ยังคลุมเครือให้เป็น Task Specification ที่พร้อมส่งต่อให้ Implementation Agent โดยตรวจข้อเท็จจริงจาก Repository, ปิด Decision Tree ร่วมกับผู้ใช้ และบันทึก Scope, Architecture, Contracts, Failure Behavior, Delivery Plan และ Acceptance Criteria อย่างชัดเจน

Skill นี้สร้างเอกสารสำหรับการตัดสินใจและส่งมอบงานเท่านั้น ไม่ลงมือแก้ Implementation Code ตาม Task ที่ออกแบบ

### ควรใช้เมื่อไร

- เปลี่ยนไอเดียหรือ Ticket ให้เป็น Implementation Task ที่ตัดสินใจครบ
- ออกแบบ Feature, Bug Fix, Refactor, Migration, Integration หรือ Infrastructure Change
- ตรวจ Requirement และ Architecture ก่อนส่งต่อให้ Agent อื่นลงมือทำ
- บันทึก Facts, Decisions, Assumptions, Blockers และทางเลือกที่ไม่เลือก
- ต้องการ Acceptance Criteria และ Verification Plan ที่อ้างอิงพฤติกรรมที่สังเกตได้

### ไม่ควรใช้เมื่อไร

ไม่ควรใช้เมื่อผู้ใช้ต้องการให้ลงมือ Implement ทันที, ต้องการ Code Review อย่างเดียว หรือมี Specification ที่พร้อมทำงานอยู่แล้วและไม่มี Decision สำคัญค้างอยู่ Skill จะหยุดที่สถานะ `ready-for-implementation` หลังผู้ใช้ยืนยัน Shared Understanding และจะไม่เริ่มแก้ Code ต่อเอง

### วิธีทำงานหลัก

1. โหลด `grilling` และ `domain-modeling` ตามกลไกของ Agent Host
2. ตรวจ Repository, เอกสาร, Domain Language, Contracts, Tests และสถานะปัจจุบันก่อนถามคำถาม
3. สร้าง Task Document สถานะ `draft` และใช้เอกสารนี้เป็น Source of Truth
4. เลือก Coverage Modules ที่เกี่ยวข้องและถามเฉพาะ Decision Frontier ที่ยังแก้ไม่ได้จากหลักฐาน
5. แยก Facts, Decisions, Assumptions, Blockers และหัวข้อที่เป็น `N/A` อย่างชัดเจน
6. เปลี่ยนสถานะเป็น `ready-for-implementation` เมื่อ Coverage ครบ ไม่มี Critical Blocker และผู้ใช้ยืนยันสรุปแล้วเท่านั้น

### ตัวอย่าง prompt

```text
ใช้ $design-task-spec ตรวจ Repository และออกแบบ Task สำหรับเพิ่ม Idempotency ให้ Order API ปิด Decision ที่เกี่ยวข้องกับ Duplicate Request, Persistence, Retry, Migration, Observability และ Rollback โดยยังไม่แก้ Implementation Code
```

### ติดตั้ง

```bash
npx skills add ArrayaWongsaita/skills --skill design-task-spec
```

### ไฟล์ที่เกี่ยวข้อง

- `SKILL.md` — Workflow, status control และ handoff boundary
- `references/task-spec-template.md` — Template ของ Implementation Task Specification
- `references/coverage-modules.md` — Coverage checklist แยกตาม Task Type และ Cross-cutting Concerns
- `agents/openai.yaml` — Metadata และ explicit-only invocation policy

## English / ภาษาอังกฤษ

### Purpose

Turns an ambiguous software request into a decision-complete task specification that an implementation agent can execute without making product or architecture decisions. It investigates repository facts and records scope, architecture, contracts, failure behavior, delivery, verification, and acceptance criteria.

The skill produces the design and handoff document only. It does not implement the task it specifies.

### Use it when

- Turning an idea or ticket into an implementation-ready task
- Designing a feature, bug fix, refactor, migration, integration, or infrastructure change
- Stress-testing requirements and architecture before implementation handoff
- Recording facts, decisions, assumptions, blockers, and rejected alternatives
- Defining evidence-backed acceptance criteria and a verification plan

### Do not use it when

Do not use it when the user wants immediate implementation, only a code review, or already has a decision-complete specification with no material open questions. The skill stops at `ready-for-implementation` after the user confirms the shared understanding; it never proceeds into implementation itself.

### Main workflow

1. Load `grilling` and `domain-modeling` through the host's skill mechanism.
2. Inspect repository evidence, documentation, domain language, contracts, tests, and current state before asking questions.
3. Create a `draft` task document and use it as the source of truth.
4. Select applicable coverage modules and ask only the unresolved decision frontier.
5. Keep facts, decisions, assumptions, blockers, and justified `N/A` items distinct.
6. Move to `ready-for-implementation` only when coverage is complete, no critical blocker remains, and the user confirms the final shared understanding.

### Example prompt

```text
Use $design-task-spec to inspect this repository and design an implementation task for adding idempotency to the Order API. Close decisions about duplicate requests, persistence, retries, migration, observability, and rollback without editing implementation code.
```

### Install

```bash
npx skills add ArrayaWongsaita/skills --skill design-task-spec
```

### Related files

- `SKILL.md` — workflow, status control, and handoff boundary
- `references/task-spec-template.md` — implementation-task specification template
- `references/coverage-modules.md` — task-type and cross-cutting coverage checklist
- `agents/openai.yaml` — UI metadata and explicit-only invocation policy
