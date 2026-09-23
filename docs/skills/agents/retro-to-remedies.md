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

1. **Stage 0 — Collect (read-only)**: ตรวจสอบ guardrail ของ branch, อ่าน `docs/retro-log.md` เพื่อติดตามรายการที่ค้างอยู่, อ่าน Primary sources ใน `.scratch/<feature-slug>/` และ git history, ดึง Misses พร้อม quote และพิกัดอ้างอิง
2. **Stage 1 — Classify and report**: รวม Misses ที่มีสาเหตุเดียวกัน, เทียบกับประวัติใน Retro Log, จำแนกเป็น 6 ชนิดของ Remedy (Check, Standard, Pointer, Skill fix, Prune, Access), จัดลำดับความสำคัญ, เขียนรายงานลง `.scratch/<feature-slug>/retro.md` และหยุดพัก (pause) เพื่อรอให้ผู้ใช้เลือก action สำหรับแต่ละข้อ (`apply`, `hand off`, `decline`, `defer`)
3. **Stage 2 — Apply and hand off**: commit Text remedies ที่อนุมัติลงบน integration branch (`chore(retro): <remedy>`), อัปเดต `docs/retro-log.md`, รัน validation/tests หนึ่งรอบ, และแสดง handoff prompt สำหรับ Code remedies ก่อนจบด้วย `/pr-to-dev`

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

1. **Stage 0 — Collect (read-only)**: Verifies branch guardrails, reads `docs/retro-log.md` for pending items, collects Primary sources in `.scratch/<feature-slug>/` and git history, and extracts Misses with source locations and verbatim quotes.
2. **Stage 1 — Classify and report**: Merges shared causes, matches against historical log entries, classifies into six Remedy kinds (Check, Standard, Pointer, Skill fix, Prune, Access), ranks by severity, writes `.scratch/<feature-slug>/retro.md`, and pauses for user choices (`apply`, `hand off`, `decline`, `defer`).
3. **Stage 2 — Apply and hand off**: Commits approved Text remedies as `chore(retro): <remedy>`, updates `docs/retro-log.md`, executes repository validation checks once, and presents handoff prompts for Code remedies before recommending `/pr-to-dev`.

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
