# Instruction taxonomy

Classify guidance before moving it. Keep `AGENTS.md` canonical, then choose the
smallest valid scope and load mechanism.

| Class | Meaning | Default location |
| --- | --- | --- |
| Always-on | Stable guidance needed before the task is known | Root `AGENTS.md` |
| Conditional | Applies to a path, file type, or task | Nested `AGENTS.md` or routed rule |
| Project fact | Verified architecture, command, ownership, or constraint | Root or scoped rule |
| Workflow | Ordered procedure for a recurring operation | `.agents/workflows/` |
| Reference | Background, examples, schemas, or rationale | `.agents/references/` |
| Runtime adapter | Loads or scopes canonical guidance for one runtime | Native runtime path |
| Intentional override | Replaces broader guidance for a documented scope | Runtime-native override |
| Enforced control | Must hold regardless of model compliance | CI, hook, permission, or sandbox |

## Classification tests

1. Does the agent need this before it knows the task? If yes, consider root.
2. Can a path, file pattern, or task select it? If yes, keep it conditional.
3. Can the repository prove it? Record evidence and avoid copying the fact.
4. Is it an ordered operation? Use a workflow, not a permanent root rule.
5. Is it explanation rather than direction? Use a reference.
6. Must violation be impossible? Move enforcement outside prompt text.
7. Does a native file repeat shared prose? Replace it with an adapter.

## Canonical source and precedence

Use `AGENTS.md` as the shared source of truth. Runtime adapters may import it,
select it, or add syntax that the canonical format cannot express, but must not
silently fork shared policy.

Follow documented native scope and precedence. If a runtime provides no
precedence, report the conflict. Keep a narrower rule only when the narrower
scope is intentional and documented.

A Markdown link is not automatically active. Classify it as loaded only when
the runtime expands it or the canonical router explicitly directs the agent to
read it for the current task.
