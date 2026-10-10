# Implement Tickets

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/implement-tickets/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

implement spec ที่เผยแพร่แล้วด้วยคำสั่งเดียว โดยทำตาม skill `implement-spec` ของ upstream ที่ติดตั้งไว้ตั้งแต่ต้นจนจบ พร้อมเก็บ **Run status** (`status.md`) ที่เปิดดูได้ทุกเมื่อว่า ticket แต่ละใบอยู่สถานะใด skill นี้ไม่มี planner, script หรือชุด reference ของตัวเอง จึงใช้ได้ทั้ง Tracker แบบ local และ remote เมื่อมี ticket ที่ทำไม่สำเร็จ run จะทำ ticket อิสระต่อไป แล้วหยุดก่อน `code-review` พร้อมบอกว่าอะไรค้างและเพราะอะไร skill นี้ครอบคลุมการรันครั้งแรก

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

ต้องติดตั้ง skill ของ upstream ด้วย:

```bash
npx skills add mattpocock/skills --skill implement-spec
npx skills add mattpocock/skills --skill tdd
npx skills add mattpocock/skills --skill code-review
```

ตอนเริ่ม **Preflight** จะหา `SKILL.md` ของทั้งสามตัวใน `.agents/skills/`, `.claude/skills/`, `~/.agents/skills/` และ `~/.claude/skills/` ตามลำดับ ถ้าขาดตัวไหนจะหยุดและพิมพ์คำสั่งติดตั้งของตัวนั้น ถ้า project ไม่มี `docs/agents/issue-tracker.md` จะหยุดและชี้ไปที่ `setup-matt-pocock-skills`

### ควรใช้เมื่อไร

- มี spec กับ ticket ที่เผยแพร่แล้ว (เช่นจาก `/grill-to-tickets`) และอยากให้ทำตาม flow ของ `implement-spec` พร้อมบันทึกสถานะที่เปิดดูได้

### ไม่ควรใช้เมื่อไร

- ถ้าไม่ต้องการ Run status ให้เรียก `/implement-spec` ตรง ๆ

### วิธีทำงานหลัก

เรียก `/implement-tickets <spec reference>` หรือ `$implement-tickets <spec reference>` (path, เลข issue หรือ URL ไม่มี flag) จากนั้น:

1. แปลง argument เป็น spec reference แบบ canonical: path จาก root ของ repository สำหรับ Tracker แบบ local, identifier ของ Tracker สำหรับ remote
2. ทำตาม `implement-spec` ตามที่เขียนไว้ (ใช้ `tdd` ใน implementer แต่ละตัวและ `code-review` ตอนท้าย) โดยไม่เปลี่ยนขั้นใดของ upstream
3. เขียน **Run status** (`status.md` ใน directory ของ feature ใต้ `.scratch/`) หลังสร้าง integration branch และก่อนแจก ticket แรก โดยทุกแถวเป็น `waiting` แล้วอัปเดตทุกเหตุการณ์: แจก ticket, merge, `stuck`, เปิด pull request และจบ run
4. ให้ merger ปิดข้อความ commit ที่นำ ticket เข้า integration branch ด้วย trailer ที่ระบุ ticket นั้น
5. ถ้ามี ticket `stuck` และไม่มีอะไรทำต่อได้ จะหยุดก่อน `code-review` และก่อนปิด ticket ใด ๆ ล้าง worktree ของ ticket ที่ `done` เก็บของ ticket ที่ `stuck` แล้วรายงาน
6. เมื่อขั้นสุดท้ายของ upstream เสร็จ สถานะ run เป็น `finished`

Run status มีคอลัมน์ Ticket, Title, Blocked by, Status, Commit ตามลำดับนี้ และสถานะ `waiting`, `in progress`, `done`, `stuck` ถ้ามี `status.md` ที่หัวตารางไม่ตรง run จะหยุดและไม่แตะไฟล์นั้น

### ตัวอย่าง prompt

```text
/implement-tickets .scratch/saved-searches/spec.md
```

### ไฟล์ที่เกี่ยวข้อง

- `agents/openai.yaml` — metadata สำหรับ Codex โดยปิด implicit invocation
- `evals/` — trigger evals และ scenario evals

## English / ภาษาอังกฤษ

### Purpose

Implement a published spec in one command by following the installed upstream `implement-spec` skill from start to finish, while keeping a **Run status** (`status.md`) you can open at any time to see each ticket's state. The skill owns no planner, script, or reference set, so it works with a local or a remote Tracker. When a ticket cannot be finished the run keeps going on independent tickets, then stops before `code-review` and says what is stuck and why. This skill covers a first run.

Install:

```bash
npx skills add ArrayaWongsaita/skills --skill implement-tickets
```

Install the upstream skills it follows:

```bash
npx skills add mattpocock/skills --skill implement-spec
npx skills add mattpocock/skills --skill tdd
npx skills add mattpocock/skills --skill code-review
```

**Preflight** looks for the three `SKILL.md` files in `.agents/skills/`, `.claude/skills/`, `~/.agents/skills/`, then `~/.claude/skills/`. A missing one stops the run with its install line. A project without `docs/agents/issue-tracker.md` stops the run and is pointed to `setup-matt-pocock-skills`.

### Use it when

- You have a published spec and tickets (for example from `/grill-to-tickets`) and want the `implement-spec` flow with a status record you can open.

### Do not use it when

- You do not need a Run status. Call `/implement-spec` directly.

### Main workflow

Call `/implement-tickets <spec reference>` or `$implement-tickets <spec reference>` (a path, an issue number, or a URL; no flags). Then:

1. The argument becomes one canonical spec reference: the path from the repository root for a local Tracker, the Tracker's identifier for a remote one.
2. The run follows `implement-spec` as written (`tdd` in each implementer, `code-review` at the end) and changes no upstream step.
3. The **Run status** (`status.md` in the feature's directory under `.scratch/`) is written after the integration branch is created and before any ticket is handed out, every row `waiting`, then updated at each event: a ticket handed out, merged, or `stuck`; a pull request opened; the run finished.
4. The merger ends the message of the commit that lands a ticket with a trailer naming that ticket.
5. When a ticket is `stuck` and nothing more can be done, the run stops before `code-review` and before any ticket is closed, cleans up the worktrees of `done` tickets, keeps the `stuck` ones, and reports.
6. When upstream's last step completes, the run state becomes `finished`.

The Run status table has the columns Ticket, Title, Blocked by, Status, Commit in that order, and the states `waiting`, `in progress`, `done`, `stuck`. A `status.md` with any other table header stops the run and is left as it is.

### Example prompt

```text
/implement-tickets .scratch/saved-searches/spec.md
```

### Related files

- `agents/openai.yaml`: Codex metadata with implicit invocation off.
- `evals/`: trigger evals and scenario evals.
