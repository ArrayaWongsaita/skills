# Tokenme Agent

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/tokenme-agent/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

ส่งต่อ (delegate) subtask ที่เป็น **งานกลไก (mechanical)** และ **self-contained** — เปลี่ยนชื่อเดิมทั้งหลายในไฟล์เล็ก ๆ จำนวนมาก, สร้าง boilerplate, จัด formatting, รัน lint แล้วรายงานผล, สรุป log ยาว — ไปรันบน headless tokenme run ที่ถูกกว่า แทนการเผา context และ quota ของ host model

โมเดลที่รับงานคือโมเดลที่ tokenme settings file กำหนดไว้ — skill นี้ไม่ระบุชื่อหรือเวอร์ชันโมเดลใดเลย จึงไม่ต้องแก้เมื่อ gateway เปลี่ยนโมเดล และ host ยังคงเป็นเจ้าของการตัดสินใจ ตรวจผลทุกชิ้นด้วยตัวเองก่อนรายงานว่าเสร็จ

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill tokenme-agent
```

### การเรียกใช้ (Invocation)

skill นี้เป็น model-invocable — เรียกได้สามทาง:

- โมเดลเรียกเอง — เมื่อจำ subtask ที่ mechanical และ self-contained ได้ในแผนงานของตัวเอง ให้ delegate งานนั้นผ่าน workflow ด้านล่าง (ตัวอย่างชัด คือการเปลี่ยนชื่อเดิมทั้งหลายในไฟล์เล็ก ๆ จำนวนมาก)
- ข้อความในงาน — เมื่อ task text พูดว่า "use tokenme", "delegate this" หรือ "do this cheaply" ให้ถือว่าประโยคนั้นเรียก skill นี้สำหรับ subtask นั้น แม้ผู้ใช้จะไม่ได้พิมพ์คำสั่ง
- เรียกตรงด้วยชื่อ:
  - Slash command: `/tokenme-agent <task description>`
  - Codex: `$tokenme-agent <task description>`

### ควรใช้เมื่อไร

- งานเชิงกลไก: bulk rename, สร้าง boilerplate, mechanical formatting, lint-and-report, สรุป log
- batch edit ที่มี acceptance criterion ตรวจสอบได้
- งานอ่านอย่างเดียวที่ผลลัพธ์ตายตัว เช่น สรุป log ขนาดใหญ่
- งานอิสระหลายชิ้นที่ไฟล์ไม่ซ้ำกัน รันขนานกันได้ตามกฎ disjoint file sets

### ไม่ควรใช้เมื่อไร

- งานที่แตะ secrets, `.env` หรือ credential files
- ticket ที่ระบุ `Risk: high` หรือ code ที่ผู้ใช้ทำเครื่องหมายว่าห้ามออกจากเครื่อง (host ตรวจก่อน dispatch เพราะ bare run อ่าน project instructions ไม่เห็น)
- การเลือก design/architecture, security-sensitive edits และ debugging ที่ต้องใช้ดุลพินิจ
- งานที่ต้องใช้บริบทจากแชทก่อนหน้านี้

### วิธีทำงานหลัก

1. **คัดกรอง** — ตรวจ subtask กับ keep-local rules และ eligibility checklist สามข้อ (self-contained, fits the budget, verifiable by a diff or a test run) ใน `delegation-policy.md`
2. **คิดขนาด** — footprint = file bytes ÷ 4 × 1.5 บวก fixed overhead ของ run (ประมาณ 1k เมื่อ bare, ประมาณ 28k เมื่อไม่ bare) ต้องอยู่ใน planning budget 60k tokens โดยมีเพดาน 90k tokens; งานที่เกินให้แบ่งเป็น chunk ต่อไฟล์หรือต่อ directory แล้วรันเป็น delegate run แยกกัน (ดู `budget-and-chunking.md`)
3. **ส่งงาน** — เขียน prompt ลงไฟล์ แล้วรัน `claude-tokenme -p "$(cat …)"` พร้อม `--bare`, `--output-format json`, stdout กับ stderr แยกไฟล์กัน, จำกัดชุด tools ตามชนิดงาน และ deny list ที่กัน git เปลี่ยน history และกันการเริ่ม run ซ้อน (ดู `dispatch-contract.md` และแม่แบบ prompt ใน `prompt-scaffold.md`); งานอิสระที่ไฟล์ไม่ซ้ำกันรันขนานกันได้ โดยแต่ละ run มี result และ error file ของตัวเอง
4. **ตรวจผลเอง** — อ่าน envelope (`is_error` false, `subtype` success, `terminal_reason` completed, exit code เป็นศูนย์), เทียบ baseline ของ tree ก่อน-หลัง run แล้วรัน test/build/lint เอง สรุปผลของ run เป็นแค่ claim ที่ต้องตรวจ ไม่ใช่หลักฐาน; พลาดหนึ่งครั้งให้ retry ด้วย chunk ที่เล็กลง แล้ว host ทำงานนั้นเอง

### ไฟล์ที่เกี่ยวข้อง

- `references/delegation-policy.md` — keep-local rules, exclusion list, eligibility checklist
- `references/budget-and-chunking.md` — footprint formula, planning budget, การแบ่ง chunk, overflow symptoms
- `references/dispatch-contract.md` — preflight, flags, tool scoping, deny list, result gate, baseline comparison, failure policy
- `references/prompt-scaffold.md` — แม่แบบ prompt สำหรับ read-only task และ edit task
- `evals/evals.json` — ชุดทดสอบพฤติกรรม
- `evals/trigger-evals.json` — เคสทดสอบการ trigger skill
- `agents/openai.yaml` — Codex agent config (`$tokenme-agent`, implicit invocation)

### สำหรับผู้ดูแล (Maintainer notes)

Repository validation gate คือ `npm run validate` — เป็น gate ที่แยกจาก node test suite และต้องรันก่อน merge node test suite (`npm test`) ตรวจ document contract ผ่านไฟล์ใน `tests/` ส่วน validator ตรวจ metadata, links, eval contracts, คู่มือประกอบ skill และ index ที่ generated แล้ว

---

## English / ภาษาอังกฤษ

### Purpose

Delegate a mechanical, self-contained subtask — a rename across small files, boilerplate, mechanical formatting, lint-and-report, log summarising — to a cheaper headless tokenme run instead of spending host-model context and quota on it.

The model that takes the work is whatever the tokenme settings file configures; the skill names no model and no version, so a gateway swap needs no edit. The host keeps the judgment and verifies every outcome itself before reporting done.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill tokenme-agent
```

### Invocation

The skill is model-invocable and loads three ways:

- Model invocation — on recognising a mechanical, self-contained subtask in your own plan, delegate it through the workflow below; a rename across small files is the canonical example.
- Phrasing inside a task text — "use tokenme", "delegate this", or "do this cheaply" names this skill for that subtask, even though the user typed no command.
- Direct invocation by name:
  - Slash command: `/tokenme-agent <task description>`
  - Codex: `$tokenme-agent <task description>`

### Use it when

- The work is mechanical: bulk renames, boilerplate generation, mechanical formatting, lint-and-report, log summarising.
- The task is a batch edit with a checkable acceptance criterion.
- The task is read-only crunching with a fixed output, such as summarising a large log.
- Several independent tasks touch different files, so they run in parallel under the disjoint-file-sets rule.

### Do not use it when

- The task touches secrets, `.env` or credential files.
- The ticket is marked `Risk: high`, or the code is user-marked as staying local (the host checks before dispatch, because a bare run reads no project instructions).
- The work is a design or architecture choice, a security-sensitive edit, or debugging that needs judgment.
- The task depends on this chat's earlier context.

### Core workflow

1. **Screen** — check the subtask against the keep-local rules and the three-point eligibility checklist (self-contained, fits the budget, verifiable by a diff or a test run) in `delegation-policy.md`.
2. **Size** — footprint = file bytes ÷ 4 × 1.5 plus the run's fixed overhead (about 1k bare, about 28k not bare) must fit the 60k-token planning budget under the 90k-token ceiling; an oversized job is split into per-file or per-directory chunks that run as separate delegate runs (`budget-and-chunking.md`).
3. **Dispatch** — write the prompt to a file and run `claude-tokenme -p "$(cat …)"` with `--bare`, `--output-format json`, stdout and stderr in separate files, a tool set scoped to the task kind, and the deny list that blocks history-changing git commands and nested runs (`dispatch-contract.md`, with the prompt templates in `prompt-scaffold.md`); independent tasks on disjoint file sets run in parallel, each with its own result and error file.
4. **Verify** — read the envelope (`is_error` false, `subtype` success, `terminal_reason` completed, exit code zero), compare the before-and-after baseline of the tree, and run the test, build or lint check yourself. The run's own summary is a claim to check, not proof; one failure is retried with a narrower chunk, then the host does the task itself.

### Related files

- `references/delegation-policy.md` — keep-local rules, exclusions, eligibility checklist
- `references/budget-and-chunking.md` — footprint formula, planning budget, chunking, overflow symptoms
- `references/dispatch-contract.md` — preflight, flags, tool scoping, deny list, result gate, baseline comparison, failure policy
- `references/prompt-scaffold.md` — prompt templates for read-only and edit tasks
- `evals/evals.json` — behaviour evals
- `evals/trigger-evals.json` — trigger routing evals
- `agents/openai.yaml` — Codex agent config (`$tokenme-agent`, implicit invocation)

### For maintainers

The repository validation gate is `npm run validate` — a gate separate from the node test suite, and it is run before merging. The node test suite (`npm test`) asserts the document contracts under `tests/`; the validator checks metadata, links, eval contracts, the skill's guides, and the generated index.
