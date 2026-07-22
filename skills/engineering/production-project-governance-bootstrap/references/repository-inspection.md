# Repository Inspection

Use this reference for audit-first, targeted discovery. Never treat filename guesses as repository facts.

## Establish the boundary

1. Resolve the requested target and current directory.
2. Use version-control root discovery when available; otherwise explain the chosen root.
3. Record status, including untracked and modified files, without changing it.
4. Determine whether writes are allowed by both the requested mode and the host environment.

## Discover instruction sources first

Search for visible global instructions, `AGENTS.md`, `AGENTS.override.md`, configured fallback instruction names, repository skills, documentation indexes, project memory, and plan conventions. Build an instruction map before proposing structure.

For each source record:

| Field | Meaning |
| --- | --- |
| Path | Repository-relative location |
| Scope | Files and work governed |
| Precedence | Relationship to broader or override guidance |
| Status | Active, proposed, superseded, historical, unknown |
| Size | Approximate bytes, not token precision |
| Purpose | Invariants, router, detailed manual, memory, or other |
| Conflicts | Exact or suspected conflicting sources |

## Inspect repository metadata

Use targeted searches for:

- Workspace and monorepo configuration.
- Application, service, library, shared-package, and deployment boundaries.
- Languages, frameworks, package managers, build systems, task runners, tests, linters, and type checkers.
- Database, ORM, schema, migration, API, event, queue, and external-integration configuration.
- Cloud, container, deployment, and CI/CD configuration.
- Architecture docs, ADRs, specs, plans, security guidance, runbooks, incidents, lessons, regression tests, and ownership mechanisms.

Ignore dependency directories, build outputs, generated clients, caches, coverage, vendors, large binaries, secrets, and unrelated history. Inspect filenames and safe manifests before opening broad content. Never print environment values or credential files.

## Verify commands

Prefer, in order, the source that actually controls execution: CI/task-runner configuration, package or workspace manifests, Make/Task files, language project configuration, then current project documentation. Reconcile differences rather than assuming docs are current.

For each command record:

```text
Purpose | Command | Authoritative source | Scope | Inspected or executed | Result
```

Cover install, development, build, lint, type checking, unit, integration, end-to-end, schema validation, migrations, production readiness, and deployment only when the repository defines them. Use `Unknown — requires project owner confirmation` for gaps.

Do not run install, migration, deployment, destructive, production, or secret-related commands during inspection. Do not run broad test suites merely to learn their names.

## Produce evidence before recommendations

Separate facts, inferences, recommendations, and unknowns. Explain which evidence supports the repository complexity classification and every proposed governance artifact.
