# Example: cross-runtime adapters

Canonical shared source:

```text
AGENTS.md
.agents/rules/testing-quality.md
```

Small native adapters when the selected runtime needs them:

```text
CLAUDE.md                                  # @AGENTS.md
.github/instructions/testing.instructions.md  # Copilot applyTo selector
opencode.json                             # explicit local rule paths
```

Do not create `.github/copilot-instructions.md` merely to copy `AGENTS.md`;
Copilot CLI already supports `AGENTS.md`. Keep runtime-only syntax or behavior
in the adapter and shared policy in the canonical tree.

Validate each runtime separately. `all` means four independent reports, not a
single merged context estimate.
