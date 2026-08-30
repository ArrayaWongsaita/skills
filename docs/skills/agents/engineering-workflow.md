# Engineering Workflow

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/engineering-workflow/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

เป็น control plane เดียวสำหรับจำแนก route, เก็บ workflow state, บังคับ quality
gates, ตรวจ artifact/Git ตอน resume และตัดสิน `COMPLETE` หรือ `BLOCKED` โดยใช้
engineering skills ที่ติดตั้งจริงเป็น specialist source of truth

ติดตั้งด้วยคำสั่งนี้เมื่อ repository ยังไม่มี orchestrator:

```bash
npx skills add ArrayaWongsaita/skills --skill engineering-workflow
```

### ควรใช้เมื่อไร

- ต้องการ route งาน feature, bug/incident หรือ large project แบบต่อเนื่อง
- ต้องการ bounded design/code/system review และ resume ข้าม session
- ต้องตรวจ dependency, invocation policy, collision หรือ subagent capability

### ไม่ควรใช้เมื่อไร

ไม่ใช้กับ discipline เดี่ยวหรือคำถามอ่านอย่างเดียว ให้เรียก external skill ที่
ติดตั้งอยู่โดยตรง เช่น `/to-spec`, `/tdd`, `/prototype` หรือ `/scrutinize`

### วิธีทำงานหลัก

เรียก `/engineering-workflow <request>`, `$engineering-workflow <request>`, หรือรันผ่าน CLI `python3 scripts/workflow_state.py init "<request>"` รองรับทุก AI Agent (Antigravity, Cursor, Roo Code, Aider, Claude Code, Codex) ใช้ `continue [id]`, `status [id]` และ `list` ได้ ระบบจะ audit dependency ตามความสามารถจริง (Capabilities), บันทึก state ที่ `.agents/workflows/`, และรองรับการสั่งงาน Subagent ทีละ Ticket ต่อเนื่องใน Stage `IMPLEMENTATION` โดยบังคับ `scrutinize` เป็น blocking gate (design/system แยก budget สูงสุดอย่างละ 6 ครั้ง, code-review แยก 3 ครั้ง)

Feature discovery ใช้ `grill-with-docs` ของ Matt Pocock จาก `mattpocock/skills`; `grilling` และ `domain-modeling` เป็น transitive support ที่ skill นั้นเรียกเอง ไม่ใช่ workflow stages แยกกัน

### ตัวอย่าง prompt

```text
$engineering-workflow ทำ refund webhook ให้ idempotent เมื่อได้รับ duplicate delivery พร้อมรองรับ retry และ partial failure
```

### การติดตั้งคำสั่งกำกับ Agent ในโปรเจกต์ (Harness Directives & Setup)

นำข้อความด้านล่างไปใส่ในไฟล์ตั้งค่าของ Agent ประจำโปรเจกต์ เพื่อให้ Agent เรียกใช้ `engineering-workflow` อัตโนมัติ:

- **สำหรับ `AGENTS.md` (Universal Agents)**:
  ```markdown
  ## Engineering Workflow Control Plane
  เมื่อได้รับคำสั่งสร้าง Feature, แก้ Bug/Incident, หรือดำเนินโปรเจกต์ขนาดใหญ่:
  1. เริ่มต้น Workflow ผ่าน: `python3 scripts/workflow_state.py init "<request>"`
  2. ปฏิบัติตาม Stage Contracts ใน `references/states.md`
  3. ใน Stage `IMPLEMENTATION` ให้รันตั๋วงานทีละใบด้วย Subagent (`self`) หรือใช้ `/clear` ก่อนเริ่ม
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
  Always orchestrate multi-stage features or bugfixes using `.agents/skills/engineering-workflow/SKILL.md`. Track state via `python3 scripts/workflow_state.py`.
  ```

### ไฟล์ที่เกี่ยวข้อง

- `references/routing.md` — route และ proportional rigor
- `references/dependencies.md` — external dependency contracts และ runtime adapters
- `references/states.md` — contract ของทุก stage
- `scripts/workflow_state.py` — atomic state/reconcile operations
- `scripts/dependency_audit.py` — read-only installed-skill audit

## English / ภาษาอังกฤษ

### Purpose

One durable control plane for feature, bug/incident, and large-project work. It
owns classification, routing, state, gates, bounded loops, dependency
selection, resume, reconciliation, and completion decisions. Installed
specialist skills own their disciplines.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill engineering-workflow
```

### Main workflow

Invoke `/engineering-workflow <request>`, `$engineering-workflow <request>`, or execute `python3 scripts/workflow_state.py init "<request>"`. Supported commands include `continue [id]`, `status [id]`, and `list`. The workflow is designed for universal portability across AI agent environments (Antigravity, Cursor, Roo Code, Aider, Claude Code, Codex). Startup loads repository and state reality, auditing dependencies based on dynamic capabilities (`has_subagents`, `has_bash`, etc.). In `IMPLEMENTATION`, it supports executing tickets sequentially in isolated transient subagents (`self`) for continuous, focused delivery within the model's Smart Zone.

Use the real external commands and identities resolved by the audit: `grill-with-docs`, `to-spec`, `scrutinize`, `to-tickets`, `implement`, `code-review`, `tdd`, `prototype`, `diagnosing-bugs`, `wayfinder`, `research`, `post-mortem`, and `codebase-design`. `scrutinize` is a blocking design/system gate with a six-cycle maximum per gate; a missing or incompatible dependency is a visible `BLOCKED_DEPENDENCY` result, never a cloned worker.

### Related files

- `references/feature-flow.md`, `bug-flow.md`, `large-project-flow.md`
- `references/states.md` and `references/dependencies.md`
- `scripts/workflow_state.py` and `scripts/dependency_audit.py`
- `evals/evals.json`
