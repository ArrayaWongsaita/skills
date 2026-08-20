# Personal AI Skills / คลัง Skill ส่วนตัว

คลัง skill สำหรับ AI coding agents ของ ArrayaWongsaita โดยใช้ `SKILL.md` เป็นคำสั่งสำหรับ agent และใช้เอกสารใน `docs/skills/` เป็นคู่มือสำหรับคน

This repository collects reusable skills for AI coding agents. `SKILL.md` is the agent-facing source of truth; `docs/skills/` contains human-facing guides.

## Requirements / ข้อกำหนด

- Node.js 20 or newer / Node.js 20 ขึ้นไป
- `npx` สำหรับเรียกใช้ `skills` CLI
- AI agent ที่รองรับ Agent Skills และ `SKILL.md`

## Repository layout / โครงสร้าง repo

แต่ละ skill มีหมวดหลักเดียว และชื่อ directory ต้องตรงกับ `name` ใน frontmatter:

Each skill belongs to one primary category, and its directory name must match the `name` in its frontmatter:

```text
skills/
├── agents/
│   ├── agent-instructions-architect/
│   │   └── SKILL.md
│   └── design-task-spec/
│       └── SKILL.md
├── nextjs/
│   └── nextjs-safe-env/
│       └── SKILL.md
└── teaching/
    └── technical-teaching-storytelling/
        └── SKILL.md

docs/
└── skills/
    ├── README.md
    ├── agents/
    │   ├── agent-instructions-architect.md
    │   └── design-task-spec.md
    ├── nextjs/nextjs-safe-env.md
    └── teaching/technical-teaching-storytelling.md
```

Skill อาจมี `references/`, `scripts/`, `tests/`, `evals/` และ metadata เฉพาะ agent เพิ่มเติมได้ แต่ไฟล์คู่มือสำหรับคนต้องอยู่ใน `docs/skills/<category>/<skill>.md`

A skill may also include `references/`, `scripts/`, `tests/`, `evals/`, and agent-specific metadata. Its human guide must live at `docs/skills/<category>/<skill>.md`.

ดูรายการทั้งหมดได้ที่ [Skill Index / ดัชนี Skill](docs/skills/README.md)

## Install skills with `npx skills add` / ติดตั้ง skill

คำสั่งต่อไปนี้ใช้ source ของ repo นี้โดยตรง:

The following commands install directly from this repository:

```text
ArrayaWongsaita/skills
```

ก่อนติดตั้งควรตรวจรายการและอ่านคู่มือของ skill ที่ต้องการก่อน:

Before installing, list the available skills and review the relevant guide:

```bash
npx skills add ArrayaWongsaita/skills --list
```

### Install one skill / ติดตั้ง skill เดียว

```bash
npx skills add ArrayaWongsaita/skills --skill agent-instructions-architect
```

ตัวอย่างอื่น:

```bash
npx skills add ArrayaWongsaita/skills --skill nextjs-safe-env
npx skills add ArrayaWongsaita/skills --skill technical-teaching-storytelling
```

### Install a category group / ติดตั้งทั้งหมวด

หมวดหมู่เป็น convention ของ repo ดังนั้น CLI จะรับรายชื่อ skill ผ่าน `--skill` ทีละตัว เมื่อมีหลาย skill ให้ใช้ `--skill` ซ้ำกัน:

Categories are a repository convention. The CLI receives the skill names explicitly, so repeat `--skill` for every skill in the category:

```bash
npx skills add ArrayaWongsaita/skills \
  --skill agent-instructions-architect \
  --skill design-task-spec
```

คำสั่งของแต่ละหมวดที่สร้างจากรายการปัจจุบันอยู่ใน [Skill Index](docs/skills/README.md)

### Install every skill / ติดตั้งทุก skill

```bash
npx skills add ArrayaWongsaita/skills --all
```

### Project or global scope / ติดตั้งเฉพาะ project หรือทั้งเครื่อง

ค่าเริ่มต้นติดตั้งใน project ปัจจุบัน ใช้ `--global` เมื่อต้องการให้ทุก project ใช้งานได้:

By default, installation targets the current project. Add `--global` to install for all projects:

ถ้าต้องการใช้ skill ใน project อื่น ให้รันคำสั่งจาก project นั้น ไม่ใช่จาก repo คลังนี้ เว้นแต่ตั้งใจให้ CLI สร้าง agent directory ใน repo นี้

To use a skill in another project, run the command from that project instead of this collection repository, unless you intentionally want project-scoped agent directories here.

```bash
npx skills add ArrayaWongsaita/skills \
  --skill nextjs-safe-env \
  --global
```

หากต้องการเลือก agent แบบไม่ interactive ให้เพิ่ม `--agent <agent-name>` และ `--yes` เช่น `--agent codex --yes` ส่วน agent ที่รองรับขึ้นอยู่กับ `skills` CLI

To target a specific agent non-interactively, add `--agent <agent-name>` and `--yes`, for example `--agent codex --yes`. Supported agents are determined by the `skills` CLI.

### Manage installed skills / จัดการ skill ที่ติดตั้งแล้ว

```bash
npx skills list
npx skills update
npx skills remove <skill-name>
```

## Create a skill / สร้าง skill ใหม่

สร้าง directory ตามรูปแบบนี้ และเพิ่มคู่มือคนใน path ที่คู่กัน:

Create the directory and matching human guide:

```text
skills/<category>/<skill-name>/
└── SKILL.md

docs/skills/<category>/<skill-name>.md
```

เริ่ม `SKILL.md` ด้วย frontmatter ที่มี `name` และ `description` ชัดเจน:

Start `SKILL.md` with focused `name` and `description` frontmatter:

```markdown
---
name: my-skill
description: Describe what this skill does and exactly when an AI agent should use it. Make this specific enough to trigger only for the right requests.
---

# My Skill

Write the actionable workflow, constraints, references, and verification steps.
```

ใช้ [skill guide template](docs/templates/skill-guide.template.md) เพื่อให้คู่มือทุก skill มีรูปแบบเดียวกัน

Use the [skill guide template](docs/templates/skill-guide.template.md) to keep guides consistent.

## Validate and update the index / ตรวจสอบและอัปเดต index

```bash
npm test
npm run docs:index
npm run validate
```

เรียก validator โดยตรงได้ด้วย `node scripts/validate-skills.mjs`

You can also run the validator directly with `node scripts/validate-skills.mjs`.

`npm run docs:index` สร้าง [Skill Index](docs/skills/README.md) แบบ deterministic จาก `SKILL.md` ส่วน `npm run validate` ตรวจ metadata, ชื่อซ้ำ, คู่มือที่ขาด และ index ที่ไม่ตรงกัน

`npm run docs:index` deterministically generates the [Skill Index](docs/skills/README.md) from `SKILL.md`. `npm run validate` checks metadata, duplicate names, missing guides, and stale index content.

## Development workflow / workflow การพัฒนา

1. Add or update a skill under `skills/<category>/<skill-name>/`.
2. Add or update its paired guide under `docs/skills/<category>/`.
3. Run `npm run docs:index`.
4. Run `npm test` and `npm run validate`.
5. Review the diff for secrets, machine-specific values, stale links, and inaccurate install commands.
