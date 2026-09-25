# opencode Implement

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/opencode-implement/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

รับ directory ของ ticket ที่ `grill-to-tickets` ปล่อยไว้ที่
`.scratch/<feature-slug>/issues/` แล้วพาไปเป็นโค้ดที่รันได้จริง บน **hosted model
ตัวเดียวที่ resolve แล้ว pin ไว้ทั้ง run** agent หลัก (**orchestrator**) วางแผน
dependency order เป็น **execution wave** ประเมิน touch-set ของแต่ละ ticket เพื่อ
flag คู่ ticket ที่อาจชนกันใน wave เดียวกัน จากนั้น resolve model ของ run ครั้งเดียว
ก่อน wave 0 แล้ว pin ค่าไว้ใช้กับทุก worker ตลอด run dispatch **worker** ซึ่งเป็น
`opencode run` แบบ headless หนึ่งตัวต่อหนึ่ง ticket ทั้ง ticket ในการ dispatch เดียว
แบบ test-first — ticket อิสระใน wave เดียวกันรันขนานกันได้ คนละ worktree จนถึง
**concurrency cap** — orchestrator ตรวจผลทุก ticket เอง และถ้า ticket ไหน model
ที่ resolve ไว้ทำไม่ได้ **จะ fall back ไป native subagent อัตโนมัติ** ทั้ง ticket
งานที่ผ่านถูกรวมเข้า **integration branch** เป็นหนึ่ง commit ต่อหนึ่ง ticket ทันทีที่
ticket นั้นผ่าน ไม่ต้องรอ wave-mate แล้ว **หยุดก่อน review**

เป็น sibling ของ `agy-implement` (กระจาย spend ข้ามหลาย provider) และ
`subagent-implement` (รักษา context ของ main agent) — ตัวนี้เน้นทำงานบน hosted
model ตัวเดียวที่เลือกไว้ พร้อม fallback tier อัตโนมัติที่ `agy-implement` ไม่มี

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill opencode-implement
```

### ควรใช้เมื่อไร

- มี ticket set จาก `grill-to-tickets` แล้วอยากลง implement ทั้งชุดด้วยคำสั่งเดียว
  บน hosted model ตัวเดียวที่ `opencode` resolve ไว้ (หรือระบุเองด้วย `--model`)
- อยากได้ wave/parallel dispatch แบบเดียวกับ `agy-implement` แต่ยังอยากได้
  automatic fallback ไป native subagent เมื่อ model ที่เลือกทำ ticket ไม่ได้
- อยากได้ TDD บังคับทุก ticket และให้ orchestrator เป็นคนตรวจ ไม่ใช่เชื่อคำ worker
- อยากเห็น token spend ของทั้งสองทาง (`tokens.main`, `tokens.fallback`) แยกกันชัดเจน

### ไม่ควรใช้เมื่อไร

- ยังไม่มี ticket — ใช้ `/grill-to-tickets` ก่อน
- อยากขับทั้ง lifecycle รวม review และ PR — ใช้ `/engineering-workflow`
- ต้องการกระจายงานข้ามหลาย LLM provider ด้วย round-robin failover — ใช้ `/agy-implement`
- อยากให้ context ของ main agent เหลือเยอะโดยใช้ subagent ของ harness เป็นทางหลัก — ใช้ `/subagent-implement`
- เป็น ticket แก้บั๊กหรือ incident — v1 รองรับเฉพาะ feature ticket set
- อยากลง implement เองใน context เดียว — ใช้ `/implement`

### วิธีทำงานหลัก

เรียก `/opencode-implement <dir|slug>` (หรือไม่ใส่ argument เพื่อใช้
`.scratch/*/issues/` ที่แก้ล่าสุด)

1. **Stage 0 — Plan (read-only)**: parse ticket เป็น dependency DAG, คำนวณ
   **execution wave**, ประเมิน touch-set พร้อม flag คู่ ticket ที่อาจชนกันใน wave
   เดียวกัน, เลือก test seam ต่อ ticket แล้วแสดง **Plan** เป็นตาราง wave (ไม่มี
   คอลัมน์ model) พร้อม concurrency cap และ retry budget หยุดรอ approve โดยไม่แตะ
   source
2. **Stage 1 — Execute** (ทีละ wave, frontier order): resolve model ของ run
   ครั้งเดียวก่อน wave 0 แล้ว pin ไว้ dispatch `opencode run` worker หนึ่งตัวต่อ
   หนึ่ง ticket ทั้ง ticket แบบ test-first — serial สำหรับ ticket ที่มี dependency
   edge หรือคู่ที่ผู้ใช้เลือก serialize, parallel สำหรับ ticket อิสระที่เหลือ จนถึง
   concurrency cap — verification gate ที่ orchestrator รันเอง (reproduce red,
   green, typecheck, coverage), auto fallback ไป native subagent ถ้า model ที่
   resolve ไว้ทำไม่ได้ (ไม่มี approval pause), แล้ว squash-merge หนึ่ง commit ต่อ
   ticket ทันทีที่ ticket นั้นผ่าน — ไม่ต้องรอ wave-mate; wave ถัดไปเริ่มก็ต่อเมื่อ
   ทุก ticket ใน wave ปัจจุบันถึงสถานะสุดท้ายแล้วเท่านั้น **Reuse Catalog:** prompt
   ของ worker (และ fallback subagent) มีบรรทัด `**Reuse:**` ของ ticket และตัวชี้
   `docs/reuse-catalog.md` แบบอ่านอย่างเดียว (ถ้ามี) orchestrator เขียนรายการลง
   catalog ใน commit ของแต่ละ ticket ทีละตัว worker จึงแค่อ่าน
3. **Stop — Handoff**: พิมพ์ชื่อ integration branch, ชื่อ model ที่ resolve/pin ไว้,
   สรุป token ทั้งสองทาง (`tokens.main` = spend จริงบน main path,
   `tokens.fallback` = ticket ที่ fallback พร้อมโค้ดที่ออกจากเครื่อง) และคำสั่ง
   `/code-review` + `/scrutinize` ที่ต้องรันต่อใน context ใหม่ ไม่ push ไม่เปิด PR

Seam, Context และ Budget: worker (และ fallback subagent) ใช้ `**Seam:**` ของ
ticket แบบ **verbatim** เป็นขอบเขตเทสต์ ส่วน orchestrator ประกอบ **read list**
ลงใน prompt ของ worker จาก `**Context:**` (spec sections และไฟล์ แยก read /
change / create) พาธใน worktree ของ worker เขียนเป็น relative พาธนอก worktree
เขียนเป็น absolute และ `status.md` เก็บ `budget_estimate` (ข้อความ `**Budget:**`
แบบ verbatim, `none` ถ้าไม่มี) คู่กับ `usage_total` (token จริงรวมทุก usage report
บน path ที่ส่ง ticket, ทั้ง main path และ fallback path)

Run options: `--model provider/model` (ไม่มี default ระดับ skill — ถ้าไม่ระบุ
orchestrator จะ resolve จาก `opencode` เองครั้งเดียวก่อน wave 0 แล้ว pin ไว้ทั้ง
run), `--fallback-agent <name>` (default `general-purpose`), `--no-fallback`
(flag หลักสำหรับปิด fallback ทั้งหมด — `--opencode-only` เป็น alias ปัจจุบัน ตั้งชื่อ
ตามสิ่งที่มันการันตีจริง ๆ ตอนนี้ที่ main path รันบน hosted model ที่ resolve แล้ว;
`--strict-local` เป็น alias แบบ deprecated ที่ยังใช้ได้อีกหนึ่ง release) พารามิเตอร์ที่แก้ได้ตอน approve
Plan: **concurrency cap** (default 4), `FIRST_EVENT_TIMEOUT`, `STALL_INTERVAL`,
`WORKER_TIMEOUT`, `MAX_TICKET_ATTEMPTS`, `MAX_OPENCODE_RETRIES`

sub-command: `continue` resume พร้อม Reality reconciliation, `status` / `list` อ่านอย่างเดียว

### ตัวอย่าง prompt

```text
/opencode-implement .scratch/subtitle-preferences/
```

### ไฟล์ที่เกี่ยวข้อง

- `references/planning.md` — parse ticket, สร้าง/ตรวจ DAG, คำนวณ wave, touch-set hint และ overlap flag, เลือก seam
- `references/worker-contract.md` — model resolution-and-pin, flag ของ `opencode run`, การ parse event stream, timeout/stall, สอง retry rule
- `references/prompt-scaffold.md` — template prompt worker ต่อ ticket ทั้งใบพร้อม red-green-refactor เต็ม และบรรทัด Reuse / Reuse Catalog
- `references/fallback.md` — trigger ของ fallback, การ dispatch subagent, `--opencode-only`
- `references/worktree-integration.md` — preflight, การ dispatch แบบ serial/parallel ใน wave, verification gate, per-ticket integration, การอัปเดต Reuse Catalog
- `references/status-and-resume.md` — wave table, halt report, `status.md`, Reality reconciliation, rewind
- `evals/evals.json` — เคสพฤติกรรม หนึ่งเคสต่อ decision branch, รูปแบบ benchmark ของ `skill-creator`
- `evals/trigger-evals.json` — กันไม่ให้ description อ่านเหมือน model-invocable

## English / ภาษาอังกฤษ

### Purpose

Take a directory of tracer-bullet tickets that `grill-to-tickets` published under
`.scratch/<feature-slug>/issues/` and drive it to working code on **one
resolved, pinned hosted model**. The main agent — the **orchestrator** — plans
the dependency order into **execution waves**, estimates each ticket's
touch-set to flag likely-overlapping same-wave pairs, then resolves the run's
model exactly once, before wave 0, and pins it for every worker for the rest
of the run. It dispatches one headless `opencode run` **worker** per ticket,
whole in one dispatch, test-first — independent tickets in a wave run
concurrently, one worktree each, up to a **concurrency cap**. The orchestrator
verifies every finished ticket itself; and, for any ticket the resolved model
cannot deliver, **automatically falls back** to a native harness subagent for
the whole ticket. Verified work is assembled onto one **integration branch**
as one commit per ticket, as soon as that ticket clears — independent of its
wave-mates — and the run **stops before review**.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill opencode-implement
```

### Use it when

- You have a `grill-to-tickets` ticket set and want to implement the whole
  thing in one command against one hosted model — either the one `opencode`
  already resolves, or one you name with `--model`.
- You want the same wave/parallel dispatch shape as `agy-implement`, but you
  still want an automatic fallback to a native subagent when the chosen model
  can't deliver a ticket.
- You want TDD forced on every ticket and the orchestrator, not the worker,
  running the acceptance checks.
- You want both paths' token spend (`tokens.main`, `tokens.fallback`)
  disclosed separately.

### Do not use it when

- There are no tickets yet — run `/grill-to-tickets` first.
- You want the full lifecycle including review and a PR — use
  `/engineering-workflow`.
- You want the run spread across several providers with round-robin failover
  to dodge rate limits — use `/agy-implement`.
- You want the main agent's context kept lean using the harness's own
  subagents as the primary path — use `/subagent-implement`.
- The tickets are bug fixes or an incident — v1 accepts feature ticket sets only.
- You want to implement it yourself in one context — use `/implement`.

### Main workflow

Invoke `/opencode-implement <dir|slug>` (or with no argument to use the most
recently modified `.scratch/*/issues/` directory).

1. **Stage 0 — Plan (read-only)**: parse the tickets into a dependency DAG,
   compute **execution waves**, estimate touch-sets and flag likely-overlapping
   same-wave pairs, pick a test seam per ticket, and emit the **Plan** as a
   wave table (no model column) with the concurrency cap and retry budgets,
   then pause for explicit approval without touching source.
2. **Stage 1 — Execute** (wave by wave, frontier order): resolve the run's
   model exactly once before wave 0 and pin it, dispatch one `opencode run`
   worker per ticket, whole ticket, test-first — serial across a dependency
   edge or a pair the user chose to serialize, parallel otherwise, up to the
   concurrency cap — run the orchestrator's verification gate on every result
   (reproduce red, run green, typecheck, check coverage), fall back
   automatically to a native subagent for any ticket the resolved model
   cannot deliver, and squash-merge one commit per ticket as soon as it
   clears — independent of its wave-mates. The next wave starts only once
   every ticket in the current one reaches a terminal state. **Reuse Catalog:**
   the worker prompt — and the fallback subagent's, which is the same scaffold —
   carries the ticket's `**Reuse:**` line and, when present, a read-only pointer
   to `docs/reuse-catalog.md`; the orchestrator writes catalog entries inside
   each ticket's squash commit, one ticket at a time, so workers only read it.
3. **Stop — Handoff**: print the integration branch name, the resolved and
   pinned model, per-path token usage (`tokens.main` — real spend against the
   resolved model; `tokens.fallback` — each fallback ticket named with its
   Claude token spend and a note that its code left the machine), and the
   exact `/code-review` and `/scrutinize` commands to run next in a fresh
   context. It never pushes or opens a PR.

Seam, Context, and budget: the worker (and the fallback subagent, which gets the
same scaffold) uses the ticket's `**Seam:**` **verbatim** as its test boundary,
while the orchestrator builds the worker's **read list** into its prompt from the
ticket's `**Context:**` line (spec sections plus files, split into read / change /
create). Paths inside the worker's worktree are **relative**; paths outside it
are **absolute**. `status.md` records each ticket's `budget_estimate` (the
`**Budget:**` text verbatim, or `none`) beside `usage_total` (the ticket's real
token cost, summed over every usage report on the path that delivered it, main
path or fallback).

Run options: `--model provider/model` (no skill-level default — when omitted,
the orchestrator resolves the model once from `opencode` itself, before wave
0, and pins it for the whole run), `--fallback-agent <name>` (default
`general-purpose`), `--no-fallback` (the primary flag to suppress the
fallback tier entirely; `--opencode-only` is its current alias, named for
what it actually guarantees now that the main path runs on a resolved hosted
model; `--strict-local` is a deprecated alias, kept working for one release).
Editable at Plan approval: the **concurrency cap** (default 4), `FIRST_EVENT_TIMEOUT`, `STALL_INTERVAL`,
`WORKER_TIMEOUT`, `MAX_TICKET_ATTEMPTS`, `MAX_OPENCODE_RETRIES`.

Sub-commands: `continue` resumes with Reality reconciliation; `status` and
`list` are read-only.

### Example prompt

```text
/opencode-implement .scratch/subtitle-preferences/
```

### Related files

- `references/planning.md` — parsing the ticket format, building and validating
  the dependency DAG, computing execution waves, the touch-set/overlap-flag
  hint, and test-seam selection
- `references/worker-contract.md` — model resolution-and-pin, the `opencode
  run` invocation, event-stream parsing, timeouts and stall detection, and the
  two retry rules
- `references/prompt-scaffold.md` — the whole-ticket worker prompt template
  with the full red-green-refactor protocol inline, plus the Reuse and Reuse
  Catalog lines
- `references/fallback.md` — the fallback triggers, the subagent dispatch, and
  `--opencode-only`
- `references/worktree-integration.md` — preflight, serial/parallel dispatch
  within a wave, the verification gate, per-ticket integration, and the Reuse
  Catalog update
- `references/status-and-resume.md` — the wave table, the halt report,
  `status.md` fields, Reality reconciliation, and the resume rewind
- `evals/evals.json` — behavioral cases, one per decision branch, in
  `skill-creator`'s benchmark format; run on demand, not in CI
- `evals/trigger-evals.json` — guards that the skill's description does not read
  as model-invocable (the skill is `disable-model-invocation`)
