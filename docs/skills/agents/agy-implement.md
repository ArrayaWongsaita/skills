# Agy Implement

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/agy-implement/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

รับ directory ของ ticket ที่ `grill-to-tickets` ปล่อยไว้ที่ `.scratch/<feature-slug>/issues/`
แล้วพาไปเป็นโค้ดที่รันได้จริง โดย agent หลัก (**orchestrator**) วางแผนลำดับงานเป็น **wave**
ตาม dependency graph จากนั้น dispatch **worker** ซึ่งเป็น `agy` แบบ headless หนึ่งตัวต่อหนึ่ง
ticket กระจายข้ามหลายผู้ให้บริการ LLM เพื่อไม่ให้ quota ของเจ้าเดียวเป็นคอขวด ทุก ticket
ถูกบังคับให้เขียนแบบ test-first, orchestrator ตรวจผลเองทุกครั้ง, รวมงานที่ผ่านเข้า
**integration branch** เป็นหนึ่ง commit ต่อหนึ่ง ticket แล้ว **หยุดก่อน review**

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill agy-implement
```

### ควรใช้เมื่อไร

- มี ticket set จาก `grill-to-tickets` แล้วอยากลง implement ทั้งชุดด้วยคำสั่งเดียว แทนการรัน
  `/implement` ทีละ ticket
- ticket set ใหญ่จนส่งไปหา provider เดียวแล้วชน rate limit / quota — ต้องการกระจายงานข้ามหลาย model
- อยากได้ TDD บังคับทุก ticket และให้ orchestrator เป็นคนตรวจ ไม่ใช่เชื่อคำ worker

### ไม่ควรใช้เมื่อไร

- ยังไม่มี ticket — ใช้ `/grill-to-tickets` หรือ `/to-tickets` ก่อน
- อยากขับทั้ง lifecycle รวม review และ PR — ใช้ `/engineering-workflow`
- เป็น ticket แก้บั๊กหรือ incident — v1 รองรับเฉพาะ feature ticket set
- อยากลง implement เองใน context เดียว — ใช้ `/implement`

### วิธีทำงานหลัก

เรียก `/agy-implement <dir|slug>` (หรือไม่ใส่ argument เพื่อใช้ `.scratch/*/issues/` ที่แก้ล่าสุด)

1. **Stage 0 — Plan (read-only)**: parse ticket เป็น dependency DAG, คำนวณ wave, เดา
   touch-set, เลือก test seam ต่อ ticket แล้วแสดง **Plan** และหยุดรอ approve โดยไม่แตะ
   source
2. **Stage 1 — Execute**: ต่อ wave — dispatch `agy` worker หนึ่งตัวต่อ ticket (serial ใน
   tree, parallel ใน `git worktree`), orchestrator รัน verification gate เอง (reproduce
   red, รัน green, typecheck, ตรวจ test diff), แล้ว integration gate ต่อ wave (squash-merge
   ตามลำดับเลข ticket, รัน suite เต็ม) **Reuse Catalog:** prompt ของ worker มีบรรทัด
   `**Reuse:**` ของ ticket และตัวชี้ `docs/reuse-catalog.md` แบบอ่านอย่างเดียว (ถ้ามี)
   orchestrator เขียนรายการลง catalog ใน commit ของแต่ละ ticket ทีละตัวตามลำดับ
   worker ที่รัน parallel จึงแค่อ่าน ไม่มีทางชนกัน
3. **Stop — Handoff**: พิมพ์ชื่อ integration branch, สรุป token ต่อ provider และคำสั่ง
   `/code-review` + `/scrutinize` ที่ต้องรันต่อใน context ใหม่ ไม่ push ไม่เปิด PR

sub-command: `continue` resume พร้อม Reality reconciliation, `status` / `list` อ่านอย่างเดียว

### ตัวอย่าง prompt

```text
/agy-implement .scratch/subtitle-preferences/
```

### ไฟล์ที่เกี่ยวข้อง

- `references/planning.md` — parse ticket, สร้าง/ตรวจ DAG, คำนวณ wave, touch-set hint, เลือก seam
- `references/agy-contract.md` — flag ของ `agy`, result envelope, การจัดการ failure/timeout
- `references/prompt-scaffold.md` — template prompt worker ต่อ ticket พร้อม red-green-refactor เต็ม และบรรทัด Reuse / Reuse Catalog
- `references/worktree-integration.md` — preflight, วงจร worktree, การ dispatch แบบ serial/parallel, integration gate, การอัปเดต Reuse Catalog
- `references/status-and-resume.md` — halt report, `status.md`, Reality reconciliation, rewind
- `evals/evals.json` — เคสพฤติกรรม หนึ่งเคสต่อ decision branch, รูปแบบ benchmark ของ `skill-creator`
- `evals/trigger-evals.json` — กันไม่ให้ description อ่านเหมือน model-invocable

## English / ภาษาอังกฤษ

### Purpose

Take a directory of tracer-bullet tickets that `grill-to-tickets` published under
`.scratch/<feature-slug>/issues/` and drive it to working code. The main agent —
the **orchestrator** — plans the order of work as dependency **waves**, then
dispatches one headless `agy` **worker** per ticket, spread across several LLM
providers so no single provider's quota is the bottleneck. Every ticket is built
test-first, the orchestrator verifies each result itself, verified work is
assembled onto one **integration branch** as one commit per ticket, and the run
**stops before review**.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill agy-implement
```

### Use it when

- You have a `grill-to-tickets` ticket set and want to implement the whole thing
  in one command instead of one `/implement` run per ticket.
- The ticket set is large enough that sending it all to one provider hits that
  provider's rate limit or quota — you want the run spread across models.
- You want TDD forced on every ticket and the orchestrator, not the worker,
  running the acceptance checks.

### Do not use it when

- There are no tickets yet — run `/grill-to-tickets` or `/to-tickets` first.
- You want the full lifecycle including review and a PR — use
  `/engineering-workflow`.
- The tickets are bug fixes or an incident — v1 accepts feature ticket sets only.
- You want to implement it yourself in one context — use `/implement`.

### Main workflow

Invoke `/agy-implement <dir|slug>` (or with no argument to use the most recently
modified `.scratch/*/issues/` directory).

1. **Stage 0 — Plan (read-only)**: parse the tickets into a dependency DAG,
   compute waves, estimate touch-sets, pick a test seam per ticket, emit the
   **Plan**, and pause for explicit approval without touching source.
2. **Stage 1 — Execute**: per wave, dispatch one `agy` worker per ticket (serial
   in the tree, parallel in `git worktree`s), run the orchestrator's verification
   gate on every result (reproduce red, run green, typecheck, inspect the test
   diff), then the per-wave integration gate (squash-merge in ticket-number
   order, full suite). **Reuse Catalog:** each worker prompt carries the
   ticket's `**Reuse:**` line and, when present, a read-only pointer to
   `docs/reuse-catalog.md`; the orchestrator writes catalog entries inside each
   ticket's squash commit, one ticket at a time, so parallel wave-mates only
   read the catalog.
3. **Stop — Handoff**: print the integration branch name, per-provider token
   usage, and the exact `/code-review` and `/scrutinize` commands to run next in
   a fresh context. It never pushes or opens a PR.

Sub-commands: `continue` resumes with Reality reconciliation; `status` and `list`
are read-only.

### Example prompt

```text
/agy-implement .scratch/subtitle-preferences/
```

### Related files

- `references/planning.md` — parsing the ticket format, building and validating
  the dependency DAG, computing waves, the touch-set hint, and test-seam
  selection
- `references/agy-contract.md` — the `agy` invocation flags, the result envelope,
  and failure/timeout handling
- `references/prompt-scaffold.md` — the per-ticket worker prompt template with the
  full red-green-refactor protocol inline, plus the Reuse and Reuse Catalog lines
- `references/worktree-integration.md` — preflight, worktree lifecycle, serial
  and parallel dispatch, the integration gate, and the Reuse Catalog update
- `references/status-and-resume.md` — the halt report, `status.md` fields,
  Reality reconciliation, and the resume rewind
- `evals/evals.json` — behavioral cases, one per decision branch, in
  `skill-creator`'s benchmark format; run on demand, not in CI
- `evals/trigger-evals.json` — guards that the skill's description does not read
  as model-invocable (the skill is `disable-model-invocation`)
