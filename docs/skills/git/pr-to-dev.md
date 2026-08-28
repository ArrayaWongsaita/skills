# PR to dev

- Category / หมวด: git
- Skill source / source ของ skill: [SKILL.md](../../../skills/git/pr-to-dev/SKILL.md)
- Install source / source สำหรับติดตั้ง: ArrayaWongsaita/skills

## ภาษาไทย / Thai

### มีไว้ทำอะไร

เตรียมงานที่แก้ไว้ในเครื่องอย่างปลอดภัยให้อยู่บน working branch ที่ตรวจสอบแล้ว จากนั้นสร้างหรืออัปเดต Pull Request ที่มี base เป็น dev โดยรักษางานเดิม ตรวจ diff แบบเลือกไฟล์ ตรวจสอบความขัดแย้ง และตรวจ PR หลังสร้าง

### ควรใช้เมื่อไร

- ขอสร้าง PR ไปยัง dev
- ขอเตรียม current changes หรือ branch ปัจจุบันเพื่อ review
- ขอ commit และเปิด PR
- ขอ ship งานปัจจุบันไป dev

### ไม่ควรใช้เมื่อไร

ไม่ใช้สำหรับ merge PR, deploy, release, production rollback, reset หรือ clean repository, ลบ branch หรือ PR, หรือ PR ที่ต้องการ target เป็น main

### วิธีทำงานหลัก

    preflight → fetch origin → analyze state/worktree/scope
    → protect dev → prepare branch → validate
    → selectively stage → verify cached diff → commit
    → rebase origin/dev → conflict gate → validate again
    → inspect full PR diff → push → create/update PR
    → verify PR → report

หลักความปลอดภัยคือไม่ commit บน dev/main/master, ใช้ origin/dev เป็นฐาน, ไม่ใช้ git add . หรือ git add -A, ไม่ใช้ git push --force, ไม่เดาผ่าน conflict ที่มีความเสี่ยงสูง และไม่ทำลายงานของผู้ใช้

### ตัวอย่าง prompt

    Create PR to dev for the current coherent work.

### ติดตั้ง

    npx skills add ArrayaWongsaita/skills --skill pr-to-dev

### ไฟล์ที่เกี่ยวข้อง

- [SKILL.md](../../../skills/git/pr-to-dev/SKILL.md) — workflow และ hard invariants
- [references/workflow.md](../../../skills/git/pr-to-dev/references/workflow.md) — phase contract ครบทุก state
- [references/conflict-resolution.md](../../../skills/git/pr-to-dev/references/conflict-resolution.md) — conflict taxonomy และ safe gate
- [references/validation-strategy.md](../../../skills/git/pr-to-dev/references/validation-strategy.md) — validation, monorepo, lockfile, generated files
- [references/pr-template.md](../../../skills/git/pr-to-dev/references/pr-template.md) — PR template และ truthfulness rules
- [evals/evals.json](../../../skills/git/pr-to-dev/evals/evals.json) — scenario checks A–L

## English / ภาษาอังกฤษ

### Purpose

Safely turn the developer's current coherent local work into a validated working branch and an open Pull Request targeting dev. The skill preserves user work, reviews scope and staged content, rebases on origin/dev, handles conflicts conservatively, reuses existing PRs, and verifies the final PR.

### Use it when

- Creating a PR to dev
- Preparing current changes or an existing feature branch for review
- Committing and opening a PR
- Shipping the current coherent work to dev

### Do not use it when

Do not use it to merge a PR, deploy, release, roll back production, reset or clean a repository, delete a branch or PR, or target main instead of dev.

### Main workflow

    preflight → fetch origin → analyze repository/worktree/scope
    → protect dev → prepare branch → validate
    → selective stage → verify cached diff → commit
    → rebase origin/dev → conflict gate → validate again
    → inspect full PR diff → push → create/update PR
    → verify PR → report

Hard boundaries include no normal commits on dev/main/master, origin/dev as the source of truth, no blind staging, no git push --force, no guessing through high-risk conflicts, no destructive cleanup, no duplicate PRs, and no merge.

### Example prompt

    Create PR to dev for the current coherent work.

### Install

    npx skills add ArrayaWongsaita/skills --skill pr-to-dev

### Related files

- [SKILL.md](../../../skills/git/pr-to-dev/SKILL.md) — workflow and hard invariants
- [references/workflow.md](../../../skills/git/pr-to-dev/references/workflow.md) — contract for every state
- [references/safety-rules.md](../../../skills/git/pr-to-dev/references/safety-rules.md) — automatic, caution, and forbidden actions
- [references/branch-naming.md](../../../skills/git/pr-to-dev/references/branch-naming.md) — branch naming and protected branches
- [references/commit-convention.md](../../../skills/git/pr-to-dev/references/commit-convention.md) — semantic commit messages
- [references/conflict-resolution.md](../../../skills/git/pr-to-dev/references/conflict-resolution.md) — conflict risk and safe resolution
- [references/validation-strategy.md](../../../skills/git/pr-to-dev/references/validation-strategy.md) — validation and repository variants
- [references/pr-template.md](../../../skills/git/pr-to-dev/references/pr-template.md) — PR body and template handling
- [evals/evals.json](../../../skills/git/pr-to-dev/evals/evals.json) — scenario checks A–L
