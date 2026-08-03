# Agent Instructions Architect

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/agent-instructions-architect/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

ใช้ตรวจสอบ ออกแบบ ย้าย และ validate ระบบคำสั่งของ coding agent ใน repository โดยให้ `AGENTS.md` เป็น canonical source และใช้ไฟล์ native ของแต่ละ runtime เป็น adapter หรือ selector ที่บางที่สุด

### ควรใช้เมื่อไร

- ต้อง audit ลำดับชั้นของ `AGENTS.md` หรือ `AGENTS.override.md`
- ต้องเชื่อม `CLAUDE.md`, Copilot instructions หรือ OpenCode rules เข้ากับ source กลาง
- ต้องตรวจ scope, precedence, context budget, duplication หรือ broken references
- ต้องวางแผน migration ของ instruction files อย่างปลอดภัย
- ต้อง validate instruction tree แบบ deterministic

### ไม่ควรใช้เมื่อไร

ไม่ใช่ skill สำหรับเขียน prompt ทั่วไป, ออกแบบ custom agent architecture หรือแก้ documentation ที่ไม่เกี่ยวกับระบบ instruction ของ repository

### วิธีทำงานหลัก

1. ตรวจ repository และ runtime ที่เกี่ยวข้องก่อนอ่าน instruction tree ขนาดใหญ่
2. แยก canonical rules, adapters, selectors, conditional rules และไฟล์ที่ shadow/unresolved
3. เลือก mode: Audit, Design, Migrate หรือ Validate
4. รักษา adapter ให้บางและไม่คัดลอก policy ซ้ำ
5. ตรวจผลด้วย script ใน skill และรายงาน evidence, assumptions และ remaining risks

### ตัวอย่าง prompt

```text
Audit this repository's AGENTS.md hierarchy for scope conflicts and broken references. Compare Codex, Claude Code, Copilot, and OpenCode adapters, then report the smallest safe migration plan.
```

### ติดตั้ง

ติดตั้งเฉพาะ skill นี้:

```bash
npx skills add ArrayaWongsaita/skills --skill agent-instructions-architect
```

ติดตั้งทั้งหมวด `agents` (ปัจจุบันมี skill นี้เป็นสมาชิกเดียว):

```bash
npx skills add ArrayaWongsaita/skills --skill agent-instructions-architect
```

### ไฟล์ที่เกี่ยวข้อง

- `references/` — taxonomy, runtime compatibility, migration และ quality rubric
- `scripts/` — scan, measure และ validate instruction tree
- `tests/` และ `evals/` — fixtures และ contract สำหรับตรวจ behavior

## English / ภาษาอังกฤษ

### Purpose

Use this skill to audit, design, migrate, and validate repository agent-instruction systems. It keeps `AGENTS.md` canonical and treats native runtime files as thin adapters or selectors.

### Use it when

- Auditing `AGENTS.md` or `AGENTS.override.md` hierarchy
- Designing `CLAUDE.md`, Copilot, or OpenCode adapters
- Investigating scope, precedence, context budgets, duplication, or broken references
- Planning a safe instruction migration
- Running deterministic instruction-tree validation

### Do not use it when

The task is generic prompt writing, custom-agent architecture, or unrelated documentation editing.

### Main workflow

1. Inspect the repository and relevant runtimes before reading a large instruction tree.
2. Classify canonical rules, adapters, selectors, conditional rules, and unresolved artifacts.
3. Select Audit, Design, Migrate, or Validate mode.
4. Keep runtime adapters thin and avoid copied policy prose.
5. Run the bundled checks and report evidence, assumptions, and remaining risks.

### Example prompt

```text
Audit this repository's AGENTS.md hierarchy for scope conflicts and broken references. Compare Codex, Claude Code, Copilot, and OpenCode adapters, then report the smallest safe migration plan.
```

### Install

Install only this skill:

```bash
npx skills add ArrayaWongsaita/skills --skill agent-instructions-architect
```

Install the `agents` category (currently containing this one skill):

```bash
npx skills add ArrayaWongsaita/skills --skill agent-instructions-architect
```

### Related files

- `references/` — taxonomy, runtime compatibility, migration, and quality guidance
- `scripts/` — instruction-tree scanning, measurement, and validation
- `tests/` and `evals/` — fixtures and behavior contracts
