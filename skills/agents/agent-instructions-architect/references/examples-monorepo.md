# Example: monorepo

```text
AGENTS.md
packages/
├── web/AGENTS.md
└── api/AGENTS.md
.agents/rules/repository-boundaries.md
```

The root owns cross-package guidance. Package files own package commands and
boundaries without copying the root. Runtime reports must declare the working
directory:

- Codex at repository root loads only root `AGENTS.md`.
- Codex at `packages/web` loads root plus `packages/web/AGENTS.md`.
- Claude and Copilot may add nested guidance on later file access.
- OpenCode resolves its local project rule according to native precedence.

Report a shared/package conflict instead of assuming that narrower always wins
on every runtime.
