# Personal AI Skills

Workspace for building and maintaining reusable AI-agent workflows. Skills are kept vendor-neutral where possible, with adapter metadata added only when a specific AI tool needs it.

## Requirements

- Node.js 20 or newer
- An AI agent that supports `SKILL.md`-based skills

## Repository layout

Skills live under `skills/` and are grouped by domain:

```text
skills/
└── engineering/
    ├── nextjs/
    │   └── nextjs-safe-env/
    └── production-project-governance-bootstrap/
```

Each skill is a directory containing a required `SKILL.md` file. A skill may also include references, scripts, evaluation fixtures, templates, or tool-specific metadata.

Optional adapter files include:

- `agents/openai.yaml` for OpenAI/Codex UI metadata.
- `.codex-plugin/plugin.json` for exposing the workspace as a Codex plugin.

## Create a skill

Create a directory under `skills/`. The directory name must match the skill's `name` field:

```text
skills/my-skill/
└── SKILL.md
```

Start with YAML frontmatter containing a specific name and description:

```markdown
---
name: my-skill
description: Describe what this skill does and the exact situations where an AI agent should use it. Make this specific enough that it triggers only for the right requests.
---

# My Skill

Write the workflow, rules, references, and verification steps an AI agent should follow when this skill is used.
```

Keep the description specific enough to trigger only for relevant requests. Keep the body actionable: explain the workflow, constraints, supporting references, and how to verify the result.

## Validate the workspace

Run the test suite and skill validator before installing or sharing skills:

```bash
npm test
npm run validate
```

The validator can also be run directly:

```bash
node scripts/validate-skills.mjs
```

Validation checks the skill frontmatter, naming conventions, directory/name matching, and Codex plugin configuration.

## Install skills into Codex

Create or refresh symlinks for shippable skills in your local Codex skills directory:

```bash
./scripts/link-skills.sh
```

By default, the script installs to `${CODEX_HOME:-$HOME/.codex}/skills`. It skips skills inside `node_modules`, `deprecated`, `in-progress`, and `personal` directories. To choose another destination:

```bash
CODEX_SKILLS_DIR="$HOME/.codex/skills" ./scripts/link-skills.sh
```

List the skill files currently in the workspace with:

```bash
./scripts/list-skills.sh
```

## Development workflow

1. Add or update a skill under `skills/`.
2. Run `npm test` and `npm run validate`.
3. Review the generated diff and confirm that no secrets or machine-specific values were added.
4. Run `scripts/link-skills.sh` when the skill is ready for local Codex use.
