# Example: monorepo

~~~text
AGENTS.md
ARCHITECTURE.md
docs/
└── standards/
    └── testing.md
.agents/
└── skills/
    ├── backend-development/SKILL.md
    ├── frontend-development/SKILL.md
    └── testing/SKILL.md
packages/
├── web/AGENTS.md
└── api/AGENTS.md
~~~

The root maps packages and shared sources. `ARCHITECTURE.md` owns package
boundaries and dependency direction. Each package `AGENTS.md` states only the
placement, generated-file, and verification deltas caused by working in that
subtree. Skills own reusable task procedures without copying package rules.

Runtime analysis must declare the working directory. For Codex, a root session
loads only root `AGENTS.md`; a `packages/web` session loads root plus the web
file, not the API file. For other runtimes, use current native semantics and
report conflicts instead of assuming universal narrower-scope precedence.
