---
name: agent-instructions-architect
description: Set up, audit, refactor, migrate, and validate lean single-agent repository instruction architectures using AGENTS.md, scoped instructions, composable Agent Skills, repository documentation, and deterministic enforcement. Use when creating or reorganizing repository guidance, reducing context or duplication, or adapting one canonical system across Codex, Claude Code, GitHub Copilot CLI, and OpenCode. Do not use for generic prompt writing, application feature work, or multi-agent orchestration.
---

# Agent Instructions Architect

Build the smallest instruction system that gives one coding agent the right
context, procedure, constraints, and verification for its current task.

## Operating contract

- Inspect the repository before designing or editing its instruction system.
- Derive commands, architecture, boundaries, conventions, and generated paths
  from repository evidence; do not invent them.
- Keep one coding agent. Represent reusable expertise with composable skills,
  not specialist agents or orchestration.
- Preserve unrelated dirty-worktree changes and application code.
- Separate repository evidence, sourced runtime facts, recommendations,
  assumptions, and unresolved state.
- Never describe inventory size as loaded context.

## Select one or more modes

- **Audit**: assess the current system without changing files.
- **Design**: propose responsibilities, routing, and file operations; read-only.
- **Setup**: create a minimum useful system in a repository that lacks one.
- **Refactor**: reduce duplication, context, or misplaced guidance in place.
- **Migrate**: move an existing system to the target model or add thin runtime
  adapters.
- **Validate**: run deterministic checks and semantic audits; read-only unless
  fixes were requested.

If the request is ambiguous, audit first. A task can combine modes.

## Required workflow

1. Read `references/repository-inspection.md`, inspect the repository, and
   record its actual stack, topology, modules, commands, tests, CI, generated
   files, documentation, and existing agent infrastructure.
2. For an existing instruction tree, run
   `scripts/scan-instruction-tree.py` before reading it wholesale. Declare the
   runtime, working directory, and target paths used for resolution.
3. Classify content with `references/instruction-taxonomy.md` and map each fact
   or procedure to one authoritative owner.
4. Design the minimum tree with `references/repository-layout.md`. Create only
   files with repository-supported content; reuse and link existing sources.
5. When skills are needed, read `references/skill-system-design.md`. Design
   narrow, composable procedures with precise WHAT + WHEN descriptions.
6. Read `references/runtime-compatibility.md` only when runtime loading,
   adapters, precedence, discovery, or budgets matter.
7. Use `references/migration-playbook.md` for setup, refactor, or migration.
   Apply only authorized, scoped, non-destructive changes.
8. Validate paths, links, routing, source-of-truth ownership, duplication,
   context efficiency, commands, and architecture consistency. Use
   `references/routing-evaluation.md` and
   `references/quality-rubric.md`.

## Responsibility model

| Layer | Sole responsibility |
| --- | --- |
| Root `AGENTS.md` | Always-needed operation, repository map, critical routing and safety |
| Nested `AGENTS.md` | Constraints caused by working inside that subtree |
| `SKILL.md` | Repeatable procedure or expertise: HOW to perform a task |
| `docs/standards/` | Project-specific conventions and invariants: WHAT is required |
| `ARCHITECTURE.md` | System structure, boundaries, dependency direction, and ownership |
| `docs/references/` | Detailed technical information consulted only when relevant |
| `docs/decisions/` | Rationale for important architectural decisions |
| Tooling / CI | Deterministic enforcement |

Do not duplicate a rule across layers unless a concise repetition prevents a
material safety failure.

## Architecture constraints

- Root `AGENTS.md` is a map, not an encyclopedia. Aim for roughly 50–120 lines
  as a context-efficiency heuristic, never as a runtime limit.
- When those skills exist, root routes schema/ORM/migration implementation to
  `database-change`, design-only persistence work to `database-design` without
  implementation, and authentication, authorization, secrets, tokens, PII, or
  other trust-boundary work to `security-review`.
- Nested `AGENTS.md` files contain only location-specific constraints.
- Skills compose: never force a task into exactly one category.
- Keep database design-only work distinct from database implementation.
- Keep testing and security review cross-cutting.
- Do not add `.agents/rules/`, `.agents/workflows/`, agent role files, or another
  router layer for ordinary guidance. Existing legacy paths may be inventoried
  during an audit.
- Do not create empty standards, references, decisions, plans, or skills.
- Put enforceable formatting, types, dependencies, tests, schema checks,
  generated-file consistency, and builds in tooling or CI.
- Use repository documentation as the source of truth; do not paraphrase
  obvious code.

## Authorization and safety

- Audit and design are read-only.
- Setup, refactor, migrate, update, or implement authorizes a scoped,
  non-destructive patch after inspection when the requested boundary is clear.
- Ask before deleting, renaming, broadly replacing a whole file, or changing
  paths outside the agreed instruction system.
- Design-only database requests must not create schemas, migrations, or
  application changes unless implementation is requested.
- Never weaken tests or rewrite deployed migrations to make validation pass.

## Verification

After changes:

1. Review the complete diff and requirement coverage.
2. Verify every documented path and command against the repository.
3. Run the smallest relevant tests, type checks, lint, builds, schema checks,
   and instruction validators that actually exist.
4. Re-run runtime context measurement separately for each selected runtime;
   never merge `--runtime all` into one context estimate.
5. Confirm unrelated files were not modified.
6. Report every skipped or failed check and remaining ambiguity.

## Report by mode

- **Audit**: repository analysis, inventory, findings, context, recommendations.
- **Design**: target tree, responsibility mapping, file operations, decisions.
- **Setup/Refactor/Migrate**: created and modified files, checks, residual risks.
- **Validate**: commands and parameters, deterministic diagnostics, semantic
  findings, and verdict.

For completed architecture work also report the final tree, why each major file
owns its content, at least five repository-specific routing examples,
duplication findings, mechanical enforcement opportunities, and unresolved
gaps. Omit empty sections.

## Bundled resources

- `references/repository-inspection.md`: evidence-first discovery checklist.
- `references/instruction-taxonomy.md`: source-of-truth decision tree.
- `references/repository-layout.md`: target tree and adapter placement.
- `references/skill-system-design.md`: skill selection and composition.
- `references/migration-playbook.md`: safe setup/refactor/migration sequence.
- `references/routing-evaluation.md`: representative routing tests.
- `references/runtime-compatibility.md`: sourced runtime semantics.
- `references/quality-rubric.md`: final architecture audit.
- `references/examples-*.md`: small, monorepo, and cross-runtime patterns.
- `scripts/*.py`: repository-local scan, validation, and measurement tools.
