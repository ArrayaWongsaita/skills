# opencode Implement

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/opencode-implement/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

รับ directory ของ ticket ที่ `grill-to-tickets` / `to-tickets` ปล่อยไว้ที่
`.scratch/<feature-slug>/issues/` แล้วพาไปเป็นโค้ดที่รันได้จริง **บน model local
ที่ฟรี ไม่เสีย API token และโค้ดไม่ออกจากเครื่อง** agent หลัก (**orchestrator**)
วางลำดับงานจาก dependency graph แล้ว **หั่นทุก ticket เป็นลูกโซ่ sub-step** — หนึ่ง
acceptance criterion ต่อหนึ่ง sub-step โดย default — ให้พอดี context window ของ
model จากนั้น dispatch **worker** ซึ่งเป็น `opencode run` แบบ headless หนึ่งตัวต่อ
หนึ่ง sub-step แบบ test-first, orchestrator ตรวจผลทุก ticket เอง, และถ้า ticket ไหน
model local ทำไม่ได้ **จะ fall back ไป native subagent อัตโนมัติ** ทั้ง ticket
งานที่ผ่านถูกรวมเข้า **integration branch** เป็นหนึ่ง commit ต่อหนึ่ง ticket แล้ว
**หยุดก่อน review**

เป็น sibling ของ `agy-implement` (กระจาย spend ข้าม provider) และ
`subagent-implement` (รักษา context ของ main agent) — ตัวนี้เน้น local-first และ
หั่นงานให้พอดี context

**เป็นเครื่องมือ background ที่ช้า** — local inference บน model 27B แบบ serial ใช้
เวลาหลายนาทีต่อ sub-step ดังนั้น ticket set จริงคือ run ที่กินเวลาหลายชั่วโมง เปิด
ทิ้งไว้แล้วเดินจากไป resume ได้ถ้าถูกขัดจังหวะ

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill opencode-implement
```

### ควรใช้เมื่อไร

- มี ticket set จาก `grill-to-tickets` แล้วอยากลง implement ทั้งชุดบน model local
  โดยไม่เสีย API token / quota และให้โค้ดอยู่ในเครื่อง
- ยอมรับได้ว่า run ช้า (หลายชั่วโมง) เพราะแลกกับต้นทุนศูนย์และความเป็นส่วนตัว
- อยากได้ TDD บังคับทุก ticket และให้ orchestrator เป็นคนตรวจ ไม่ใช่เชื่อคำ worker

### ไม่ควรใช้เมื่อไร

- ยังไม่มี ticket — ใช้ `/grill-to-tickets` หรือ `/to-tickets` ก่อน
- อยากขับทั้ง lifecycle รวม review และ PR — ใช้ `/engineering-workflow`
- ต้องการกระจายงานข้ามหลาย LLM provider เพื่อเลี่ยง rate limit — ใช้ `/agy-implement`
- อยากให้ context ของ main agent เหลือเยอะโดยใช้ subagent ของ harness — ใช้ `/subagent-implement`
- เป็น ticket แก้บั๊กหรือ incident — v1 รองรับเฉพาะ feature ticket set
- อยากลง implement เองใน context เดียว — ใช้ `/implement`

### วิธีทำงานหลัก

เรียก `/opencode-implement <dir|slug>` (หรือไม่ใส่ argument เพื่อใช้
`.scratch/*/issues/` ที่แก้ล่าสุด)

1. **Stage 0 — Plan (read-only)**: parse ticket เป็น dependency DAG, คำนวณลำดับ
   dependency, เลือก test seam, สร้าง **step plan** ต่อ ticket (หั่นตาม criterion,
   หั่นย่อยอีกถ้าเกิน context budget), ทำนาย path (`local` / `subagent-fallback`)
   แล้วแสดง **Plan** หยุดรอ approve โดยไม่แตะ source
2. **Stage 1 — Execute** (serial, ทีละ ticket): dispatch `opencode run` worker
   ต่อ sub-step (progress note + checkpoint check ระหว่าง sub-step), verification
   gate ที่ orchestrator รันเอง (reproduce red, green, typecheck, coverage), auto
   fallback ไป subagent ถ้า local ทำไม่ได้, แล้ว squash-merge หนึ่ง commit ต่อ ticket
3. **Stop — Handoff**: พิมพ์ชื่อ integration branch, สรุป token ต่อ path (local =
   ฟรี; ticket ที่ fallback แจ้งว่าใช้ Claude token + โค้ดออกจากเครื่อง) และคำสั่ง
   `/code-review` + `/scrutinize` ที่ต้องรันต่อใน context ใหม่ ไม่ push ไม่เปิด PR

Run options: `--model provider/model` (default `ollama/qwen3.8:27b-mlx-32k`),
`--fallback-agent <name>` (default `general-purpose`), `--no-fallback` /
`--strict-local`

sub-command: `continue` resume พร้อม Reality reconciliation, `status` / `list` อ่านอย่างเดียว

### ตัวอย่าง prompt

```text
/opencode-implement .scratch/subtitle-preferences/
```

### ไฟล์ที่เกี่ยวข้อง

- `references/planning.md` — parse ticket, สร้าง/ตรวจ DAG, ลำดับ dependency, สร้าง step plan ตาม criterion, เลือก seam, ทำนาย path
- `references/worker-contract.md` — flag ของ `opencode run`, การ parse event stream, timeout/stall, smoke test, retry
- `references/prompt-scaffold.md` — template prompt worker ต่อ sub-step พร้อม progress note และ red-green-refactor เต็ม
- `references/decomposition.md` — การรัน step plan, progress note, checkpoint check, re-split ตอน runtime
- `references/fallback.md` — trigger ของ fallback, การ dispatch subagent, `--no-fallback`
- `references/worktree-integration.md` — preflight, วงจร worktree, verification gate, integration
- `references/status-and-resume.md` — halt report, `status.md`, Reality reconciliation, rewind
- `evals/evals.json` — เคสพฤติกรรม หนึ่งเคสต่อ decision branch, รูปแบบ benchmark ของ `skill-creator`
- `evals/trigger-evals.json` — กันไม่ให้ description อ่านเหมือน model-invocable

## English / ภาษาอังกฤษ

### Purpose

Take a directory of tracer-bullet tickets that `grill-to-tickets` published under
`.scratch/<feature-slug>/issues/` and drive it to working code **on a local
model, at zero API cost, without the code leaving the machine**. The main agent —
the **orchestrator** — plans the dependency order, then decomposes every ticket
into an ordered chain of **sub-steps** (one acceptance criterion each by default)
sized to fit the local model's context window. It dispatches one headless
`opencode run` **worker** per sub-step, built test-first; verifies every finished
ticket itself; and, for any ticket the local model cannot deliver — a sub-step
too big to split, three failed verification attempts, or `opencode` failing
repeatedly — **automatically falls back** to a native harness subagent for the
whole ticket. Verified work is assembled onto one **integration branch** as one
commit per ticket, and the run **stops before review**.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill opencode-implement
```

### Use it when

- You have a `grill-to-tickets` ticket set and want to implement the whole thing
  on a local model — no API tokens or quota spent, and the code never leaves the
  machine.
- You accept an hours-long run in exchange for zero cost and privacy.
- You want TDD forced on every ticket and the orchestrator, not the worker,
  running the acceptance checks.

### Do not use it when

- There are no tickets yet — run `/grill-to-tickets` or `/to-tickets` first.
- You want the full lifecycle including review and a PR — use
  `/engineering-workflow`.
- You want the run spread across hosted providers to dodge rate limits — use
  `/agy-implement`.
- You want the main agent's context kept lean with the harness's own subagents —
  use `/subagent-implement`.
- The tickets are bug fixes or an incident — v1 accepts feature ticket sets only.
- You want to implement it yourself in one context — use `/implement`.

### Main workflow

Invoke `/opencode-implement <dir|slug>` (or with no argument to use the most
recently modified `.scratch/*/issues/` directory).

1. **Stage 0 — Plan (read-only)**: parse the tickets into a dependency DAG,
   compute the dependency order, pick a test seam per ticket, build a
   criterion-level **step plan** per ticket (split finer where a criterion
   exceeds the context budget), predict each ticket's path (`local` or
   `subagent-fallback`), emit the **Plan**, and pause for explicit approval
   without touching source.
2. **Stage 1 — Execute** (serial, one ticket at a time): dispatch one `opencode
   run` worker per sub-step (progress note + checkpoint check between sub-steps),
   run the orchestrator's verification gate on every finished ticket (reproduce
   red, run green, typecheck, check coverage), fall back to a native subagent for
   any ticket the local model cannot deliver, then squash-merge one commit per
   ticket.
3. **Stop — Handoff**: print the integration branch name, per-path token usage
   (local is free; each fallback ticket is named with its Claude token spend and
   a note that its code left the machine), and the exact `/code-review` and
   `/scrutinize` commands to run next in a fresh context. It never pushes or
   opens a PR.

Run options: `--model provider/model` (default `ollama/qwen3.8:27b-mlx-32k`),
`--fallback-agent <name>` (default `general-purpose`), `--no-fallback` /
`--strict-local`.

Sub-commands: `continue` resumes with Reality reconciliation; `status` and `list`
are read-only.

### Example prompt

```text
/opencode-implement .scratch/subtitle-preferences/
```

### Related files

- `references/planning.md` — parsing the ticket format, building and validating
  the dependency DAG, the dependency order, criterion-level step-plan
  construction, test-seam selection, and path prediction
- `references/worker-contract.md` — the `opencode run` invocation, event-stream
  parsing, timeouts and stall detection, the preflight smoke test, and retries
- `references/prompt-scaffold.md` — the per-sub-step worker prompt template with
  the progress note and the full red-green-refactor protocol inline
- `references/decomposition.md` — running the step plan, the progress note, the
  checkpoint check, and runtime re-splitting
- `references/fallback.md` — the fallback triggers, the subagent dispatch, and
  `--no-fallback`
- `references/worktree-integration.md` — preflight, the worktree lifecycle, the
  verification gate, and integration
- `references/status-and-resume.md` — the halt report, `status.md` fields,
  Reality reconciliation, and the resume rewind
- `evals/evals.json` — behavioral cases, one per decision branch, in
  `skill-creator`'s benchmark format; run on demand, not in CI
- `evals/trigger-evals.json` — guards that the skill's description does not read
  as model-invocable (the skill is `disable-model-invocation`)
