# Agent Instructions Architect

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/agent-instructions-architect/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

ใช้ตรวจ repository แล้วออกแบบ ติดตั้ง ปรับโครงสร้าง ย้าย หรือ validate ระบบ
instruction สำหรับ coding agent เพียงตัวเดียว โดยให้ root `AGENTS.md` เป็น
operating map ที่บาง ใช้ nested `AGENTS.md` เฉพาะข้อจำกัดตามตำแหน่ง ใช้ Agent
Skills เป็นขั้นตอนทำงานแบบ progressive disclosure และให้เอกสารกับ tooling เป็น
source of truth และตัวบังคับกฎที่เหมาะสม

### หลักการสำคัญ

~~~text
AGENTS.md          = สิ่งที่ต้องรู้แทบทุกงาน + แผนที่ + routing/safety
nested AGENTS.md   = ข้อจำกัดของ subtree
SKILL.md           = วิธีทำงานซ้ำได้ / HOW
docs/standards     = สิ่งที่ repository บังคับ / WHAT
ARCHITECTURE.md    = โครงสร้าง ขอบเขต dependency และ ownership
docs/references    = รายละเอียดที่อ่านเมื่อเกี่ยวข้อง
docs/decisions     = เหตุผลของการตัดสินใจสำคัญ
tooling / CI       = การบังคับแบบ deterministic
~~~

Skill นี้ไม่สร้าง frontend agent, backend agent, tester, reviewer หรือ
coordinator แต่สร้าง expertise ที่ agent ตัวเดียวเลือกประกอบตามงานจริง

### ควรใช้เมื่อไร

- เริ่มระบบ `AGENTS.md` และ repository-local skills ใน project
- แยก `AGENTS.md` ที่ใหญ่เกินไปออกเป็น scoped instructions, skills และ docs
- audit scope, precedence, context, duplication, broken links หรือ skill metadata
- migrate `CLAUDE.md`, Copilot instructions หรือ OpenCode rules เข้าหา canonical
  system โดยรักษาความสามารถจริงของแต่ละ runtime
- validate routing, source of truth, context efficiency และ deterministic checks

### ไม่ควรใช้เมื่อไร

ไม่ใช้สำหรับแก้ feature ของ application, เขียน prompt ทั่วไป, สร้าง skill
ประเภทอื่นแบบ one-off หรือออกแบบ multi-agent/custom-agent orchestration

### โหมดและขั้นตอน

รองรับ Audit, Design, Setup, Refactor, Migrate และ Validate โดยทำตามลำดับ:

1. ตรวจ stack, architecture, modules, commands, tests, CI, generated files,
   เอกสาร และ agent infrastructure ที่มีอยู่
2. จำแนกข้อมูลตามเจ้าของที่ถูกต้องและ reuse source of truth เดิม
3. สร้าง tree ที่เล็กที่สุด โดยไม่สร้าง placeholder หรือ router layer
4. ออกแบบ skills ที่มี WHAT + WHEN ชัดเจนและประกอบหลาย skill ได้
5. ใช้ runtime adapters เฉพาะเมื่อ runtime ที่ใช้งานต้องการจริง
6. ตรวจ diff, paths, commands, routing, duplication, context และ checks ที่มีจริง

### ตัวอย่าง prompt

~~~text
Inspect this repository, then implement the smallest useful single-agent
instruction architecture. Keep root AGENTS.md lean, create only evidence-backed
scoped instructions and skills, reuse repository docs as sources of truth, and
add deterministic validation where practical.
~~~

### ติดตั้ง

~~~bash
npx skills add ArrayaWongsaita/skills --skill agent-instructions-architect
~~~

### ไฟล์ที่เกี่ยวข้อง

- `references/repository-inspection.md` — checklist การตรวจ repo จากหลักฐาน
- `references/instruction-taxonomy.md` — decision tree เลือกเจ้าของข้อมูล
- `references/skill-system-design.md` — การออกแบบและ compose skills
- `references/runtime-compatibility.md` — behavior ของ runtime ที่มีแหล่งอ้างอิง
- `scripts/` — scan, measure และ validate instruction tree กับ skill catalog
- `tests/` และ `evals/` — contract tests และ routing scenarios

## English / ภาษาอังกฤษ

### Purpose

Use this skill to inspect a repository and set up, audit, design, refactor,
migrate, or validate a lean single-agent instruction architecture. It combines
a small root `AGENTS.md`, justified scoped instructions, progressive-disclosure
skills, authoritative repository documentation, and deterministic enforcement.

### Responsibility model

~~~text
AGENTS.md          = nearly-always-needed operation, map, routing, and safety
nested AGENTS.md   = subtree-specific constraints
SKILL.md           = reusable procedure or expertise: HOW
docs/standards     = repository-specific requirements: WHAT
ARCHITECTURE.md    = structure, boundaries, dependencies, and ownership
docs/references    = detail consulted when relevant
docs/decisions     = rationale for important decisions
tooling / CI       = deterministic enforcement
~~~

One coding agent composes expertise from skills; the architecture does not
introduce frontend, backend, database, testing, reviewing, or coordinating
agents.

### Use it when

- Setting up `AGENTS.md` and repository-local skills for a project
- Refactoring a giant instruction file into scoped instructions, skills, and docs
- Auditing scope, precedence, context, duplication, links, or skill metadata
- Migrating Claude Code, Copilot CLI, or OpenCode guidance toward one canonical
  system while preserving capability-accurate native behavior
- Validating routing, source-of-truth ownership, context efficiency, and checks

### Do not use it when

Do not use it for application feature implementation, generic prompt writing,
an unrelated one-off skill, or multi-agent/custom-agent orchestration.

### Modes and workflow

The skill supports Audit, Design, Setup, Refactor, Migrate, and Validate:

1. Inspect the actual stack, architecture, modules, commands, tests, CI,
   generated files, documentation, and existing agent infrastructure.
2. Classify each item and reuse existing authoritative sources.
3. Build the minimum tree without placeholders or redundant router layers.
4. Design composable skills with precise WHAT + WHEN descriptions.
5. Add runtime adapters only for active runtimes that require them.
6. Review the diff and validate paths, commands, routing, duplication, context,
   and repository checks.

### Example prompt

~~~text
Inspect this repository, then implement the smallest useful single-agent
instruction architecture. Keep root AGENTS.md lean, create only evidence-backed
scoped instructions and skills, reuse repository docs as sources of truth, and
add deterministic validation where practical.
~~~

### Install

~~~bash
npx skills add ArrayaWongsaita/skills --skill agent-instructions-architect
~~~

### Related files

- `references/repository-inspection.md` — evidence-first discovery
- `references/instruction-taxonomy.md` — responsibility decision tree
- `references/skill-system-design.md` — skill design and composition
- `references/runtime-compatibility.md` — sourced runtime semantics
- `scripts/` — instruction-tree and skill-catalog analysis
- `tests/` and `evals/` — contract tests and routing scenarios
