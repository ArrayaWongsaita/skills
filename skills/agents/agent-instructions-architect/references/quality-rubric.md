# Quality rubric

## Discoverability and context

- Root `AGENTS.md` is a lean operating map, normally about 50–120 lines.
- An agent can find architecture, standards, skills, decisions, references, and
  validation commands without a redundant router layer.
- Detailed information has an explicit read condition and is not preloaded.
- Runtime inventory, startup, imported, conditional, shadowed, and unresolved
  artifacts are reported separately.
- Instruction bytes and skill-catalog metadata are measured separately.

## Responsibility and source of truth

- Every major fact has one preferred owner.
- Root, nested instructions, skills, standards, architecture, references,
  decisions, plans, and tooling keep distinct responsibilities.
- Standards state project requirements; skills state repeatable procedures.
- Nested instructions contain only location-specific deltas.
- No framework tutorial or task checklist has leaked into root instructions.
- No empty file exists merely to complete a proposed tree.

## Skills and routing

- Every `SKILL.md` has valid `name` and precise WHAT + WHEN `description` fields.
- Skills are focused, reusable, composable, and independent of unrelated
  concerns.
- Database design-only work and database changes route differently.
- Testing and security review compose with domain skills.
- Representative positive and negative prompts select the minimum relevant set.
- The architecture introduces no specialist agents or orchestration.

## Evidence and enforcement

- Commands, paths, frameworks, boundaries, and generated files are backed by
  repository evidence.
- Runtime facts use dated primary documentation.
- Formatting, types, dependency direction, schemas, builds, and generated-file
  consistency use deterministic tooling when practical.
- Tooling failures are reported, not hidden or reclassified as success.

## Final audits

- Complete diff and requirement-coverage review.
- Context-efficiency audit: each root line is nearly always needed.
- Duplication audit across all instruction and documentation layers.
- Path, link, command, and architecture-consistency validation.
- Proportional tests, lint, type checks, builds, and schema validation.
- Explicit record of skipped checks, assumptions, and unresolved gaps.
