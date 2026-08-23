# Instruction taxonomy

Classify every item before placing it. Each important fact or rule should have
one preferred source of truth.

| Question | Owner |
| --- | --- |
| Needed on nearly every task? | Root `AGENTS.md` |
| Applies because code is in one subtree? | Nested `AGENTS.md` |
| Repeatable procedure or reusable expertise? | `.agents/skills/<name>/SKILL.md` |
| Project-specific convention or invariant? | `docs/standards/<area>.md` |
| System structure, boundary, dependency, or ownership? | `ARCHITECTURE.md` |
| Detailed supporting technical knowledge? | `docs/references/` or a skill reference |
| Why an important choice exists? | `docs/decisions/` |
| Deterministically enforceable? | Tooling, tests, hooks, or CI |

## Classification rules

- Root `AGENTS.md` contains only always-needed operation, navigation, critical
  routing, and repository-wide safety.
- Nested `AGENTS.md` exists only when that directory creates distinct
  constraints. It does not hold generic task procedures.
- A standard says WHAT this repository requires. A skill says HOW to perform a
  recurring task.
- Architecture documents explain structure; decisions explain rationale;
  references provide conditional detail; plans are temporary task artifacts.
- Existing `.agents/rules/` and `.agents/workflows/` may be audited as legacy
  inputs, but do not create them for ordinary conventions or procedures.
- Do not copy obvious source code into documentation.
- Repeat a high-risk invariant briefly only when the safety benefit outweighs
  duplication.

## Evidence and conflict handling

Repository facts must come from the repository. Runtime behavior must come from
current primary documentation. Recommendations and assumptions must be labeled.

When documentation conflicts with code or tests, investigate whether the
documentation is stale, inspect surrounding evidence and history when
available, and surface the conflict. Do not silently choose whichever source is
more convenient or treat code as permission to violate an intentional
architecture rule.

A Markdown link is not automatically loaded. It is active only when the runtime
loads it or a selected instruction explicitly directs the agent to read it.
