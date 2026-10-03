# PR to base

- Category / หมวด: git
- Skill source / source ของ skill: [SKILL.md](../../../skills/git/pr-to-base/SKILL.md)
- Install source / source สำหรับติดตั้ง: ArrayaWongsaita/skills

## ภาษาไทย / Thai

### มีไว้ทำอะไร

เตรียมงานที่แก้ไว้ในเครื่องอย่างปลอดภัยให้อยู่บน working branch ที่ตรวจสอบแล้ว จากนั้นสร้างหรืออัปเดต Pull Request ที่มี base เป็น base branch ที่ระบุ (ค่าเริ่มต้น dev) โดยรักษางานเดิม ตรวจ diff แบบเลือกไฟล์ ตรวจสอบความขัดแย้ง และตรวจ PR หลังสร้าง

### ควรใช้เมื่อไร

- ขอสร้าง PR ไปยัง dev หรือ branch อื่นที่ระบุ (`/pr-to-base release/1.2`; ไม่ระบุใช้ dev)
- ขอเตรียม current changes หรือ branch ปัจจุบันเพื่อ review
- ขอ commit และเปิด PR
- ขอ ship งานปัจจุบันไป dev

### ไม่ควรใช้เมื่อไร

ไม่ใช้สำหรับ merge PR, deploy, release, production rollback, reset หรือ clean repository, ลบ branch หรือ PR, หรือ PR ที่ต้องการ target เป็น main

### วิธีทำงานหลัก

    preflight → fetch origin → analyze state/worktree/scope
    → prove clean completion → protect base → prepare branch → validate
    → selectively stage → verify cached diff → commit
    → capture remote feature SHA → rebase origin/<base> → conflict gate
    → validate again → inspect full PR diff → verify base freshness
    → exact-lease push when rewritten → create/update PR
    → verify PR → report

หลักความปลอดภัยคือไม่ commit บน <base>/dev/main/master, ใช้ origin/<base> เป็นฐาน, หยุดก่อน commit ถ้างาน tracked ที่ไม่เกี่ยวข้องจะขวาง rebase, ตรวจว่า origin/<base> ยังเป็น SHA ที่ validate แล้วก่อน push, ใช้ exact-SHA lease เมื่อ rewrite, ไม่ใช้ git add . หรือ git add -A, ไม่ใช้ git push --force, ไม่เดาผ่าน conflict ที่มีความเสี่ยงสูง และไม่ทำลายงานของผู้ใช้

### ตัวอย่าง prompt

    Create PR to dev for the current coherent work.

### ติดตั้ง

    npx skills add ArrayaWongsaita/skills --skill pr-to-base

### ไฟล์ที่เกี่ยวข้อง

- [SKILL.md](../../../skills/git/pr-to-base/SKILL.md) — workflow และ hard invariants
- [references/workflow.md](../../../skills/git/pr-to-base/references/workflow.md) — exceptional state evidence, resume และ recovery
- [references/conflict-resolution.md](../../../skills/git/pr-to-base/references/conflict-resolution.md) — conflict taxonomy และ safe gate
- [references/validation-strategy.md](../../../skills/git/pr-to-base/references/validation-strategy.md) — validation, monorepo, lockfile, generated files
- [references/pr-template.md](../../../skills/git/pr-to-base/references/pr-template.md) — PR body ที่ขึ้นต้นด้วย Summary, Evidence (before/after) และ Merge Danger (one-way/two-way door, blast radius) พร้อม truthfulness rules
- [evals/evals.json](../../../skills/git/pr-to-base/evals/evals.json) — 22 scenario checks

## English / ภาษาอังกฤษ

### Purpose

Safely turn the developer's current coherent local work into a validated working branch and an open Pull Request targeting a base branch — `dev` by default, or the branch named in the invocation (`/pr-to-base release/1.2`). The skill preserves user work, reviews scope and staged content, rebases on origin/dev, handles conflicts conservatively, reuses existing PRs, and verifies the final PR.

### Use it when

- Creating a PR to dev (the default) or to a named base branch
- Preparing current changes or an existing feature branch for review
- Committing and opening a PR
- Shipping the current coherent work to dev

### Do not use it when

Do not use it to merge a PR, deploy, release, roll back production, reset or clean a repository, delete a branch or PR, or open a PR whose base cannot be resolved to one branch.

### Main workflow

    preflight → fetch origin → analyze repository/worktree/scope
    → prove clean completion → protect base → prepare branch → validate
    → selective stage → verify cached diff → commit
    → capture remote feature SHA → rebase origin/<base> → conflict gate
    → validate again → inspect full PR diff → verify base freshness
    → exact-lease push when rewritten → create/update PR
    → verify PR → report

Hard boundaries include no normal commits on <base>/dev/main/master, origin/<base> as the source of truth, early stop when unrelated tracked work would block rebase, no stale-base push, an exact expected remote SHA for rewritten pushes, no blind staging, no git push --force, no high-risk conflict guesses, no destructive cleanup, no duplicate PRs, and no merge.

### Example prompt

    Create PR to dev for the current coherent work.

### Install

    npx skills add ArrayaWongsaita/skills --skill pr-to-base

### Related files

- [SKILL.md](../../../skills/git/pr-to-base/SKILL.md) — workflow and hard invariants
- [references/workflow.md](../../../skills/git/pr-to-base/references/workflow.md) — exceptional-state evidence, resume, and recovery
- [references/safety-rules.md](../../../skills/git/pr-to-base/references/safety-rules.md) — automatic, caution, and forbidden actions
- [references/branch-naming.md](../../../skills/git/pr-to-base/references/branch-naming.md) — branch naming and protected branches
- [references/commit-convention.md](../../../skills/git/pr-to-base/references/commit-convention.md) — semantic commit messages
- [references/conflict-resolution.md](../../../skills/git/pr-to-base/references/conflict-resolution.md) — conflict risk and safe resolution
- [references/validation-strategy.md](../../../skills/git/pr-to-base/references/validation-strategy.md) — validation and repository variants
- [references/pr-template.md](../../../skills/git/pr-to-base/references/pr-template.md) — PR body led by Summary, Evidence (before/after), and Merge Danger (one-way/two-way door, blast radius), plus template handling
- [evals/evals.json](../../../skills/git/pr-to-base/evals/evals.json) — 22 scenario checks
