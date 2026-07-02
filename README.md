# Personal AI Skills

Workspace for building and keeping your own reusable AI-agent workflows. Keep the core instructions vendor-neutral, then add adapter files only when a specific AI tool needs them.

## Layout

Put skills under `skills/`. Group them however makes sense for you:

- `skills/engineering/` - coding, review, debugging, and delivery workflows.
- `skills/productivity/` - writing and operating workflows.
- `skills/misc/` - uncategorized skills kept for later sorting.
- `skills/in-progress/` - drafts that should not be installed by default.
- `skills/deprecated/` - old skills kept for reference.

Each skill is a directory with a required `SKILL.md` containing YAML frontmatter with `name` and `description`. Keep the body as plain Markdown instructions that any AI agent can follow.

Tool-specific metadata can live next to the skill when needed:

- `agents/openai.yaml` - optional OpenAI/Codex UI metadata.
- `.codex-plugin/plugin.json` - optional repository-level Codex plugin adapter.
- Add other adapter metadata only when another AI tool needs it.

## Create a Skill

Create a folder under `skills/` whose folder name matches the skill name:

```text
skills/my-skill/
  SKILL.md
```

Minimal `SKILL.md`:

```markdown
---
name: my-skill
description: Describe what this skill does and the exact situations where an AI agent should use it. Make this specific enough that it triggers only for the right requests.
---

# My Skill

Write the workflow, rules, references, and verification steps an AI agent should follow when this skill is used.
```

## Setup

Validate the repository:

```bash
npm test
```

Or run the validator directly:

```bash
node scripts/validate-skills.mjs
```

Install shippable skills into Codex, if you use Codex:

```bash
./scripts/link-skills.sh
```

By default, `scripts/link-skills.sh` symlinks every skill outside `in-progress`, `deprecated`, and `personal` into `${CODEX_HOME:-$HOME/.codex}/skills`. Override the destination with `CODEX_SKILLS_DIR`:

```bash
CODEX_SKILLS_DIR="$HOME/.codex/skills" ./scripts/link-skills.sh
```
