# Engineering Workflow

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/engineering-workflow/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

เป็น pure-prompt control plane เดียวสำหรับจำแนก route, บันทึก workflow state ผ่าน markdown artifacts, บังคับ quality gates, ตรวจ artifact/Git ตอน resume และตัดสิน `COMPLETE` หรือ `BLOCKED` โดยทำงานแบบ zero-script (ไม่ต้องพึ่งพา Python) และใช้ engineering skills ที่ติดตั้งจริงเป็น specialist source of truth

ติดตั้งด้วยคำสั่งนี้เมื่อ repository ยังไม่มี orchestrator:

```bash
npx skills add ArrayaWongsaita/skills --skill engineering-workflow
```

### ควรใช้เมื่อไร

- ต้องการ route งาน feature, bug/incident หรือ large project แบบเป็นระบบ
- ต้องการบังคับให้ Agent ทำงานเป็นขั้นเป็นตอน (Discovery -> Spec -> Tickets -> Implementation -> Review) ไม่ข้าม Flow
- ต้องการ bounded design/code/system review และ resume ข้าม session ได้บนทุกเครื่อง

### ไม่ควรใช้เมื่อไร

ไม่ใช้กับ discipline เดี่ยวหรือคำถามอ่านอย่างเดียว ให้เรียก external skill ที่ติดตั้งอยู่โดยตรง เช่น `/to-spec`, `/tdd`, `/prototype` หรือ `/scrutinize`

### วิธีทำงานหลัก

เรียก `/engineering-workflow <request>`, `$engineering-workflow <request>`, หรือสั่งเป็นภาษาธรรมชาติ `"run engineering workflow for <request>"` รองรับทุก AI Agent (Antigravity, Cursor, Roo Code, Aider, Claude Code, Codex) 

ระบบจะ:
1. บังคับให้ Agent พิมพ์ **Mandatory State Anchor Header** ทุกครั้งเพื่อตรึงสมาธิ
2. บันทึกและอัปเดต State ผ่านไฟล์ Markdown (`.scratch/<feature-slug>/status.md`)
3. ใช้ **Adaptive Gating**: สั่ง Read-Only Mode ในช่วง Discovery/Plan และหยุดขออนุมัติจากผู้ใช้ก่อนเริ่มแตะต้องโค้ดจริง
4. ควบคุม Gate Budget (design/system สูงสุด 6 ครั้ง, code-review สูงสุด 3 ครั้ง)

### ตัวอย่าง prompt

```text
/engineering-workflow ทำ refund webhook ให้ idempotent เมื่อได้รับ duplicate delivery พร้อมรองรับ retry และ partial failure
```

### การติดตั้งคำสั่งกำกับ Agent ในโปรเจกต์ (Harness Directives & Setup)

นำข้อความด้านล่างไปใส่ในไฟล์ตั้งค่าของ Agent ประจำโปรเจกต์ เพื่อให้ Agent เรียกใช้ `engineering-workflow` อัตโนมัติ:

- **สำหรับ `AGENTS.md` (Universal Agents)**:
  ```markdown
  ## Engineering Workflow Control Plane
  เมื่อได้รับคำสั่งสร้าง Feature, แก้ Bug/Incident, หรือดำเนินโปรเจกต์ขนาดใหญ่:
  1. เริ่มต้น Workflow ตาม: `.agents/skills/engineering-workflow/SKILL.md`
  2. แสดง State Header: `### 📋 Workflow: [<STAGE_NAME>]` ในทุกข้อความตอบกลับ
  3. บันทึกสถานะลงใน `.scratch/<feature-slug>/status.md`
  4. ห้ามแก้ไขไฟล์โค้ดจนกว่าจะผ่าน Discovery/Planning Gate และได้รับการอนุมัติจากผู้ใช้
  ```
- **สำหรับ `CLAUDE.md` (Claude Code)**:
  ```markdown
  ## Engineering Workflow Directive
  สำหรับงาน multi-stage engineering:
  - เริ่มต้นด้วยคำสั่ง: `/engineering-workflow <request>`
  - ตรวจสอบสถานะ: `/engineering-workflow status`
  - ทำงานต่อ: `/engineering-workflow continue`
  ```
- **สำหรับ `.cursorrules` / `.windsurfrules` (AI IDEs)**:
  ```markdown
  ## Engineering Workflow Rule
  Always orchestrate multi-stage features or bugfixes using `.agents/skills/engineering-workflow/SKILL.md`. Maintain State Header and pause at approval gates before editing code.
  ```

### ไฟล์ที่เกี่ยวข้อง

- `references/routing.md` — route และ proportional rigor
- `references/dependencies.md` — external dependency contracts และ runtime adapters
- `references/states.md` — contract ของทุก stage
- `references/gates.md` — quality gates and gate budgets
- `references/artifacts.md` — artifact conventions and fingerprints

## English / ภาษาอังกฤษ

### Purpose

One pure-prompt, zero-dependency control plane for feature, bug/incident, and large-project work. It
owns classification, routing, state, gates, bounded loops, dependency
selection, resume, reconciliation, and completion decisions. Installed
specialist skills own their disciplines.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill engineering-workflow
```

### Main workflow

Invoke `/engineering-workflow <request>`, `$engineering-workflow <request>`, or trigger via natural language. Supported commands include `continue [id]`, `status [id]`, and `list`. The workflow is designed for universal portability across AI agent environments (Antigravity, Cursor, Roo Code, Aider, Claude Code, Codex) without requiring Python or external runtimes.

The orchestrator enforces:
1. **Mandatory State Anchor Header** on every turn to pin cognitive attention.
2. **Markdown State Persistence** under `.scratch/<feature-slug>/status.md`.
3. **Adaptive Quality Gating** with strict read-only constraints during Discovery/Planning.
4. **Smart Zone Context Scoping** across phase boundaries (`/clear` or transient subagents).

### Related files

- `references/feature-flow.md`, `bug-flow.md`, `large-project-flow.md`
- `references/states.md` and `references/dependencies.md`
- `references/gates.md` and `references/artifacts.md`
- `evals/evals.json`
