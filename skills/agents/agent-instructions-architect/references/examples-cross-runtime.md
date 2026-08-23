# Example: cross-runtime adapters

Canonical repository system:

~~~text
AGENTS.md
ARCHITECTURE.md
docs/standards/testing.md
.agents/skills/testing/SKILL.md
~~~

Add only adapters required by active runtimes:

~~~text
CLAUDE.md                                  # small native import/adapter
.claude/skills/testing                     # approved symlink/placement adapter
.github/instructions/testing.instructions.md  # Copilot path selector
opencode.json                             # explicit local instruction paths
~~~

Keep shared operation in `AGENTS.md`, procedure in the testing skill, and
project-specific requirements in the testing standard. Native files contain
only runtime-specific loading or scope syntax. Do not create
`.github/copilot-instructions.md` merely to copy `AGENTS.md` when the selected
Copilot surface already supports it.

Codex, Copilot CLI, and OpenCode can use the canonical `.agents/skills` catalog
directly. Claude Code discovers `.claude/skills`, so use a
repository-compatible pointer or installer rather than a copied `SKILL.md`.

Validate runtimes independently. `all` means separate reports, not a merged
context estimate. Capability gaps are reported; equal product support does not
mean pretending every runtime has identical native skill discovery.
