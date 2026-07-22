---
name: production-project-governance-bootstrap
description: Audit, set up, refactor, update, or validate repository-scoped production engineering governance for AI-assisted software development, including AGENTS.md routing, task contracts, architecture decisions, risk approvals, engineering memory, quality gates, and release controls. Use only when explicitly invoked for repository governance work in a new or existing software repository. This skill changes governance artifacts rather than application features. Do not use for ordinary feature implementation, routine bug fixes, code review, deployment execution, or production operations.
---

# Production Project Governance Bootstrap

Build the smallest governance system justified by repository evidence. Keep application behavior unchanged. Follow this sequence:

```text
Inspect -> Classify -> Identify gaps -> Design -> Explain -> Apply only when authorized -> Validate -> Report
```

## Resolve mode and authority

Recognize these modes: `audit`, `plan`, `setup`, `refactor`, `update`, and `validate`. Default to `audit` when the invocation is missing or ambiguous.

| Mode | Writes | Required result |
| --- | --- | --- |
| `audit` | Never | Evidence, instruction map, gaps, conflicts, automation candidates, justified target structure |
| `plan` | Never | Audit plus file disposition, risks, assumptions, and safe application sequence |
| `setup` | Governance files only | Merged minimal system, validation evidence, diff, unresolved decisions |
| `refactor` | Governance files only | Preserved rules, reduced duplication, before/after routing map, diff |
| `update` | Affected governance only | Focused update tied to the triggering repository change or lesson |
| `validate` | Never unless fixes are explicitly requested | Findings with severity and evidence; validate again after authorized fixes |

Treat a host read-only or planning mode as authoritative even when the user names a write-capable mode. Planning an operation never authorizes executing it.

Use focused `update` mode when an application/service, architecture boundary, CI command, recurring failure, risk category, or production workflow changes. Do not rebuild unaffected governance.

## Enforce safety invariants

- Inspect every existing instruction file before proposing or changing it.
- Preserve project-specific rules, uncommitted work, historical decisions, incidents, and lessons.
- Do not silently resolve conflicting authoritative sources. Report the conflict, status, scope, and proposed resolution.
- Do not modify application code, business logic, production dependencies, infrastructure, secrets, production data, or deployment state. Do not access or expose secret values.
- Do not run destructive commands. Require explicit human approval for destructive, irreversible, production, authentication-boundary, authorization-weakening, secret, public-contract, critical-infrastructure, external-service, or production-traffic actions.
- Do not invent commands, owners, architecture, deployment units, or repository conventions. Mark unconfirmed commands `Unknown — requires project owner confirmation`.
- Do not create both `AGENTS.md` and `AGENTS.override.md` in one directory without a documented override strategy.
- Do not place critical safety rules only in optional documents.
- Do not create nested instructions, templates, or directories merely to match an example tree.
- Do not create unrelated feature-development skills.
- Prefer automated enforcement over prose where a compiler, test, analyzer, CI gate, runtime guard, or alert can enforce the rule.

## Execute the mandatory workflow

### 0. Establish scope and safety

1. Resolve the repository root from the user's target, then version-control metadata, then the current directory.
2. Record the current directory, requested mode, write authority, task scope, and whether the request is full or focused.
3. Inspect version-control status without altering it. Preserve unrelated and uncommitted changes.
4. Identify existing governance files before reading broader project material.

### 1. Map instruction sources

Inspect visible global instructions, root and nested `AGENTS.md`, root and nested `AGENTS.override.md`, configured fallback filenames, existing skills, and documentation or memory indexes. Record:

```text
Path | Scope | Precedence | Status | Approximate size | Purpose | Potential conflicts
```

Treat an override as stronger scoped guidance, not an ordinary companion file. Read [agents-md-design.md](references/agents-md-design.md) before changing instruction structure.

### 2. Inspect targeted repository evidence

Inspect manifests, workspace configuration, application and service boundaries, language and framework configuration, build/test/static-analysis configuration, data and integration tooling, CI/CD, architecture records, specs, runbooks, security guidance, incidents, regression tests, and ownership files. Ignore dependencies, build products, generated outputs, caches, coverage, vendor trees, binaries, and unrelated history.

Do not read the entire repository by default. Use [repository-inspection.md](references/repository-inspection.md). Run `scripts/inspect-repository` when Node 20+ is available; continue manually when it is not.

### 3. Verify commands

Derive install, development, build, lint, type-check, test, schema, migration, readiness, and deployment commands only from authoritative repository sources. Distinguish inspected commands from commands actually run. Never claim execution when only configuration was inspected.

### 4. Classify complexity and work

Classify the repository as `Small`, `Medium`, `Large`, or `Multi-system` using evidence, choosing the least elaborate level that addresses observed boundaries and risk. Classify the task with one primary type plus zero or more risk modifiers. Read [governance-model.md](references/governance-model.md), [task-classification.md](references/task-classification.md), and [risk-and-approvals.md](references/risk-and-approvals.md).

### 5. Design or apply the minimum system

Use a concise root router, nested instructions only for materially distinct scopes, conditional detailed rules, dedicated sources of truth, and automated enforcement. For write-capable modes:

1. Explain each proposed path and its evidence.
2. Preserve, merge, move, or archive existing guidance rather than replacing it blindly.
3. Use tracked moves where practical during refactors.
4. Stop before unresolved high-risk conflicts or actions that require approval.
5. Keep changes inside governance scope and show the resulting diff.

Copy and adapt only justified files from `assets/templates/`. Remove instructional comments and unused sections from generated project documents.

### 6. Validate and report

Run relevant Markdown, link, YAML, and script checks plus `git diff --check`. Use `scripts/validate-governance` when Node 20+ is present; otherwise follow [validation-rules.md](references/validation-rules.md) manually. Do not run unrelated application suites unless executable governance tooling affects them.

Report:

- Mode, repository root, classification, and evidence inspected.
- Instruction map and source-of-truth conflicts.
- Commands confirmed, run, failed, or unknown.
- Files created, changed, preserved, moved, archived, or left unchanged, with justification.
- Validation evidence and the resulting diff summary.
- Assumptions, unresolved decisions, risks, approvals, and manual follow-up.

## Load detailed references conditionally

Read only the references required by the active mode and task:

- [governance-model.md](references/governance-model.md): complexity, layers, source-of-truth policy, Definition of Ready, and Definition of Done.
- [repository-inspection.md](references/repository-inspection.md): audit scope, targeted discovery, instruction mapping, and command verification.
- [agents-md-design.md](references/agents-md-design.md): root and nested instruction design, precedence, overrides, and size budgets.
- [context-routing.md](references/context-routing.md): conditional route contracts and context-efficient loading.
- [task-classification.md](references/task-classification.md): primary types, risk modifiers, architecture triggers, and required artifacts.
- [task-contracts.md](references/task-contracts.md): work-item contracts, specifications, plans, and scope controls.
- [risk-and-approvals.md](references/risk-and-approvals.md): R0–R4 classification and mandatory human approval gates.
- [engineering-memory.md](references/engineering-memory.md): reusable lessons, incidents, indexes, and incident-to-guardrail routing.
- [automated-guardrails.md](references/automated-guardrails.md): converting prose rules into enforceable protection.
- [security-and-reliability.md](references/security-and-reliability.md): security, reliability, observability, compatibility, and migration triggers.
- [release-and-rollback.md](references/release-and-rollback.md): release strategies, readiness, rollback, and post-release verification.
- [documentation-lifecycle.md](references/documentation-lifecycle.md): ownership, statuses, review triggers, archiving, and skill registries.
- [validation-rules.md](references/validation-rules.md): structural, command, instruction, memory, and quality validation.
- [skill-evaluation.md](references/skill-evaluation.md): trigger, behavior, fixture, deterministic, and rubric evaluation of this skill.

Do not load every reference, template, ADR, incident, lesson, or project document. Start with the task contract, nearest applicable instructions, relevant source and tests, then follow explicit triggers.
