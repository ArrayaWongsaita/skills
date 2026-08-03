# Runtime compatibility

Keep `AGENTS.md` as the canonical shared source. Treat native runtime files as
loaders, adapters, or path selectors rather than independent policy copies.
Separate these measurements:

- **inventory**: every candidate instruction artifact in the repository;
- **startup**: files resolved from the runtime and working directory;
- **import**: files eagerly expanded by a native import mechanism;
- **conditional**: files that need a target path or later file access;
- **unresolved**: global config, remote content, or dynamic access not proven
  from repository-local evidence.

Never call inventory size "loaded context".

## Codex

Codex walks from the project root to the current working directory. In each
directory it selects at most one non-empty file in this order:
`AGENTS.override.md`, `AGENTS.md`, then configured fallback names. Files nearer
the working directory appear later. The default combined project instruction
limit is 32 KiB, configurable with `project_doc_max_bytes`.

`AGENTS.override.md` may be a durable Codex-specific replacement; it is not
inherently temporary. Prefer nested `AGENTS.md` when portability matters.
Nested files outside the root-to-working-directory chain are inventory only.

Source verified 2026-08-03:
https://learn.chatgpt.com/docs/agent-configuration/agents-md

## Claude Code

Claude Code loads `CLAUDE.md`, `.claude/CLAUDE.md`, and local memory according
to its directory hierarchy. It does not natively load `AGENTS.md`; use a small
`CLAUDE.md` containing `@AGENTS.md` when the shared canonical policy is needed.
Imports are eager, recursive to a maximum of four hops, and consume context.
Nested memory and path-scoped `.claude/rules/*.md` may load later when matching
files are accessed.

Do not count `AGENTS.md` for Claude unless a native file imports it. Treat
external imports and user settings as unresolved unless explicitly supplied.

Source verified 2026-08-03:
https://code.claude.com/docs/en/memory

## GitHub Copilot CLI

Copilot CLI discovers repository and agent instruction files at the repository
root, current working directory, intermediate directories, and directories
nested in a target-file path. It supports `AGENTS.md`, `CLAUDE.md`,
`.claude/CLAUDE.md`, `GEMINI.md`, repository-wide
`.github/copilot-instructions.md`, and path-specific
`.github/instructions/**/*.instructions.md` files with `applyTo`. Modular
instruction discovery excludes directories that are applicable only because
they are intermediate between the repository root and working directory.

Copilot combines applicable files and does not define a universal precedence
order. It expands `@` references in repository-wide instruction files, but not
in path-specific `*.instructions.md` files. Report conflicts instead of
inventing precedence. Keep IDE and cloud-agent claims separate from CLI claims.

Source verified 2026-08-03:
https://docs.github.com/en/enterprise-cloud%40latest/copilot/how-tos/copilot-cli/customize-copilot/add-custom-instructions

## OpenCode

OpenCode prefers a project `AGENTS.md`; `CLAUDE.md` is a fallback when no
`AGENTS.md` matches. Starting at the current directory, it searches upward to
the nearest Git directory for a project `opencode.json` or `opencode.jsonc`.
Instruction paths and globs resolve relative to that config file. The selected
project instructions are combined with the selected project rule.

OpenCode merges project configuration with remote, global, custom, inline, and
managed layers in a documented precedence order. Repository-only static
analysis models the nearest project config and reports the other layers as
unresolved; it does not read environment variables, home files, managed paths,
or remote configuration.

OpenCode does not automatically expand arbitrary Markdown references inside
`AGENTS.md`. Resolve local instruction globs, but never fetch remote URLs by
default. Record remote entries and global/user configuration as unresolved.

Source verified 2026-08-03:
https://opencode.ai/docs/rules/

## Static-analysis boundary

Repository-local analysis cannot prove user-level configuration, disabled
instructions, active-session state, dynamic file reads, or remote content.
Expose assumptions and unresolved items in every runtime report. Use the
runtime's native inspection command when exact session state matters.
