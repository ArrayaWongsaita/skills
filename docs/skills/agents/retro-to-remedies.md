# Retro To Remedies

- Category / หมวด: `agents`
- Skill source / source ของ skill: [`SKILL.md`](../../../skills/agents/retro-to-remedies/SKILL.md)
- Install source / source สำหรับติดตั้ง: `ArrayaWongsaita/skills`

## ภาษาไทย / Thai

### มีไว้ทำอะไร

ทบทวน Primary sources ของ Run ที่เสร็จสิ้นแล้วใน workflow เพื่อค้นหาและจำแนก Misses ให้เป็น Remedies สำหรับ Environment อย่างเป็นระบบ นำ Text remedies ที่ผู้ใช้เลือกมา commit ลงบน integration branch บันทึกผลลัพธ์ลงใน `docs/retro-log.md` และส่งมอบ Code remedies ออกไปเป็น prompt สำหรับ `/grill-to-tickets` ก่อนที่จะเปิด Pull Request

Skill นี้อยู่ในลำดับถัดจาก `review-to-pr` และอยู่ก่อน `pr-to-dev`

ติดตั้ง:

```bash
npx skills add ArrayaWongsaita/skills --skill retro-to-remedies
```

### ควรใช้เมื่อไร

- รัน `review-to-pr` บน integration branch เสร็จเรียบร้อยแล้ว และต้องการทบทวนบทเรียนที่เกิดขึ้นใน Run
- มี run-state artifacts ใน `.scratch/<feature-slug>/` (เช่น `review-status.md`, `status.md`, `design-review.md`) และต้องการเปลี่ยนบทเรียนให้เป็น Check, Standard, Pointer, Skill fix, Prune หรือ Access
- ต้องการให้บทเรียนถูกบันทึกอย่างถาวรใน `docs/retro-log.md` ประจำโปรเจกต์ เพื่อไม่ให้เกิด Miss ซ้ำใน Run ถัดไป

### ไม่ควรใช้เมื่อไร

- ยังไม่ได้รัน `review-to-pr` หรือ suite ยังไม่เขียว
- ต้องการแก้โค้ดฟีเจอร์โดยตรง (ข้อบกพร่องในฟีเจอร์ให้ส่งไปที่ `/diagnosing-bugs`)
- กำลังอยู่บน branch `main`, `master`, หรือ `dev` (ต้องทำงานบน working/integration branch เท่านั้น)

### วิธีทำงานหลัก

เรียกใช้ `/retro-to-remedies` หรือ `/retro-to-remedies <feature-slug>` บน integration branch

1. **Stage 0 — Collect (read-only)**: ตรวจสอบ guardrail ของ branch, อ่าน `docs/retro-log.md` เมื่อมีไฟล์อยู่ และถามคำถามติดตามผล (follow-up) สำหรับแต่ละ Remedy ที่ยังอยู่ในสถานะ `handed-off` หนึ่งครั้งก่อนที่จะอ่าน Primary sources: ทำเสร็จแล้ว (`done` → `applied`), ยังรอดำเนินการอยู่ (`still pending` → คงสถานะ `handed-off`), หรือยกเลิก (`drop` → `declined`), อ่าน Primary sources ของ Run ทั้งหมด ได้แก่ `review-status.md` (blocking/carried/unfixable/stalled findings, budget), `status.md` ของ implementer (tickets ที่ attempt > 1, BLOCKED, บทเรียน/gotchas/incidents ใน notes), reports หรือ logs (`reports/<NN>.md`, `logs/<NN>.json[l]`: ข้อผิดพลาดในการ verification), `design-review.md` (รอบที่ไม่ได้ SHIP พร้อม rework kind), และ git history (`fix(review):` commits และ reverts นับตั้งแต่ `review_point` หรือ merge-base กับ `main`) พร้อมทั้งระบุ expected sources ที่สูญหายในส่วนเปิดของรายงาน และถามยืนยันก่อนอ่าน transcript หากไม่มี directory `.scratch/<feature-slug>/` โดยไฟล์ run-state ทั้งหมดจะถูกอ่านตามความหมายและไม่มีการแก้ไขใดๆ Misses ทุกตัวต้องมีพิกัด (location) และข้อความอ้างอิงตรงตัว (verbatim quote)
2. **Stage 1 — Classify and report**: รวม Misses ที่มีสาเหตุเดียวกันเข้าด้วยกัน และจับคู่ candidate Remedies กับ `docs/retro-log.md` ก่อนการจำแนก: Miss ที่ระบุ slug และ location อยู่แล้วใน log ถือเป็นเหตุการณ์เดิม (same occurrence) ไม่นับเป็น recurrence, การเกิดซ้ำ (recurrence) คือ Miss จาก Run อื่นหรือเกิดขึ้นหลัง commit ของ Remedy ใน Run เดียวกัน โดยการเกิดซ้ำของ Remedy ที่เคย `applied` แล้วจะกลายเป็น Failed Remedy ซึ่งจะถูกยกระดับ (escalate) ไปสู่ชนิดที่เข้มงวดขึ้น (Standard → Check สำหรับ mechanical rule; Pointer → ปรับถ้อยคำให้ชัดเจนขึ้นแล้ว inline เนื้อหา; Check หรือ Skill fix → ออก follow-up ชนิดเดิมที่อ้างอิงการเกิดซ้ำ) ส่วน Remedy ที่เคยถูก `declined` จะถูกเสนอใหม่ก็ต่อเมื่อ Miss นั้นเกิดซ้ำหลังการปฏิเสธเท่านั้น โดยจะแสดงหลักฐานทั้งสองครั้ง (both occurrences) ตัดรายการที่ไม่มีหลักฐานทิ้ง (evidence bar), จำแนกเป็น 6 ชนิดของ Remedy ตามลำดับกฎ (Skill fix, Check, Standard หรือ Reuse Catalog Rule, Pointer, Access, Prune), จัดลำดับความสำคัญโดยนำ Failed Remedy ขึ้นก่อน ตามด้วย recurring แล้วจึงตามด้วย cost ranking (blocker, BLOCKED, failed verification, no SHIP) และข้อเสนออื่นๆ, จับคู่ Carried findings ทุกตัวกับ Remedy หรือ proposed decline, และรายงานข้อบกพร่องของฟีเจอร์เป็น Open bugs สำหรับ `/diagnosing-bugs` จากนั้นเขียนรายงานลง `.scratch/<feature-slug>/retro.md` เรียงตาม 6 ส่วน (sources read/missing, handed-off follow-ups, project Remedies, Skill fixes, Carried findings, Open bugs) พร้อมระบุการเปลี่ยนแปลงหรือ prompt อย่างละเอียด และหยุดพัก (pause) รอคำตอบ 4 แบบจากผู้ใช้: `apply` (ใช้ได้เฉพาะ Text remedies), `hand off` (ใช้ได้เฉพาะ Code remedies), `decline`, หรือ `defer`
3. **Stage 2 — Apply and hand off**: นำ Text remedies ที่ได้รับอนุมัติ (`apply`) ไปบันทึกลงปลายทาง: Standard ลงใน `CODING_STANDARDS.md` (สร้างพร้อม short header หากยังไม่มี) หรือลงใน Reuse Catalog's Rules สำหรับ reuse convention; Pointer ลงใน `AGENTS.md`, หรือ `CLAUDE.md`, หรือสร้าง `AGENTS.md` ใหม่; Prune ลบออกจาก instruction file ที่ถืออยู่ จากนั้น commit แต่ละรายการแยกกันเป็น `chore(retro): <remedy>` บน working branch พร้อมกับ entry ของ Remedy นั้นใน `docs/retro-log.md` (สำหรับรอบแรกจะสร้างไฟล์พร้อม self-describing header comment) และ commit ผลลัพธ์อื่นๆ ทั้งหมด (`handed-off`, `declined`, `deferred`) ใน commit สุดท้ายเป็น `chore(retro): log <feature-slug>` โดย id จะอยู่ในรูป `R-<feature-slug>-<NN>` และสถานะของ Outcome คือ `applied`, `handed-off`, `declined`, `deferred` จากนั้นรัน script ตรวจสอบ (`validate`, `check`, `lint`, `test`) หนึ่งรอบ หากผลเป็นสีแดง (red) จะหยุดก่อน handoff พร้อมระบุคำสั่งที่ล้มเหลวและ commit ที่ตามหลัง สำหรับ Code remedies ที่เลือก `hand off` จะแสดงเฉพาะ prompt สำหรับ `/grill-to-tickets` ตามด้วย `/pr-to-dev` โดยไม่มีการ push หรือเปิด pull request

### ตัวอย่าง prompt


```text
/retro-to-remedies
```

### ไฟล์ที่เกี่ยวข้อง

- `references/miss-sources.md` — แหล่ง Primary sources และกฎการดึง Misses
- `references/classification.md` — กฎการจำแนก Remedy 6 ชนิด และการยกระดับ Failed Remedy
- `references/retro-report.md` — โครงสร้างและส่วนต่างๆ ของรายงาน Retro report
- `references/apply-and-handoff.md` — การ commit Text remedies, อัปเดต Log และส่งมอบ handoff
- `references/retro-log.md` — โครงสร้าง schema ของ `docs/retro-log.md`
- `references/skill-fix-routing.md` — การแยกเส้นทาง Skill fix ระหว่าง library ของตัวเองกับ Upstream feedback
- `references/transcript-mode.md` — โหมด `--transcript` และการสืบค้น session transcript
- `references/resume.md` — การทำงานต่อจากรายงานเดิม และโหมด `--fresh`
- `evals/evals.json` — เคสทดสอบพฤติกรรม benchmark
- `evals/trigger-evals.json` — การควบคุม trigger routing

## English / ภาษาอังกฤษ

### Purpose

Review the Primary sources of a finished Run in the workflow to systematically classify Misses into Environment Remedies, commit applied Text remedies directly onto the integration branch, record durable outcomes in `docs/retro-log.md`, and hand off Code remedies as ready-to-run prompts before opening a pull request.

This skill sits after `review-to-pr` and before `pr-to-dev` in the engineering chain.

Install:

```bash
npx skills add ArrayaWongsaita/skills --skill retro-to-remedies
```

### When to Use

- After `review-to-pr` finishes on an integration branch, before running `/pr-to-dev`.
- When run-state artifacts exist under `.scratch/<feature-slug>/` (`review-status.md`, `status.md`, `design-review.md`) and lessons need to be turned into environment checks, standards, pointers, skill fixes, prunes, or access.
- When you want durable recurrence tracking via `docs/retro-log.md` so future runs do not repeat past mistakes.

### When Not to Use

- Before `review-to-pr` has completed verification of the branch.
- To fix bugs in the feature code itself (route defects to `/diagnosing-bugs`).
- Directly on protected branches (`main`, `master`, `dev`).

### How It Works

Invoke `/retro-to-remedies` or `/retro-to-remedies <feature-slug>` on the integration branch.

1. **Stage 0 — Collect (read-only)**: Verifies branch guardrails, reads `docs/retro-log.md` when present, and asks follow-ups for each Remedy still in `handed-off` state once before reading Primary sources: done (`done` → `applied`), still pending (`still pending` → stays `handed-off`), or drop (`drop` → `declined`). Reads all Primary sources left by the Run: `review-status.md` (blocking, carried, unfixable, or stalled findings, and budget cycles), implementer `status.md` (tickets with multiple attempts, BLOCKED tickets, lessons in notes), implementer reports or logs (`reports/<NN>.md`, `logs/<NN>.json[l]` verification failures and reasons), `design-review.md` (cycles without SHIP with their rework kinds), and git history (`fix(review):` commits and reverts since `review_point` or merge-base with `main`). Names missing expected sources in the report's opening section, and asks before reading session transcripts when no `.scratch/<feature-slug>/` exists. Reads all run-state files by meaning and edits none of them; every Miss carries a location and verbatim quote.
2. **Stage 1 — Classify and report**: Merges shared causes into single Remedies and matches candidates against `docs/retro-log.md` before classifying: a Miss whose slug and location the log already lists is the same occurrence, never a recurrence. A recurrence is a Miss from another Run, or from the same Run after the Remedy's commit. A recurrence of an `applied` Remedy makes it a Failed Remedy, which escalates to a stronger kind (Standard → Check where mechanical; Pointer → sharper wording, then inlined material; Check or Skill fix → a follow-up of the same kind citing the recurrence). A `declined` Remedy returns only with a recurrence after the decline, showing both occurrences. Drops proposals lacking evidence, classifies into six Remedy kinds according to the ordered rule (Skill fix, Check, Standard or Reuse Catalog Rule, Pointer, Access, Prune), ranks Failed Remedy first, then recurring, then the cost ranking (blocker, BLOCKED, failed verification, no SHIP) and others, maps every Carried finding to a Remedy or proposed decline, and reports feature defects separately as Open bugs for `/diagnosing-bugs`. Writes the Retro report to `.scratch/<feature-slug>/retro.md` structured in six sequential sections (sources read and missing, handed-off follow-ups, project Remedies, Skill fixes, Carried findings, Open bugs), and pauses for user choices among the four answers: `apply` (valid only for Text remedies), `hand off` (valid only for Code remedies), `decline`, or `defer`.
3. **Stage 2 — Apply and hand off**: Applies each approved Text remedy (`apply`) at its assigned destination: a Standard into `CODING_STANDARDS.md` (created with a short header when absent) or into the Reuse Catalog's Rules for a reuse convention; a Pointer into `AGENTS.md`, else `CLAUDE.md`, else a new `AGENTS.md`; a Prune removed from the project instruction file holding it. Commits each applied Remedy individually as `chore(retro): <remedy>` on the current working branch together with its updated entry in `docs/retro-log.md` (created on the first Retro with its self-describing header comment), and writes its SHA into the Retro report. Records every other Outcome (`handed-off`, `declined`, `deferred`) in `docs/retro-log.md` in one final commit `chore(retro): log <feature-slug>`. Remedy ids are `R-<feature-slug>-<NN>`, numbered within the proposing Run and never change, with Outcomes being `applied`, `handed-off`, `declined`, or `deferred`. Runs each existing `validate`, `check`, `lint`, and `test` script once, stopping on red before handoff naming the failing command and preceding Retro commit. Hands off each Code remedy answered `hand off` as a `/grill-to-tickets` prompt, followed by `/pr-to-dev`. Performs no push and opens no pull request.

### Example Prompt


```text
/retro-to-remedies
```

### Related Files

- `references/miss-sources.md` — Primary sources and miss extraction rules
- `references/classification.md` — Classification rules for 6 remedy kinds and failed remedy escalation
- `references/retro-report.md` — Retro report format and section schema
- `references/apply-and-handoff.md` — Text remedy commit discipline, log updates, and handoff
- `references/retro-log.md` — Schema and lifecycle for `docs/retro-log.md`
- `references/skill-fix-routing.md` — Routing skill fixes between own-library prompts and upstream feedback
- `references/transcript-mode.md` — Transcript discovery and subagent extraction
- `references/resume.md` — Resuming unfinished reports and fresh mode
- `evals/evals.json` — Behavioral evaluation suite
- `evals/trigger-evals.json` — Trigger routing test cases
