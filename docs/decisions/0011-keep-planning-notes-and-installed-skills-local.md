# ADR 0011: Keep planning notes and installed skill copies out of the repository

- Status / สถานะ: Accepted / ยอมรับแล้ว
- Date / วันที่: 2026-09-24
- Amends / แก้ไขบริบทของ: ADRs 0003, 0004, 0005, 0006, 0007, 0009

## Context / บริบท

Three dot-directories were tracked on `origin/main` although none of them is part of the skill library that `npx skills add` installs:

- `.scratch/` — specs, ADRs, and tickets that `grill-to-tickets` writes for one feature. `.gitignore` already listed it, but the skill's handoff told the user to commit it, so the files went in with `git add -f`.
- `.agents/skills/` — 8 copies of this repository's own skills and 32 skills from other sources (one carries its own `LICENSE.txt`). They are what `npx skills add` installs into a project.
- `.claude/skills/` — symlinks into `.agents/skills/`.

The tests made the mirror load-bearing: they asserted that each `.agents/skills/<skill>/` copy was byte-identical to `skills/agents/<skill>/`, so CI depended on install output, and one test read a real `.scratch/` feature directory.

มี 3 โฟลเดอร์ที่ถูก track บน `origin/main` ทั้งที่ไม่ใช่ส่วนของ skill library ที่ `npx skills add` ติดตั้ง: `.scratch/` (spec, ADR, ticket ของแต่ละ feature), `.agents/skills/` (สำเนา skill ของเราเอง 8 ตัวและ skill จากที่อื่นอีก 32 ตัว) และ `.claude/skills/` (symlink ไปที่ `.agents/skills/`) ส่วน test บังคับให้สำเนาใน `.agents/` ต้องตรงกับ `skills/` ทุกไบต์ ทำให้ CI พึ่งของที่ติดตั้งมา

## Decision / การตัดสินใจ

1. `skills/` is the only tracked copy of a skill. `.agents/` and `.claude/skills/` are local install output and are git-ignored; a contributor installs with `npx skills add ArrayaWongsaita/skills`.
2. `.claude/settings.json` and `.claude/hooks/` stay tracked, because they are project configuration the guardrail hook depends on. `.claude/worktrees/` and `.claude/settings.local.json` are git-ignored.
3. `.scratch/` is local working state and stays untracked.
   - `grill-to-tickets` checks `git check-ignore -q .scratch/` before its first write and, when the path is not ignored, appends it to the local `info/exclude` file, so the working tree stays clean without a tracked change.
   - Its handoff asks for a commit only of a changed `docs/reuse-catalog.md` and the `AGENTS.md` / `CLAUDE.md` pointer.
   - `subagent-implement`, `agy-implement`, and `opencode-implement` tick a ticket's checkboxes and set its `Status:` on disk when the ticket file is git-ignored, and inside the ticket's commit when it is tracked. A rewind re-opens the invalidated ticket files by hand when they are git-ignored.
4. The tests check the canonical `skills/` copy only. Removed: the mirror byte-identity checks, the check that upstream `grill-with-docs` exists under `.agents/skills/`, and the artifact-tree checks that read a real `.scratch/` feature directory.

1. `skills/` เป็นสำเนาเดียวของ skill ที่ถูก track ส่วน `.agents/` และ `.claude/skills/` เป็นผลจากการติดตั้งและถูก ignore
2. `.claude/settings.json` กับ `.claude/hooks/` ยัง track เพราะเป็น config ของโปรเจกต์ ส่วน `.claude/worktrees/` และ `.claude/settings.local.json` ถูก ignore
3. `.scratch/` อยู่ในเครื่องและไม่ถูก track: `grill-to-tickets` เพิ่ม `.scratch/` ลง exclude ในเครื่องถ้ายังไม่ถูก ignore, handoff ให้ commit เฉพาะ `docs/reuse-catalog.md` และ pointer, implementer ทั้งสามตัวติ๊ก ticket บนดิสก์เมื่อไฟล์ถูก ignore (หรือใน commit เดิมเมื่อ track) และเปิด ticket ที่ถูก rewind กลับเอง
4. test ตรวจเฉพาะสำเนาใน `skills/`

## Consequences / ผลที่ตามมา

- CI no longer depends on install output, and the repository no longer redistributes other authors' skills.
- A fresh clone has no active skills for its own development session until the contributor runs `npx skills add`.
- Earlier commits still hold the removed files; `git rm --cached` drops them from the tip only. Anything from `.scratch/` worth keeping long-term belongs in `docs/decisions/`.
- Checking out a commit that drops tracked files deletes them from an existing working tree, so a checkout that holds local copies of `.scratch/`, `.agents/`, or `.claude/skills/` should back them up before merging this change.
- ADRs 0004–0007 still describe the `.agents/` mirror and the `.claude/skills/` symlink; this ADR supersedes those parts. ADR 0009's byte-identical `grill-with-docs` check no longer applies because that skill is no longer tracked here.

- CI ไม่พึ่งของที่ติดตั้งมา และ repo ไม่แจกจ่าย skill ของคนอื่นซ้ำ
- clone ใหม่จะยังไม่มี skill ใช้ในเซสชันพัฒนาของตัวเองจนกว่าจะรัน `npx skills add`
- history เดิมยังมีไฟล์ที่เอาออก และการ merge เข้า checkout ที่มีสำเนาในเครื่องจะลบไฟล์เหล่านั้นออกจากดิสก์ ควรสำรองก่อน
