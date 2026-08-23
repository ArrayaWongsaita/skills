# Repository layout

Use this as a conceptual default, not a request to create empty directories.

~~~text
AGENTS.md
ARCHITECTURE.md
docs/
├── standards/
├── decisions/
├── references/
└── plans/
    ├── active/
    └── completed/
.agents/
└── skills/
    └── <skill-name>/
        ├── SKILL.md
        ├── scripts/
        └── references/
apps-or-packages/
└── AGENTS.md       # only where location-specific rules justify it
~~~

## Root `AGENTS.md`

Aim for roughly 50–120 lines as a maintainability heuristic. Keep:

1. a one-sentence mission;
2. a before-change sequence: inspect, identify concerns, select skills, find
   scoped instructions, and read only relevant documentation;
3. a concise repository map;
4. repository-wide invariants and high-risk routing;
5. proportional final verification and real command pointers.

Move framework tutorials, migration steps, testing methodology, security
checklists, and detailed conventions elsewhere.

## Scoped instructions

Place a nested `AGENTS.md` at a genuine application, package, or module boundary
only when that subtree has distinct dependency, placement, generated-file, or
verification constraints. State only the delta from the root. Check native
runtime activation semantics before relying on nesting.

## Skills and documentation

Repository-local skills live under `.agents/skills/`. Their descriptions route
tasks; their bodies route further to standards or references only when
relevant. Keep one direct hop from skill to supporting material.

Use existing authoritative docs when present. Do not create a parallel
`docs/standards/` file merely to restate a README, architecture document,
schema, or tool configuration that already owns the fact.

## Runtime adapters

Create adapters only for an active runtime whose native behavior needs one.
Adapters contain runtime-specific loading or scoping syntax, not copied shared
policy. Examples may include a small `CLAUDE.md` import, Copilot path selectors,
`opencode.json` instruction paths, or a Claude-native skill placement pointing
to the canonical catalog. Verify current native semantics first.

`AGENTS.override.md` is a Codex-specific replacement at one directory. Use it
only when replacement rather than additive scoped guidance is intentional.
