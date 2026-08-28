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

เรียก `$engineering-workflow <request>` ใน Codex หรือ
`/engineering-workflow <request>` ใน Claude Code ใช้ `continue [id]`,
`status [id]` และ `list` ได้ ระบบจะ audit dependency จากไฟล์จริง, ขออนุมัติก่อน
ติดตั้ง, ตรวจเฉพาะ dependency ของ stage ถัดไป, บันทึก state ที่ `.agents/workflows/`, และบังคับ `scrutinize` เป็น
blocking gate โดยให้ design/system มี counter แยกกันสูงสุดอย่างละหกครั้ง
(code-review ยังคงมี budget แยกสามครั้ง) พร้อมหยุดก่อนกำหนดเมื่อไม่มี progress

Feature discovery ใช้ `grill-with-docs` ของ Matt Pocock จาก
`mattpocock/skills`; `grilling` และ `domain-modeling` เป็น transitive support
ที่ skill นั้นเรียกเอง ไม่ใช่ workflow stages แยกกัน

ถ้า Claude ต้องใช้ upstream skill ที่เป็น user-only ระบบจะแสดงคำสั่งจริงให้
ผู้ใช้เรียก แล้วให้ resume orchestrator ต่อ ไม่มีการสร้าง skill ทดแทน

### ตัวอย่าง prompt

```text
$engineering-workflow ทำ refund webhook ให้ idempotent เมื่อได้รับ duplicate delivery พร้อมรองรับ retry และ partial failure
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

Invoke `$engineering-workflow <request>` in Codex or
`/engineering-workflow <request>` in Claude Code. Commands include
`continue [id]`, `status [id]`, and `list`. Startup loads only repository/state
reality and audits the immediate stage dependency. It shows owner/source/provenance and verified installation guidance,
persists compare-and-swap state, and lets repository reality override stale
claims on resume. Installation is permission-gated and optional dependencies
are checked only when the selected route needs them.

Use the real external commands and identities resolved by the audit:
`grill-with-docs`, `to-spec`, `scrutinize`, `to-tickets`, `implement`,
`code-review`, `tdd`, `prototype`, `diagnosing-bugs`, `wayfinder`, `research`,
`post-mortem`, and `codebase-design`. `scrutinize` is a blocking design/system
gate with a six-cycle maximum per gate; a missing or incompatible dependency is
a visible `BLOCKED_DEPENDENCY` result, never a cloned worker.

Normal feature Discovery resolves `grill-with-docs` to Matt Pocock's
`mattpocock/skills` source and audits its required transitive `grilling` and
`domain-modeling` support skills without routing to either one independently.

### Runtime limitation

Claude cannot have its model invoke a skill with
`disable-model-invocation: true`; the user must run the external slash command
and then `/engineering-workflow continue`. Codex has no documented child-skill
API, so it loads the exact audited path when allowed and otherwise records the
real `$skill-name` handoff instead of bypassing policy.

### Related files

- `references/feature-flow.md`, `bug-flow.md`, `large-project-flow.md`
- `references/states.md` and `references/dependencies.md`
- `scripts/workflow_state.py` and `scripts/dependency_audit.py`
- `evals/evals.json`
