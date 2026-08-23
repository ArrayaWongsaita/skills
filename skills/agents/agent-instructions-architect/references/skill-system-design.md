# Skill system design

Skills represent reusable procedures or expertise for one coding agent. They
are not independent workers.

## When to create a skill

Create a repository-local skill only when the repository has a repeatable task,
meaningful decision points, or safety constraints that should be loaded on
demand. Do not create a skill merely because a framework primitive or generic
engineering category exists.

Strong candidates in a supported full-stack repository can include:

- `database-design` for design-only modeling;
- `database-change` for ORM, schema, constraint, index, or migration changes;
- `backend-development` for server-side module and behavior changes;
- `frontend-development` for user-interface work;
- `testing` as a cross-cutting behavioral verification procedure;
- `security-review` as a cross-cutting trust-boundary review.

Create only the subset justified by repository evidence. Add a distinct future
skill only when its procedure cannot be expressed cleanly by an existing skill.

## Description quality

Every `SKILL.md` needs frontmatter with a lowercase kebab-case `name` and a
`description` that says both WHAT it handles and WHEN it activates. Include
important adjacent cases and explicit exclusions when they improve routing.

Weak: "Helps with database."

Strong: "Use whenever modifying an existing database schema, ORM model, table,
column, relation, enum, constraint, index, migration, or persistent data
representation."

Keep the description concise enough for catalog discovery. Do not rely on the
body to fix ambiguous activation metadata.

## Skill body

Include only useful sections such as purpose, use when, do not use when,
required context, procedure, decision points, safety constraints, verification,
and output expectations. Route directly to relevant standards or one-hop
references. Do not copy architecture rules or project conventions into every
skill.

Separate standard from procedure:

~~~text
docs/standards/database.md
= PostgreSQL/ORM/money/migration invariants required by this repository

.agents/skills/database-change/SKILL.md
= inspect → assess compatibility → change → inspect SQL → update consumers → verify
~~~

## Composition

Select all and only relevant skills. Examples:

- persistent refresh-token rotation: database-change + backend-development +
  security-review + testing;
- database schema design without implementation: database-design only;
- button spacing: frontend-development only;
- database column rename used end-to-end: database-change +
  backend-development + frontend-development + testing.

A security-related page name does not activate security review unless the
change crosses a security boundary. Testing is proportional; it is not
automatically a heavyweight procedure.

## Evidence-supported baseline blueprints

Use these blueprints only for concerns that exist in the repository. Adapt
terminology and commands to actual code; do not turn them into framework
tutorials.

### Database design

Use for new schemas, entities, relationships, constraints, indexes, ORM models,
or persistent structures before implementation. Its procedure should inspect
the current schema and relevant standards, then identify business concepts,
ownership, invariants, cardinality, required and optional data, uniqueness,
database constraints, query patterns, indexes, consistency and concurrency,
lifecycle and deletion, migration implications, and material tradeoffs.

When the user asks for design only, explicitly prohibit schema, migration, and
application changes.

### Database change

Use for changes to tables, columns, relations, enums, constraints, indexes, ORM
models, migrations, or persistent representation. Before editing, inspect the
schema and models, search every consumer, and assess contract compatibility,
existing data, and migration safety. Then make the smallest change, use the
repository's generator when applicable, inspect generated SQL, update
persistence and domain/application mapping, update API/types only when needed,
and test affected behavior.

Require explicit analysis for nullable-to-required changes, removals, renames,
type or default changes, uniqueness, foreign keys, large-table indexes,
backfills, destructive operations, and production compatibility. Never silently
destroy data or rewrite deployed migrations.

### Backend development

Use for endpoints, controllers, use cases, services, domain logic,
repositories, server validation, events, handlers, jobs, and server
refactoring. Inspect the affected module, layer, and established patterns;
preserve dependency direction and business invariants; keep transport
boundaries thin when the architecture expects it; prevent infrastructure
leakage; assess public contracts; update tests; and run targeted verification.

### Frontend development

Use for pages, routes, components, forms, layouts, API consumption, state,
rendering, accessibility, interactions, and UI refactoring. Inspect existing UI
and design-system primitives, choose rendering and state ownership boundaries,
reuse shared components, keep the component boundary no larger than useful,
handle loading/error/empty states when relevant, preserve accessibility and
responsive behavior, update tests, and verify the affected surface.

### Testing

Use across domains for new tests, behavior changes, regressions, test-level
selection, and coverage review. Identify observable behavior, select the
lowest-cost useful unit/integration/E2E level, follow existing style, reproduce
bugs first when practical, add regression coverage, update intentional contract
changes, and run affected tests. Never delete or weaken a test merely to pass.

### Security review

Use across domains for authentication, authorization, credentials, passwords,
sessions, cookies, tokens, permissions, roles, PII, uploads, payments, CORS,
CSRF, secrets, and input trust boundaries. Evaluate relevant authentication and
authorization, least privilege, validation, output exposure, secret and token
lifecycle, sessions and cookie settings, data leakage, mass assignment, IDOR,
injection, rate limits, sensitive logging, and error leakage. It composes with
domain and testing skills; it does not replace them.

## Progressive disclosure

Codex, Copilot CLI, and OpenCode discover repository skills from
`.agents/skills` and expose compact metadata before loading a selected skill.
Claude Code uses `.claude/skills`; follow `runtime-compatibility.md` for a thin
placement adapter when Claude is active. Keep descriptions discriminative and
the catalog small. Put lengthy or uncommon material in direct skill references
with explicit conditions for reading each one. Do not instruct the agent to
read every standard or reference before every task.
