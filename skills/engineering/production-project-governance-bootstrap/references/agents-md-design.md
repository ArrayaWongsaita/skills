# AGENTS.md Design

Use this reference when creating or restructuring persistent agent instructions.

## Root instructions are a router

Keep the root `AGENTS.md` concise and always relevant. Include only:

- Repository-wide invariants and forbidden actions.
- Task classification and risk-modifier routing.
- Source-of-truth and conflict behavior.
- High-risk approval gates.
- Minimum context and verification requirements.
- Minimum Definition of Done.
- Explicit triggers for conditional rules.

Do not embed complete architecture, security, testing, database, migration, observability, or release manuals. Link each conditional document through a sentence that states its trigger and required action.

## Nested instructions require distinct scope

Create a nested file only when its directory represents a materially different application, service, data boundary, shared library, or infrastructure area. State:

- Exact scope.
- Which broader guidance it extends.
- Any intentional override and why.
- Relevant verified commands and their source.
- Conditional documents and triggers.
- Local boundaries and forbidden changes.

Do not duplicate root rules or create one file per directory. Prefer one instruction file at the nearest meaningful boundary.

## Override behavior

Treat `AGENTS.override.md` as stronger scoped guidance. Do not create it beside `AGENTS.md` unless the repository has an explicit, documented override strategy. During audits, report both files, explain precedence, and identify whether the arrangement is intentional.

Never silently resolve contradictory rules. Precedence explains which instruction is applied; it does not prove the contradiction is correct.

## Instruction size budget

Use configurable thresholds:

- Prefer root instructions comfortably below 8 KiB.
- Warn when an active root-to-leaf instruction chain exceeds 24 KiB.
- Fail or require explicit review before exceeding the repository's configured platform limit; use 32 KiB only as a default when no limit is known.

Measure the applicable chain, not every instruction file in the repository. Reduce size through routing and removal of duplication, never by hiding critical safety rules.

## Refactor safely

1. Inventory every current rule and its scope.
2. Mark duplicates, contradictions, stale paths, enforceable rules, and historical context.
3. Design the target routing map.
4. Preserve global invariants in root instructions.
5. Move detailed or scoped rules to the nearest justified location.
6. Preserve history with tracked moves where practical.
7. Produce a before-and-after map and validate every route.
