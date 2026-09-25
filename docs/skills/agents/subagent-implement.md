# Subagent Implement

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/subagent-implement/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

รับ directory ของ ticket ที่ `grill-to-tickets` ปล่อยไว้ที่
`.scratch/<feature-slug>/issues/` แล้วพาไปเป็นโค้ดที่รันได้จริง **โดยไม่เปลือง
context ของ main agent** agent หลัก (**orchestrator**) อ่าน ticket set กับ
`spec.md` แม่ วางลำดับงานจาก dependency graph แล้ว dispatch **worker** ซึ่งเป็น
subagent ของ harness เอง หนึ่งตัวต่อหนึ่ง ticket แต่ละ worker สร้าง ticket ของตัวเอง
แบบ test-first ใน worktree ที่แยกออกมา แล้วคืน report สั้น ๆ; **verifier** subagent
ตัวใหม่ reproduce red state และรัน suite; orchestrator อ่านแค่สอง report นั้น
ตัดสินผล squash-merge หนึ่ง commit ต่อหนึ่ง ticket เข้า **integration branch** แล้ว
หยุดก่อน review

เป็น sibling ของ `agy-implement` ที่ใช้ subagent ในตัว harness แทน `agy` ภายนอก:
`agy-implement` กระจาย token spend ข้าม LLM provider ส่วน `subagent-implement`
ผลัก file read / edit / test run ของ implementation เข้าไปอยู่ใน context ของ
worker ไม่ใช่ของ orchestrator — มีแค่ final report ของ worker กับ verifier ที่
ข้ามกลับมา

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill subagent-implement
```

### ควรใช้เมื่อไร

- มี ticket set จาก `grill-to-tickets` แล้วอยากลง implement ทั้งชุดด้วยคำสั่งเดียว
  โดยให้ context ของ main agent เหลือพื้นที่ไว้คิดงานวางแผน
- อยากได้ TDD บังคับทุก ticket และให้ orchestrator เป็นคนตัดสิน ไม่ใช่เชื่อคำ worker
- อยากให้ skill portable ข้าม harness — ไม่มีชื่อ model ฝังใน logic

### ไม่ควรใช้เมื่อไร

- ยังไม่มี ticket — ใช้ `/grill-to-tickets` ก่อน
- อยากขับทั้ง lifecycle รวม review และ PR — ใช้ `/engineering-workflow`
- ต้องการกระจายงานข้ามหลาย LLM provider เพื่อเลี่ยง rate limit — ใช้ `/agy-implement`
- เป็น ticket แก้บั๊กหรือ incident — v1 รองรับเฉพาะ feature ticket set
- อยากลง implement เองใน context เดียว — ใช้ `/implement`

### วิธีทำงานหลัก

เรียก `/subagent-implement <dir|slug>` (หรือไม่ใส่ argument เพื่อใช้
`.scratch/*/issues/` ที่แก้ล่าสุด) option: `--agent <name>` pin subagent type
ทั้ง run, `--model <id>` เป็น raw pass-through (default ไม่ส่ง ให้ inherit จาก
main agent)

1. **Stage 0 — Plan (read-only)**: parse ticket เป็น dependency DAG, ตรวจ acyclic
   / blocker / numbering, คำนวณ dependency order, เลือก test seam ต่อ ticket,
   match agent ต่อ ticket แล้วแสดง **Plan** และหยุดรอ approve โดยไม่แตะ source
2. **Stage 1 — Execute**: ทีละ ticket ตาม dependency order — dispatch worker
   subagent (worktree แยก, prompt test-first), verifier subagent ตัวใหม่
   (reproduce red, green, typecheck, full suite), orchestrator ตัดสินจากสอง
   report (กลวงไหม? ครอบคลุม criteria ไหม?) แล้ว squash-merge หนึ่ง commit ต่อ ticket
   **Reuse Catalog:** prompt ของ worker มีบรรทัด `**Reuse:**` ของ ticket และ (ถ้า
   project มี `docs/reuse-catalog.md`) ตัวชี้แบบอ่านอย่างเดียวให้ค้นก่อนสร้าง helper
   ที่ไม่ได้วางแผนไว้ ticket ที่มี `create-shared` / `create-candidate` / `extend` /
   `promote` จะได้ส่วน Reuse Plan ของ spec ด้วย และ orchestrator เขียนรายการลง
   catalog ใน commit ของ ticket นั้นเอง (path จากการ grep, use-when จาก Reuse Plan
   ไม่ต้องอ่านโค้ด) ถ้า project ไม่มี catalog ขั้นนี้ถูกข้าม
3. **Stop — Handoff**: พิมพ์ชื่อ integration branch, ยืนยันหนึ่ง commit ต่อ ticket
   และคำสั่ง `/code-review` + `/scrutinize` ที่ต้องรันต่อใน context ใหม่ ไม่ push
   ไม่เปิด PR

Seam, Context และ Budget: worker ใช้ `**Seam:**` ของ ticket แบบ **verbatim** เป็น
ขอบเขตเทสต์ ส่วน orchestrator ประกอบ **read list** ลงใน prompt ของ worker จาก
`**Context:**` (spec sections และไฟล์ แยก read / change / create) พาธใน worktree
ของ worker เขียนเป็น relative พาธนอก worktree เขียนเป็น absolute และ `status.md`
เก็บ `budget_estimate` (ข้อความ `**Budget:**` แบบ verbatim, `none` ถ้าไม่มี)
คู่กับ `usage_total` (ผลรวม token ที่ worker รายงานของ ticket จากทุก usage report
บน path ที่ส่ง ticket รวมทุก dispatch และทุก resume บันทึกตามที่รายงาน และอาจรวม
cache แล้ว (cache-inclusive); `verifier_usage_total` เก็บแยกสำหรับ verifier)

sub-command: `continue` resume พร้อม Reality reconciliation, `status` / `list`
อ่านอย่างเดียว

### ตัวอย่าง prompt

```text
/subagent-implement .scratch/subtitle-preferences/
```

### ไฟล์ที่เกี่ยวข้อง

- `references/planning.md` — parse ticket, สร้าง/ตรวจ DAG, dependency order, เลือก seam, match agent
- `references/dispatch-contract.md` — การ dispatch subagent, resolve agent + model, final report, retry budget, ข้อที่ต้องยืนยันตอนใช้จริง
- `references/prompt-scaffold.md` — template prompt worker ต่อ ticket พร้อม red-green-refactor เต็ม และบรรทัด Reuse / Reuse Catalog
- `references/verification-and-integration.md` — preflight, สัญญาของ verifier, orchestrator judgment, squash-merge, conflict routing, การอัปเดต Reuse Catalog ใน commit ของ ticket
- `references/status-and-resume.md` — halt report, `status.md`, Reality reconciliation, rewind
- `evals/evals.json` — เคสพฤติกรรม หนึ่งเคสต่อ decision branch, รูปแบบ benchmark ของ `skill-creator`
- `evals/trigger-evals.json` — กันไม่ให้ description อ่านเหมือน model-invocable

## English / ภาษาอังกฤษ

### Purpose

Take a directory of tracer-bullet tickets that `grill-to-tickets` published
under `.scratch/<feature-slug>/issues/` and drive it to working code
**without spending the main agent's context on implementation**. The main agent —
the **orchestrator** — plans the order of work from the dependency graph, then
dispatches one **worker** (a native harness subagent) per ticket to build it
test-first in an isolated worktree. A fresh **verifier** subagent reproduces the
red state and runs the suite; the orchestrator reads only those two reports,
judges the result, squash-merges one commit per ticket onto an **integration
branch**, and stops before review.

It is the native-subagent sibling of `agy-implement`: where `agy-implement`
spreads token spend across LLM providers, `subagent-implement` keeps the file
reads, edits, and test runs of implementation inside a worker's context window
rather than the orchestrator's.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill subagent-implement
```

### Use it when

- You have a `grill-to-tickets` ticket set and want to implement the whole thing
  in one command while the orchestrator's context stays free for planning.
- You want TDD forced on every ticket and the orchestrator, not the worker,
  making the pass/fail call.
- You want the skill portable across harnesses — no model name baked into its
  logic.

### Do not use it when

- There are no tickets yet — run `/grill-to-tickets` first.
- You want the full lifecycle including review and a PR — use
  `/engineering-workflow`.
- You want the run spread across several LLM providers to dodge a rate limit —
  use `/agy-implement`.
- The tickets are bug fixes or an incident — v1 accepts feature ticket sets only.
- You want to implement it yourself in one context — use `/implement`.

### Main workflow

Invoke `/subagent-implement <dir|slug>` (or with no argument to use the most
recently modified `.scratch/*/issues/` directory). Options: `--agent <name>`
pins the worker subagent type for the run; `--model <id>` is a raw pass-through
(omitted by default so workers inherit the orchestrator's model).

1. **Stage 0 — Plan (read-only)**: parse the tickets into a dependency DAG,
   validate acyclic / blockers / numbering, compute the dependency order, pick a
   test seam per ticket, match an agent per ticket, emit the **Plan**, and pause
   for explicit approval without touching source.
2. **Stage 1 — Execute**: one ticket at a time in dependency order — dispatch one
   worker subagent (isolated worktree, test-first prompt), a fresh verifier
   subagent (reproduce red, green, typecheck, full suite), the orchestrator's
   judgment from the two reports (vacuous? covers the criteria?), then a
   squash-merge of one commit per ticket. **Reuse Catalog:** each worker prompt
   carries the ticket's `**Reuse:**` line and, when the project has
   `docs/reuse-catalog.md`, a read-only pointer to search before creating an
   unplanned helper; a line with `create-shared`, `create-candidate`, `extend`,
   or `promote` also names the spec's Reuse Plan. The orchestrator writes those
   modules' catalog entries in the ticket's own commit — path from a grep,
   use-when from the Reuse Plan, no code read — and skips all of it when the
   project has no catalog.
3. **Stop — Handoff**: print the integration branch name, confirm one commit per
   ticket, and hand over the exact `/code-review` and `/scrutinize` commands for
   a fresh context. It never pushes or opens a PR.

Seam, Context, and budget: the worker uses the ticket's `**Seam:**` **verbatim**
as its test boundary, while the orchestrator builds the worker's **read list**
into its prompt from the ticket's `**Context:**` line (spec sections plus files,
split into read / change / create). Paths inside the worker's worktree are
**relative**; paths outside it are **absolute**. `status.md` records each
ticket's `budget_estimate` (the `**Budget:**` text verbatim, or `none`) beside
`usage_total` (the worker's reported subagent tokens for the ticket, summed over
every usage report, each dispatch and each resume, on the path that delivered
it; recorded as given and possibly cache-inclusive), with `verifier_usage_total`
kept separately for the verifier.

Sub-commands: `continue` resumes with Reality reconciliation; `status` and
`list` are read-only.

### Example prompt

```text
/subagent-implement .scratch/subtitle-preferences/
```

### Related files

- `references/planning.md` — parsing the ticket format, building and validating
  the dependency DAG, the dependency order, test-seam selection, and agent
  matching
- `references/dispatch-contract.md` — the subagent dispatch call, worker-agent
  and model resolution, the final-report shape, the retry budget, and the
  assumptions to confirm on first use
- `references/prompt-scaffold.md` — the per-ticket worker prompt template with
  the full red-green-refactor protocol inline, plus the Reuse and Reuse Catalog
  lines
- `references/verification-and-integration.md` — preflight, the verifier subagent
  contract, the orchestrator's judgment, the squash-merge, conflict routing, and
  the Reuse Catalog update inside each ticket's commit
- `references/status-and-resume.md` — the halt report, `status.md` fields,
  Reality reconciliation, and the resume rewind
- `evals/evals.json` — behavioral cases, one per decision branch, in
  `skill-creator`'s benchmark format; run on demand, not in CI
- `evals/trigger-evals.json` — guards that the skill's description does not read
  as model-invocable (the skill is `disable-model-invocation`)
