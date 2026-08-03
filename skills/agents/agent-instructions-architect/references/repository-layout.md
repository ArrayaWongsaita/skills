# Repository layout and naming

Use `AGENTS.md` as the canonical shared entrypoint:

```text
AGENTS.md
.agents/
├── rules/          # stable routed or conditional guidance
├── workflows/      # ordered task procedures
├── references/     # background and detailed guidance
└── templates/      # reusable instruction templates
```

Add nested `AGENTS.md` at real package or directory boundaries only after
checking how each selected runtime activates nested files. For Codex, the file
must be on the project-root-to-working-directory chain. A root-launched Codex
session does not automatically load every descendant `AGENTS.md`.

Use `AGENTS.override.md` only for an intentional Codex-specific replacement in
that directory. It may be durable, but is less portable than nested
`AGENTS.md`.

## Runtime adapters

- `CLAUDE.md`: usually a small `@AGENTS.md` loader.
- `.github/copilot-instructions.md`: Copilot-only additions, not copied policy.
- `.github/instructions/*.instructions.md`: `applyTo` path selection.
- `opencode.json`: explicit local instruction paths or globs.

## Naming rules

- Use exact uppercase `AGENTS.md` for the canonical entrypoint.
- Use lowercase kebab-case for supporting files.
- Name one topic per file; avoid `misc`, `notes`, `final`, and numbered copies.
- Name workflows with an action and object, such as `validate-release.md`.
- Use repository-relative paths for required shared guidance.
- Keep runtime-specific frontmatter and configuration in adapters.

## Root router shape

```markdown
# Agent Instructions

## Start here
- Repository purpose and key boundaries.

## Always active
- Small set of universal constraints.

## Read when relevant
- [Testing quality](.agents/rules/testing-quality.md): read before tests.

## Validation
- Concrete commands for changed areas.
```
