# implement-tickets

## ภาษาไทย / Thai

`implement-tickets` วางแผนชุด ticket ที่ publish แล้วใน
`.scratch/<feature-slug>/issues/` ก่อน dispatch native harness subagents
คำนวณ wave แบบ deterministic จาก blocker และ touch set แล้วส่ง verifier สดใหม่
มาตรวจงานของ worker ก่อน integrate งานที่ผ่าน

### ใช้เมื่อไร

- มี ticket ที่ publish แล้วและต้องการวางแผนทั้งชุดก่อนเริ่มเขียนโค้ด
- ต้องการให้ ticket ที่ไม่มี blocker และแก้คนละ path ทำงานใน wave เดียวกัน
- ต้องการเห็น touch set, blocker, warning, backend และ concurrency cap ใน Plan
- ต้องการให้ผู้ใช้อนุมัติ Plan ก่อนเปลี่ยนไฟล์นอก feature directory

เรียก `/implement-tickets <dir|slug>` หรือ `$implement-tickets <dir|slug>`
โดยตรง การเรียกแบบ implicit ปิดไว้สำหรับ Claude Code และ Codex

### ติดตั้ง

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

### วิธีทำงานหลัก

1. อ่าน ticket และ planning context จาก feature directory
2. คำนวณ blocker, touch set, warnings และ waves ด้วย `scripts/waves.mjs`
3. แสดง Plan ราย ticket พร้อม wave, blocker, touch set, seam, matched agent และ
   retry budget พร้อม backend, concurrency cap และ warnings
4. หยุดรอ explicit approval โดยไม่มีไฟล์นอก feature directory เปลี่ยนก่อนอนุมัติ
5. หลัง approval จึง dispatch worker และ verifier ตาม wave แล้ว integrate งานที่ผ่าน

ค่าเริ่มต้นเป็น native harness subagents และ concurrency cap เท่ากับ 4
`--concurrency N` เปลี่ยน cap โดยไม่เปลี่ยน waves ส่วน `--serial` แยก ticket
ทุกใบเป็น wave ของตัวเอง Ticket ที่ไม่มี touch set จะได้ wave เดี่ยวและ warning
เมื่อ marker เป็น `status: not validated` Plan จะแสดง `parallel not yet validated`

ใช้ `--with <name>` เพื่อเลือก adapter ที่ติดตั้งแยกชื่อ
`implement-tickets-<name>`. Preflight ค้นหา `.agents/skills/`, `.claude/skills/`,
`~/.agents/skills/` และ `~/.claude/skills/` ตามลำดับ หากไม่พบจะหยุดก่อน Plan
และสร้าง install line จาก `implement-tickets` ใน project `skills-lock.json`
ก่อน fallback ไป `~/.agents/.skill-lock.json`; ถ้าไม่มี entry จะใช้
`<source of implement-tickets>` พร้อม note ให้ใช้ source ที่ติดตั้ง core

รูปแบบ install line คือ:

```text
npx skills add <source> --skill implement-tickets-<name>
```

[Adapter contract](../../../skills/agents/implement-tickets/references/adapter-contract.md)
กำหนด input, resume, failover, envelope schema และ worktree cleanup. Core
สร้าง worker branch และ worktree ใต้ feature directory ส่ง path ให้ adapter
และลบ worktree หลัง integration

### Dispatch, verifier และ timeout

หลัง approval ให้ทำตาม [dispatch contract](../../../skills/agents/implement-tickets/references/dispatch-contract.md),
[worker prompt scaffold](../../../skills/agents/implement-tickets/references/prompt-scaffold.md)
และ [verification contract](../../../skills/agents/implement-tickets/references/verification.md).
เอกสารเหล่านี้เป็นแหล่งหลักของการ sync, การจัดคิว worker/verifier, timeout,
หลักฐาน verification และ infrastructure failure

### Integration gate, status, and resume

รายละเอียด integration และ recovery อยู่ใน
[integration gate contract](../../../skills/agents/implement-tickets/references/integration-gate.md).
สำหรับ run state และคำสั่ง status/list/continue ให้ดู
[status and resume contract](../../../skills/agents/implement-tickets/references/status-and-resume.md).
ความหมายของ [`usage_total`](../../glossary.md) อยู่ใน glossary กลาง
ใช้ `/implement-tickets status [slug]`, `/implement-tickets list` หรือ
`/implement-tickets continue [slug]` เพื่ออ่านหรือ resume run

เมื่อ run สำเร็จ ให้ส่งต่อ integration branch และ review commands แล้วหยุดก่อน
review, push หรือเปิด PR

### Seam และ Context

**Seam:** worker ใช้ `**Seam:**` ของ ticket แบบ verbatim เป็นขอบเขตที่ใช้ทดสอบ
**Context:** orchestrator สร้างรายการอ่านของ worker จาก `**Context:**`; plain path
และ `(from NN)` เป็น read-only ส่วน `(edit)`, `(new)` และ `(edit from NN)`
กำหนด touch set ที่ส่งให้ wave planner

## English / ภาษาอังกฤษ

### Purpose and use

`implement-tickets` turns a published ticket set into a read-only Plan followed
by test-first implementation with native harness subagents. It computes
deterministic waves from blocker and touch-set data, dispatches a fresh verifier
for each worker result, integrates verified work, and stops before review or a
pull request.

Invoke it explicitly with `/implement-tickets <dir|slug>` or
`$implement-tickets <dir|slug>`. Implicit invocation is disabled for Claude Code
and Codex. The Plan lists each ticket's wave, blockers, touch set, seam, matched
agent, and retry budget, along with the backend, concurrency cap, and warnings.
It pauses for explicit approval; no file outside the feature directory changes
until approval.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

The default backend is native harness subagents. Use `--concurrency N` to set
the shared in-flight cap or `--serial` for serial waves. See the
[planning reference](../../../skills/agents/implement-tickets/references/planning.md)
and [parallel-validation reference](../../../skills/agents/implement-tickets/references/parallel-validation.md)
for wave placement and marker behavior.

Use `--with <name>` to select a separately installed `implement-tickets-<name>`
adapter. Preflight searches `.agents/skills/`, `.claude/skills/`,
`~/.agents/skills/`, and `~/.claude/skills/` in that order. If it cannot find the
adapter, it stops before planning and builds the install line from the
`implement-tickets` entry in the project `skills-lock.json`, then falls back to
`~/.agents/.skill-lock.json`. With no lock entry, it uses
`<source of implement-tickets>` and tells the person to use the source that
installed the core.

The generated install line has this form:

```text
npx skills add <source> --skill implement-tickets-<name>
```

Use the [adapter contract](../../../skills/agents/implement-tickets/references/adapter-contract.md)
for adapter input, outcomes, and worktree ownership.

### Dispatch and verification

After approval, dispatch and verification follow the
[dispatch contract](../../../skills/agents/implement-tickets/references/dispatch-contract.md),
[worker prompt scaffold](../../../skills/agents/implement-tickets/references/prompt-scaffold.md),
and [verification contract](../../../skills/agents/implement-tickets/references/verification.md).
Those references define synchronization, scheduling, verifier evidence, timeout,
and infrastructure-failure handling.

### Run status, integration, and resume

The [integration gate contract](../../../skills/agents/implement-tickets/references/integration-gate.md)
defines integration and recovery. The [status and resume contract](../../../skills/agents/implement-tickets/references/status-and-resume.md)
defines saved run state and the status, list, and continue commands. For
`usage_total` semantics, see the canonical [glossary entry](../../glossary.md).
Run `/implement-tickets continue [slug]` to resume a saved run.

After a successful run, hand off the integration branch and review commands;
stop before review, push, or a pull request.

### Seam and Context

**Seam:** The worker uses the ticket's `**Seam:**` verbatim as its test boundary.
**Context:** The orchestrator converts `**Context:**` into the worker's read list;
plain paths and `(from NN)` are read-only, while `(edit)`, `(new)`, and
`(edit from NN)` paths define the touch set passed to the wave planner.

### Canonical files

- [`SKILL.md`](../../../skills/agents/implement-tickets/SKILL.md) — invocation
  and workflow contract
- [`planning.md`](../../../skills/agents/implement-tickets/references/planning.md)
  — Stage 0 parsing, waves, and Plan rules
- [`parallel-validation.md`](../../../skills/agents/implement-tickets/references/parallel-validation.md)
  — the initial validation marker
- [`dispatch-contract.md`](../../../skills/agents/implement-tickets/references/dispatch-contract.md)
  — worker scheduling, shared concurrency cap, and infrastructure retries
- [`prompt-scaffold.md`](../../../skills/agents/implement-tickets/references/prompt-scaffold.md)
  — the worker prompt and required integration sync step
- [`verification.md`](../../../skills/agents/implement-tickets/references/verification.md)
  — verifier dispatch, evidence, and timeout contract
- [`integration-gate.md`](../../../skills/agents/implement-tickets/references/integration-gate.md)
  — ticket-order integration, full-suite gate, and culprit recovery
- [`status-and-resume.md`](../../../skills/agents/implement-tickets/references/status-and-resume.md)
  — read-only status, list, and resume behavior
- [`waves.mjs`](../../../skills/agents/implement-tickets/scripts/waves.mjs) —
  deterministic ticket wave planner
- [`adapter-contract.md`](../../../skills/agents/implement-tickets/references/adapter-contract.md)
  — adapter input, outcomes, envelope, and worktree rules
