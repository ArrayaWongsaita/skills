# Grill to Tickets

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/grill-to-tickets/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

พา idea เดียวจากการสัมภาษณ์แบบ relentless ไปจนถึง ticket ที่พร้อมให้ agent หยิบทำ แล้ว **หยุด**
โดยรัน `grilling` และ `domain-modeling` แบบ inline ต่อเนื่องใน context เดียว
เขียน spec ตาม `references/spec-format.md` และ ticket ตาม `references/ticket-format.md`
ซึ่งเป็นรูปแบบที่ skill เป็นเจ้าของเอง (ดัดแปลงจาก upstream พร้อมแนบ `UPSTREAM-LICENSE.md`)
มี 2 ขั้นตอนที่ dispatch subagent: Stage 2 ส่ง `scrutinize` รีวิว spec ใน context ใหม่ และ Stage 3 ส่ง fresh reviewer ทำ Ticket review เพื่อหา ambiguity ในชุด ticket; skill ไม่ลงมือ implement และไม่แตะ `grill-with-docs` หรือ skill ของ Matt Pocock

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill grill-to-tickets
```

ต้องมี stage skill อีก 3 ตัว (`grilling`, `domain-modeling`, `scrutinize`) ตอนเริ่ม **Preflight** จะหาใน `.agents/skills/`, `.claude/skills/`, `~/.agents/skills/` และ `~/.claude/skills/` ตามลำดับ ถ้าขาดตัวไหนจะหยุดและพิมพ์คำสั่ง `npx skills add ...` ของตัวที่ขาด พร้อมบันทึก path และค่า hash ที่ lock ของแต่ละตัวถืออยู่ตามที่ lock เขียนไว้ (ไม่คำนวณหรือเทียบใหม่; ใช้ `npx skills check` เช็ก update) ไม่ต้องตั้งค่า issue tracker เพราะไฟล์ใน `.scratch/` คือ tracker

### ควรใช้เมื่อไร

- มี idea ใหม่และอยากได้ spec + ticket ที่ผ่าน design review ก่อนเริ่มเขียนโค้ด
- อยากให้ขั้น discovery, spec และ ticket อยู่ใน context window เดียวเพื่อรักษาคุณภาพการคิด
- ต้องการ design review gate ที่ผู้ใช้กำหนดจำนวนรอบเอง (default 3, `--review N`, 0 คือข้าม), ตรวจจับ stall และแยก rework สองแบบ

### ไม่ควรใช้เมื่อไร

- ถ้าต้องการให้ทำถึงขั้น implement และ review โค้ดใน run เดียว ใช้ `/engineering-workflow` (หรือทำต่อจาก ticket ด้วย `/subagent-implement` แล้วตามด้วย `/review-to-pr`)
- ถ้าต้องการแค่ discipline เดียว เรียก `/grilling`, `/scrutinize` ตรง ๆ

### วิธีทำงานหลัก

เรียก `/grill-to-tickets <idea>` หรือ `$grill-to-tickets <idea>` (ถ้า run ค้างกลางทาง เช่นหลัง `/clear` ให้เรียก `/grill-to-tickets continue <feature-slug>` เพื่อทำต่อจาก State ใน `decisions.md`) จากนั้น:

1. **Stage 0 — Grill**: สัมภาษณ์แบบ design tree พร้อมทำ domain modeling เขียน `CONTEXT.md` / `adr/` ทันทีที่ term นิ่ง บันทึกทุกคำถามและคำตอบลง **Decision Log** (`decisions.md`) ก่อนถามรอบถัดไป เมื่อ frontier ว่างจะทำ **Blind-spot pass** ไล่ 9 หมวด (scope, data, flow, quality attributes, integrations, edge cases, constraints, terminology, completion signals) ช่องว่างที่เปลี่ยน spec ได้จะถูกถามเป็นรอบสุดท้ายไม่เกิน 5 ข้อ ที่เหลือเขียนเป็นสมมติฐานให้เห็น แล้วหยุดขอ confirmation
2. **Stage 1 — Spec**: เขียน `spec.md` ตาม `spec-format.md` โดยสังเคราะห์ `decisions.md`, glossary และ ADR โดยไม่สัมภาษณ์ซ้ำ ทุก user story ใหม่มี Scenario แบบบรรทัดเดียว `Scenario: given … when … then …` ใต้ story อย่างน้อยหนึ่งบรรทัดเพื่อให้มีตัวอย่างที่ทดสอบได้; spec เก่าที่ไม่มี Scenario ยังผ่านพร้อม warning ทุกการตัดสินใจใน log ต้องอยู่ใน spec
3. **Stage 2 — Design Review Gate**: ผู้ใช้กำหนดขอบเขตการรีวิวเอง (เสนอ 3 รอบ, `0` คือข้าม, หรือใช้ `--review N`); ดู routing, resume และทางออกเมื่อหมดรอบหรือติด stall ได้ที่ [สัญญา Design Review Gate](../../../skills/agents/grill-to-tickets/references/design-review-gate.md)
4. **Stage 3 — Tickets**: หลัง `SHIP`, การข้ามด้วย `0`, หรือผู้ใช้เลือกไปต่อหลังหมดรอบ/ติด stall ให้เขียน ticket ตาม `ticket-format.md` ลง `.scratch/<feature-slug>/issues/` ทุก ticket มีบรรทัด `**Stories:**` บอกเลข user story ที่ ticket นั้นส่งมอบ, `**Seam:**` (ขอบเขตทดสอบเดียวจาก Testing Decisions ของ spec), `**Context:**` (Read set ของ worker: `spec §` refs และไฟล์ พร้อม marker อ่านอย่างเดียว / `(edit)` / `(new)` / `(from NN)` / `(edit from NN)`) และ `**Budget:**` (ผลวัดของ checker: read tokens, จำนวน criteria, จำนวน modules) ก่อน quiz ต้องรัน `scripts/check-tickets.mjs` พร้อม `--write-budget` ให้ผ่าน (ทุก story มี ticket, Blocked by ชี้ ticket ที่มีจริงและเลขต่ำกว่า, Seam/Context/Budget ครบ เป็นบรรทัดเดียว เรียงถูก) checker ออก warning 3 แบบ (ไม่เปลี่ยนผลลัพธ์): acceptance criterion ที่พูดถึงการรัน suite หรือ tool (`npm test`, `tests pass`, `typecheck passes`, `lint passes`, `suite passes`); ticket สองใบที่แก้ path เดียวกัน (`(edit)`, `(new)` หรือ `(edit from NN)`) โดยไม่มีใบไหน block อีกใบทางอ้อม; และ feature ที่มีเกิน 15 ticket warning ทุกตัวต้องถูกบันทึกใต้ `## Ticket warnings` ใน `decisions.md` เป็น `<warning> — acknowledged` หรือ `<warning> — fixed: <change>` ตรวจ Scenario line ว่ามี given, when, then ตามลำดับและทุก story มี Scenario (spec เก่าที่ไม่มีเลยเป็น warning); เมื่อใช้ --write-budget แล้ว checker ผ่าน จะเขียน manifest.json ซึ่งเก็บ spec fingerprint, DAG และ planning facts โดยไม่มี Status หรือ timestamp; หลัง checker PASS ก่อน quiz ทำ Ticket review (Stage 3.5) โดย dispatch fresh reviewer อ่าน ticket set กับไฟล์ใน Context แล้วคืน READY หรือ ASK พร้อมคำถามสำหรับทุกใบ (ดูเฉพาะ ambiguity ไม่ใช่ Budget checkและไม่กำหนด limit; ทำหนึ่งครั้งเป็นค่าเริ่มต้นและ --ticket-review 0 ใช้ข้ามได้); quiz แสดง ASK ข้าง Seam, Context และ Budget ให้คนเลือก fix หรือ acknowledge แล้ว main thread แก้และรัน checker ด้วย --write-budget ซ้ำ พร้อมบันทึก verdict และผลใน ## Ticket review; continue คง State done หรือ skipped และไม่เริ่ม review ซ้ำเว้นแต่ผู้ใช้ขอ; แล้วแสดงตาราง story coverage, ตาราง budget และ DAG summary ใน quiz
5. **Stop**: บอกว่า `.scratch/` อยู่ในเครื่องและถูก git ignore (ก่อนเขียนไฟล์แรก skill จะเช็ก `git check-ignore` และเพิ่ม `.scratch/` ลง `.git/info/exclude` ให้ถ้ายังไม่ถูก ignore) จึงไม่ต้อง commit แล้วพิมพ์ `/clear` ตามด้วย `/subagent-implement .scratch/<feature-slug>/` (หรือ `/agy-implement` / `/opencode-implement`) โดยเลือกตัวที่แนะนำจากบรรทัด `recommended implementer` ใน DAG summary ของ checker (เลือกจาก maximum wave width: 1 → `subagent-implement`, 2 → ทั้งสามตัว, 3 ขึ้นไป → `agy-implement` หรือ `opencode-implement` เป็นคำแนะนำเท่านั้น) ไม่เรียก implementer เอง

`REWORK` แบบ spec-level รัน Stage 1 ใหม่และอยู่ใน Stage 2 ส่วน decision-level กลับไป Stage 0 เพื่อ grill
การตัดสินใจนั้นใหม่ โดย cycle counter ไม่ถูก reset

### ตัวอย่าง prompt

```text
/grill-to-tickets เพิ่มการตั้งค่าขนาดฟอนต์ subtitle ในหน้า player settings ให้ผู้ใช้ปรับเองได้และจำค่าไว้ต่อเครื่อง
```

### ไฟล์ที่เกี่ยวข้อง

- `references/spec-format.md` — รูปแบบ spec ที่ skill เป็นเจ้าของ ดัดแปลงจาก upstream พร้อมบรรทัดแหล่งที่มาและ MIT notice
- `references/ticket-format.md` — รูปแบบ ticket ที่ skill เป็นเจ้าของ พร้อมฟิลด์ Seam, Context และ Budget ดัดแปลงจาก upstream พร้อมบรรทัดแหล่งที่มาและ MIT notice
- `references/ticket-review.md` — brief และ return format `READY` / `ASK` ของ Ticket review ใน Stage 3.5
- `.scratch/<feature-slug>/manifest.json` — snapshot ที่ checker เขียนเมื่อ `--write-budget` ผ่าน เก็บ spec fingerprint, DAG และข้อมูล ticket ตอนวางแผน
- `references/UPSTREAM-LICENSE.md` — MIT notice ของ upstream ที่รูปแบบทั้งสองแนบไว้
- `references/decision-log.md` — รูปแบบของ Decision Log (`decisions.md`) เวลาที่ต้องเขียน และขั้นตอน `continue <feature-slug>`
- `references/blind-spot-pass.md` — 9 หมวดที่ต้องไล่ก่อนหยุดพักท้าย Stage 0 (ดัดแปลงจาก `/clarify` ของ Spec Kit) วิธีให้คะแนน และเพดาน 5 คำถาม
- `references/design-review-gate.md` — source เดียวของ routing table เต็ม, cycle accounting, stall detection, gate report format (SKILL.md Stage 2 เก็บแค่สรุปสั้น ๆ ต่อ verdict แล้วชี้มาที่นี่)
- `scripts/check-tickets.mjs` — สคริปต์ Node (ไม่มี dependency) ตรวจ Scenario rules (given, when, then ตามลำดับและ Scenario ครบทุก story), story coverage, Blocked by, Seam, Context และ Budget; เมื่อใช้ `--write-budget` จะเขียน Budget line และ `manifest.json` เมื่อ PASS พร้อม warning, ตาราง story coverage, budget, DAG summary และ recommended implementer (exit 0 ผ่าน, 1 มี error, 2 อินพุตใช้ไม่ได้)
- `evals/evals.json` — เคสพฤติกรรมในรูปแบบ benchmark ของ `skill-creator`: อย่างน้อยหนึ่งเคสต่อ routing branch ของ Design Review Gate, หนึ่งเคสต่อกลไกป้องกัน (decision log, `continue`, blind-spot pass, reviewer ใน context ใหม่, การไล่แก้หลัง `FIX_THEN_SHIP`, สคริปต์ตรวจ ticket) และเคส `quality:` ที่วัดคุณภาพของคำถาม spec และ ticket รันแบบ on-demand ไม่ได้อยู่ใน CI เวลา benchmark ให้ใช้ snapshot ของ skill เวอร์ชันก่อนหน้าเป็น baseline แบบ `old_skill` ของ `skill-creator`
- `evals/trigger-evals.json` — กันไม่ให้ description ของ skill อ่านเหมือนเป็น model-invocable (skill นี้เป็น `disable-model-invocation`)

## English / ภาษาอังกฤษ

### Purpose

Carry one idea from a relentless discovery interview through to published,
ticket-ready work, then stop. It inline-executes `grilling` and `domain-modeling`
in a single continuous context window, writes `spec.md` from its owned
`references/spec-format.md` and tickets from its owned
`references/ticket-format.md` (adapted upstream, notice carried in
`UPSTREAM-LICENSE.md`). Two steps dispatch a subagent: Stage 2 sends
`scrutinize` for the spec review, and Stage 3 sends a fresh reviewer for the
ticket review. It never implements, and it never touches `grill-with-docs` or
any Matt Pocock-sourced skill.

Install with:

```bash
npx skills add ArrayaWongsaita/skills --skill grill-to-tickets
```

The three stage skills — `grilling`, `domain-modeling`, `scrutinize` — must be
installed too. A **Preflight** looks for each in `.agents/skills/`,
`.claude/skills/`, `~/.agents/skills/`, then `~/.claude/skills/`, and stops
before Stage 0 with the `npx skills add` line of any that is missing. For each
one it finds, it records the path and the hash the lock holds, exactly as the
lock holds it (no recomputation or comparison; `npx skills check` is the update
tool). No issue tracker is needed: the files under `.scratch/` are the tracker.

### Use it when

- You have a fresh idea and want a design-reviewed spec plus tickets before any code.
- You want discovery, specification, and ticket breakdown to share one context
  window so reasoning stays sharp across the whole planning pass.
- You want a design-review gate whose rounds you choose (default 3, `--review N`, 0 skips), stall detection, and
  a spec-level / decision-level rework split.

### Do not use it when

- You want one run to continue into implementation and code review — use
  `/engineering-workflow` (or continue from the tickets with
  `/subagent-implement`, then `/review-to-pr`).
- You only need one discipline — call `/grilling` or `/scrutinize` directly.

### Main workflow

Invoke `/grill-to-tickets <idea>` or `$grill-to-tickets <idea>`; resume an
interrupted run with `/grill-to-tickets continue <feature-slug>`. The skill runs
four stages — Grill, Spec, Design Review Gate, Tickets — writing every feature
artifact under `.scratch/<feature-slug>/`. Stage 0 interviews the
user as a design tree and does domain modeling. Every question and answer is logged in the Decision Log
(`decisions.md`) before the next round, together with the run's State, so a
resumed run and Stage 1 read decisions from a file rather than from recall.
Before the Stage 0 pause, a blind-spot pass marks nine fixed categories (scope,
data, flow, quality attributes, integrations, edge cases, constraints,
terminology, completion signals); gaps that would change the spec become one
final round of at most five questions, and the rest become stated assumptions
shown in the pause summary.
Stage 1 writes the spec from that log following its owned
`references/spec-format.md`; every new user story has at least one indented,
one-line `Scenario: given … when … then …` example so its behavior can be
tested. Each Design Review Gate cycle dispatches
`scrutinize` to a fresh, read-only reviewer subagent that sees the files and not
the interview, so it reads the spec the way the implementer will (ADR 0010). The
user sets the review budget; the proposed default is three rounds, zero skips
review, and `--review N` answers up front. See the [canonical Design Review
Gate contract](../../../skills/agents/grill-to-tickets/references/design-review-gate.md)
for verdict routing, resume, and the exhaustion or stall path. After `SHIP`, a
recorded `0` skip, or the user's choice to go on after exhaustion or stall,
tickets are published from the owned `references/ticket-format.md` — every ticket with a
`**Stories:**` line naming the spec stories it delivers, a `**Seam:**` line
naming one test boundary from the spec, a `**Context:**` line listing the Read
set (spec sections and files, marked read-only, `(edit)`, `(new)`, `(from NN)`,
or `(edit from NN)`), and a `**Budget:**` line recording the checker's
measurement (read tokens, criteria, modules). Before the quiz, the
bundled `scripts/check-tickets.mjs` runs with `--write-budget`, which writes
each Budget line from the measurement and must pass: every story has a ticket,
every blocker exists with a lower number, and Seam / Context / Budget are
present, single-line, ordered, and real; the quiz shows the story-coverage table, the budget table, the
DAG summary, and every warning. A scenario line carries `given`, `when`, and
`then` in that order; an older spec with no scenarios gets a warning, while a
partial or malformed set is an error. A passing `--write-budget` run writes
the derived `.scratch/<feature-slug>/manifest.json` with the spec fingerprint,
DAG, and planning-time ticket facts; it has no `Status` or timestamp. Stage
3.5 then runs one fresh Ticket review after checker PASS and before the quiz:
the reviewer reads the ticket set and each ticket's `**Context:**` paths, then
returns `READY` or `ASK: <question>` for every ticket. It reads for ambiguity
only, sets no limit, and is not a Budget check; `--ticket-review 0` skips the
default one pass. The quiz shows each `ASK` question beside its ticket's Seam,
Context, and Budget; the main thread fixes or acknowledges it, reruns the
checker with `--write-budget`, and records the verdict and resolution under
`## Ticket review`. `continue` keeps a recorded `done` or `skipped` state,
and a second review starts only when the person asks. The checker warns on an acceptance criterion
that mentions a suite or tool run (`npm test`, `tests pass`, `typecheck passes`,
`lint passes`, `suite passes`), on two tickets that change the same path —
`(edit)`, `(new)`, or `(edit from NN)` — when neither transitively blocks the
other, and on more than 15 tickets; a warning never changes the result. Each
warning is logged under `## Ticket warnings` in `decisions.md` as
`<warning> — acknowledged` or `<warning> — fixed: <change>`. Then the skill
prints a handoff in this order: `/clear`, the DAG summary
carrying the `recommended implementer` (chosen by maximum wave width:
1 → `subagent-implement`, 2 → all three, 3 or more → `agy-implement` or
`opencode-implement`; advice only, you choose), and the implementer command (`.scratch/` is local and git-ignored, so nothing needs a commit; the command is
`/subagent-implement .scratch/<feature-slug>/` or its `agy` / `opencode`
siblings) and stops.

### Example prompt

```text
/grill-to-tickets Add a local subtitle font-size preference to the player settings panel, adjustable by the user and remembered per device.
```

### Related files

- `references/spec-format.md` — the owned spec format, adapted upstream with its
  source line and the MIT notice
- `references/ticket-format.md` — the owned ticket format with the Seam,
  Context, and Budget fields, adapted upstream with its source line and the MIT
  notice
- `references/ticket-review.md` — the fresh reviewer's brief and `READY` / `ASK`
  return format for the Stage 3.5 ambiguity review
- `.scratch/<feature-slug>/manifest.json` — the derived snapshot written by a
  passing `--write-budget` run, with the spec fingerprint, DAG, and ticket facts
- `references/UPSTREAM-LICENSE.md` — the upstream MIT notice both formats carry
- `references/blind-spot-pass.md` — the nine categories checked before the
  Stage 0 pause (adapted from Spec Kit's `/clarify`), the marks, and the
  five-question cap
- `references/decision-log.md` — the Decision Log format, when to write it, and
  the `continue <feature-slug>` resume procedure
- `references/design-review-gate.md` — the single source for the full routing
  table, cycle accounting, stall detection, and the per-cycle gate report format;
  SKILL.md Stage 2 keeps only a brief per-verdict summary and points here
- `scripts/check-tickets.mjs` — a dependency-free Node checker run before the
  Stage 3 quiz: Scenario rules, story coverage and blockers, plus Seam, Context, and Budget (single line, ordered, real
  paths and spec sections). With `--write-budget` it measures each ticket and
  writes its Budget line and the derived `manifest.json` on PASS; it warns without ever failing the result, and prints
  the story-coverage table, the budget table, and the DAG summary with a
  recommended implementer (exit 0 clean, 1 errors, 2 unusable input)
- `evals/evals.json` — behavioral cases in `skill-creator`'s benchmark format:
  at least one per Design Review Gate routing branch, one
  per planning safeguard (decision log, `continue`, blind-spot pass, fresh
  reviewer, the `FIX_THEN_SHIP` sweep, the ticket checker), and `quality:` cases
  that grade the interview, the spec, and the tickets; run on demand, not in CI,
  benchmarked against a snapshot of the previous skill version as
  `skill-creator`'s `old_skill` baseline
- `evals/trigger-evals.json` — guards that the skill's description does not read
  as model-invocable (the skill is `disable-model-invocation`)
