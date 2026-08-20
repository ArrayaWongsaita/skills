---
name: design-task-spec
description: Design decision-complete software implementation task specifications from vague ideas or existing tickets. Use when explicitly asked to investigate a repository, stress-test requirements for a feature, bug fix, refactor, migration, integration, or infrastructure change, document relevant domain decisions, and produce a source-linked task that another agent can implement without making product or architecture decisions. Do not use this skill to implement the designed task.
---

# Design Task Spec

Turn an unrefined software request into a durable, implementation-ready task. Investigate facts, close the full decision tree with the user, and stop before implementation.

## Preflight

1. Load and follow the `grilling` and `domain-modeling` skills through the host's skill mechanism. Read both skills completely. If either skill is unavailable, stop and identify the missing dependency instead of silently replacing its workflow.
2. Respect the active host mode and permissions. This skill never overrides a read-only or planning constraint.
3. Read [the task specification template](references/task-spec-template.md) before creating the task document.
4. Inspect the repository before asking questions. Check applicable `AGENTS.md` files, repository and package docs, `CONTEXT-MAP.md` or `CONTEXT.md`, ADRs, existing task conventions, configuration, schemas, public contracts, source entrypoints, tests, and the working-tree state.
5. Find facts yourself. Use local inspection first and authoritative external sources only when the task requires current or external facts. Never ask the user for information that the environment can establish.
6. Match the task artifact to the dominant language of repository documentation. Fall back to English. Converse in the user's language and preserve code identifiers verbatim.

## Establish the task document

1. Prefer a documented task location already used by the repository. Otherwise use `docs/tasks/<slug>.md` beneath the repository root or current working directory.
2. Derive `<slug>` from a concise working title. Resume an existing file only when it clearly describes the same task. For an unrelated collision, use the lowest available numeric suffix such as `<slug>-2.md`.
3. Create the document immediately with `status: draft`, the closest `task_type`, and the current local date. Use one of `feature`, `bug-fix`, `refactor`, `migration`, `integration`, `infrastructure`, or `mixed`.
4. Treat this document as the source of truth. Update it after every resolved interview round; do not leave decisions only in chat.
5. If mutation is forbidden, maintain the complete artifact in the response, state its `pending_path`, and persist it on the first later turn that permits writes before continuing new design work.
6. Never overwrite unrelated user changes. If the task document changes outside the session, re-read and merge deliberately.

## Build the design tree

1. Restate the request as a provisional problem, desired outcome, audience, and task type. Distinguish user claims from repository facts.
2. Load [the coverage modules](references/coverage-modules.md). Select every applicable primary module and cross-cutting lane. Record excluded modules as `N/A — <reason>` in the task document.
3. Map decisions as a tree. Cover product intent before downstream behavior and cover behavior before architecture, contracts, delivery, and verification.
4. Ask the entire currently unblocked frontier according to the `grilling` skill. Number questions, explain material choices, and recommend one answer. Do not ask a question whose prerequisite remains unresolved.
5. Use the host's structured question mechanism when available. If it limits questions per call, split one frontier into consecutive batches without advancing to dependent decisions early.
6. After each answer, update facts, decisions, assumptions, rejected alternatives, scope, scenarios, and the readiness checklist in the task document. Recompute the frontier before the next round.
7. Apply `domain-modeling` continuously: challenge ambiguous terms, compare statements with code, update the correct glossary when domain language is resolved, and create an ADR only when that skill's strict criteria are all met.

## Separate epistemic categories

- **Fact**: Support repository facts with `path:line` and a symbol when practical. Cite commands, logs, tests, or authoritative links when they are the stronger evidence.
- **Decision**: Record who decided, the selected option, the reason, and meaningful rejected alternatives.
- **Assumption**: Record why it cannot yet be verified and what would invalidate it. Never use an unconfirmed critical assumption to mark a task ready.
- **Blocker**: State the missing decision or evidence, its owner, and the work it prevents.
- **N/A**: Preserve the coverage item and give a concrete reason; never delete a required section merely because it appears irrelevant.

## Control status

- Keep `draft` while the decision tree or coverage review is active.
- Use `blocked` when a critical fact or decision cannot be resolved. Do not invent a default or split off implementation work to bypass the blocker.
- Present a concise shared-understanding summary only after the decision frontier is empty and the readiness checklist is complete.
- Change to `ready-for-implementation` only after the user explicitly confirms that summary. Record the approval in the task document.
- Downgrade a ready task to `draft` whenever a later edit changes behavior, scope, architecture, contracts, migration, or acceptance criteria; require confirmation again.

## Handoff boundary

End with the task path, status, applicable modules, and any blockers. Do not edit implementation code, run migrations, deploy, create production resources, or begin the designed task. A ready task must let an implementation agent execute without choosing product behavior or architecture; local code details may remain with that agent when repository conventions make the choice mechanical.
